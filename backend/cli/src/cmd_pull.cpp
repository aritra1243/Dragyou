// =============================================================================
//  drag pull — Pull commits from a remote repository
//
//  Usage:
//    drag pull [<remote>] [<branch>]
//    drag pull origin main
//
//  Protocol:
//    1. POST /api/v1/repos/:owner/:repo/fetch
//       Body: {"have": [...], "want": ["refs/heads/main"]}
//    2. Server responds with packstream of needed objects
//    3. Client applies pack, updates local ref, fast-forward or merge
// =============================================================================

#include "repository.h"
#include "index.h"
#include "merge.h"
#include "remote.h"
#include "http_client.h"

#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <set>
#include <string>
#include <vector>

namespace fs = std::filesystem;

// Helpers declared in cmd_push.cpp / http_client.h
std::string get_remote_url(const dragyou::Repository& repo, const std::string& remote_name);
std::string get_token(const dragyou::Repository& repo);

// ── Restore working tree from commit tree ────────────────────────────────
static void restore_tree(dragyou::Repository& repo, const dragyou::Hash& tree_hash,
                          const std::string& prefix) {
    dragyou::Tree t = repo.read_tree(tree_hash);
    for (const auto& e : t.entries) {
        std::string full = prefix + e.name;
        if (e.mode == "040000") {
            fs::create_directories(repo.root() / full);
            restore_tree(repo, e.hash, full + "/");
        } else {
            dragyou::Blob b = repo.read_blob(e.hash);
            fs::path out_path = repo.root() / full;
            fs::create_directories(out_path.parent_path());
            std::ofstream f(out_path, std::ios::binary);
            f.write(reinterpret_cast<const char*>(b.content.data()),
                    static_cast<std::streamsize>(b.content.size()));
        }
    }
}

int cmd_pull(int argc, char** argv) {
    std::string remote_name;
    std::string branch_name;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a[0] != '-') {
            if (remote_name.empty()) remote_name = a;
            else if (branch_name.empty()) branch_name = a;
        }
    }
    
    if (remote_name.empty()) remote_name = "origin";

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "drag pull: not a Dragyou repository\n";
        return 1;
    }

    dragyou::Repository repo(*repo_root);

    if (branch_name.empty()) {
        auto b = repo.current_branch();
        branch_name = b ? *b : "main";
    }

    std::string remote_url = get_remote_url(repo, remote_name);
    if (remote_url.empty()) {
        std::cerr << "drag pull: no remote named '" << remote_name << "'\n";
        std::cerr << "  Use: drag remote add " << remote_name << " <url>\n";
        return 1;
    }

    std::string token = get_token(repo);
    // Pull from public repos doesn't require auth

    // ── Step 1: What do we already have? ────────────────────────────────
    std::vector<std::string> have_list;
    if (fs::exists(repo.objects_dir())) {
        for (auto& d : fs::directory_iterator(repo.objects_dir())) {
            if (!d.is_directory()) continue;
            for (auto& f : fs::directory_iterator(d)) {
                std::string h = d.path().filename().string() + f.path().filename().string();
                if (h.size() == 64) have_list.push_back(h);
            }
        }
    }

    std::cout << "Fetching from " << remote_url << " (" << branch_name << ")...\n";

    std::string fetch_body =
        "{\"have\":" + json_array(have_list) +
        ",\"want\":[\"refs/heads/" + branch_name + "\"]}";

    std::vector<uint8_t> fb(fetch_body.begin(), fetch_body.end());
    auto fetch_resp = http_post(remote_url + "/fetch", token, fb, "application/json");

    if (fetch_resp.status == 404) {
        std::cerr << "drag pull: remote branch '" << branch_name << "' not found\n";
        return 1;
    }
    if (fetch_resp.status < 200 || fetch_resp.status >= 300) {
        std::cerr << "drag pull: fetch failed (HTTP " << fetch_resp.status << ")\n";
        return 1;
    }

    // ── Step 2: Response contains binary pack ────────────────────────────
    // Check if it's JSON (negotiate) or binary pack
    const auto& body = fetch_resp.body;
    dragyou::Pack pack;

    if (!body.empty() && body[0] == '{') {
        // Server sent JSON with "pack_url" → download pack separately
        // For now: server inlines pack in response (simpler Phase 4 approach)
        std::cerr << "drag pull: unexpected JSON response (expected binary pack)\n";
        return 1;
    }

    // Parse binary pack
    std::vector<uint8_t> pack_bytes(body.begin(), body.end());
    if (pack_bytes.size() < 16) {
        std::cout << "Already up-to-date.\n";
        return 0;
    }

    try {
        pack = dragyou::Pack::deserialize(pack_bytes);
    } catch (const std::exception& e) {
        std::cerr << "drag pull: invalid pack received: " << e.what() << '\n';
        return 1;
    }

    // ── Step 3: Apply pack ────────────────────────────────────────────────
    dragyou::RemoteProtocol proto(repo);
    proto.apply_pack(pack);

    std::cout << "Received " << pack.entries.size() << " objects\n";

    // ── Step 4: Get new remote tip ────────────────────────────────────────
    // The server sets X-Dragyou-Tip header, or we parse it from pack header
    // Simple: find the newest commit in the pack
    dragyou::Hash remote_tip;
    for (auto it = pack.entries.rbegin(); it != pack.entries.rend(); ++it) {
        if (it->type == dragyou::ObjectType::Commit) {
            remote_tip = it->hash;
            break;
        }
    }

    if (remote_tip.empty()) {
        std::cerr << "drag pull: no commit found in received pack\n";
        return 1;
    }

    // ── Step 5: Fast-forward or merge ────────────────────────────────────
    auto local_tip = repo.resolve_HEAD();
    std::string local_ref = "refs/heads/" + branch_name;

    if (!local_tip) {
        // No local commits yet → just set the ref
        repo.write_ref(local_ref, remote_tip);
        repo.write_HEAD_ref(local_ref);
        dragyou::Commit c = repo.read_commit(remote_tip);
        restore_tree(repo, c.tree, "");
        std::cout << "Branch '" << branch_name << "' set up to track " << remote_name << "/" << branch_name << '\n';
        return 0;
    }

    if (*local_tip == remote_tip) {
        std::cout << "Already up-to-date.\n";
        return 0;
    }

    // Check fast-forward: is local_tip an ancestor of remote_tip?
    auto remote_log = repo.commit_log(remote_tip, 10000);
    bool can_ff = false;
    for (const auto& c : remote_log) {
        dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());
        if (h == *local_tip) { can_ff = true; break; }
    }

    if (can_ff) {
        repo.write_ref(local_ref, remote_tip);
        dragyou::Commit c = repo.read_commit(remote_tip);
        restore_tree(repo, c.tree, "");

        dragyou::Commit old_c = repo.read_commit(*local_tip);
        std::cout << "Updating " << local_tip->substr(0, 8) << ".." << remote_tip.substr(0, 8) << '\n';
        std::cout << "Fast-forward\n";
        return 0;
    }

    // Non-fast-forward: create a merge commit
    std::cout << "Merge: non-fast-forward detected\n";
    std::cout << "Auto-merging " << branch_name << " with " << remote_name << "/" << branch_name << '\n';

    // (Re-use the merge logic from cmd_merge.cpp — simplified here)
    // Create merge commit with both parents
    dragyou::Index idx(repo);
    idx.load();

    dragyou::Commit local_c  = repo.read_commit(*local_tip);
    dragyou::Commit remote_c = repo.read_commit(remote_tip);

    // For Phase 4: restore remote tree and let user resolve conflicts manually
    restore_tree(repo, remote_c.tree, "");

    dragyou::Hash new_tree = idx.write_tree();

    dragyou::Signature sig;
    sig.name      = repo.config().user_name.empty() ? "Unknown" : repo.config().user_name;
    sig.email     = repo.config().user_email.empty() ? "unknown@dragyou.vcs" : repo.config().user_email;
    sig.timestamp = static_cast<int64_t>(std::time(nullptr));

    dragyou::Commit merge;
    merge.tree      = new_tree;
    merge.parents   = {*local_tip, remote_tip};
    merge.author    = sig;
    merge.committer = sig;
    merge.message   = "Merge branch '" + branch_name + "' of " + remote_url;

    dragyou::Hash mh = repo.write_commit(merge);
    repo.write_ref(local_ref, mh);

    std::cout << "Merge commit " << mh.substr(0, 8) << ": " << merge.message << '\n';
    return 0;
}
