// =============================================================================
//  drag push — Push commits to a remote repository
//
//  Usage:
//    drag push [<remote>] [<branch>]
//    drag push origin main
//    drag push --force origin main
//
//  Protocol:
//    1. Read remote URL from .drag/config
//    2. POST /api/v1/repos/:owner/:repo/push/negotiate
//       → server tells us which objects it needs
//    3. POST /api/v1/repos/:owner/:repo/push/pack
//       → upload only missing objects
// =============================================================================

#include "repository.h"
#include "remote.h"
#include "http_client.h"

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <vector>

namespace fs = std::filesystem;

// get_remote_url and get_token are defined in http_client.cpp / http_client.h

// ── Main push command ────────────────────────────────────────────────────
int cmd_push(int argc, char** argv) {
    std::string remote_name;
    std::string branch_name;
    bool force = false;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--force" || a == "-f") { force = true; continue; }
        if (a[0] != '-') {
            if (remote_name.empty()) remote_name = a;
            else if (branch_name.empty()) branch_name = a;
        }
    }
    
    if (remote_name.empty()) remote_name = "origin";

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "drag push: not a Dragyou repository\n";
        return 1;
    }

    dragyou::Repository repo(*repo_root);

    // Get current branch if not specified
    if (branch_name.empty()) {
        auto branch = repo.current_branch();
        if (!branch) {
            std::cerr << "drag push: detached HEAD — specify a branch\n";
            return 1;
        }
        branch_name = *branch;
    }

    auto tip = repo.resolve_HEAD();
    if (!tip) {
        std::cerr << "drag push: nothing to push (no commits)\n";
        return 1;
    }

    std::string remote_url = get_remote_url(repo, remote_name);
    if (remote_url.empty()) {
        std::cerr << "drag push: no remote named '" << remote_name << "'\n";
        std::cerr << "  Use: drag remote add " << remote_name << " <url>\n";
        return 1;
    }

    std::string token = get_token(repo);
    if (token.empty()) {
        std::cerr << "drag push: not authenticated. Run 'drag login' first.\n";
        return 1;
    }

    // ── Step 1: Negotiate ────────────────────────────────────────────────
    std::cout << "Negotiating with " << remote_url << "...\n";

    // List all local object hashes (what we have)
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

    std::string negotiate_body =
        "{\"have\":" + json_array(have_list) +
        ",\"want\":[\"" + *tip + "\"]" +
        ",\"ref\":\"refs/heads/" + branch_name + "\"" +
        ",\"force\":" + (force ? "true" : "false") +
        "}";

    std::vector<uint8_t> neg_bytes(negotiate_body.begin(), negotiate_body.end());
    auto neg_url = remote_url + "/push/negotiate";
    auto neg_resp = http_post(neg_url, token, neg_bytes, "application/json");

    if (neg_resp.status == 401) {
        std::cerr << "drag push: authentication failed. Run 'drag login' again.\n";
        return 1;
    }
    if (neg_resp.status == 403) {
        std::cerr << "drag push: permission denied on " << remote_url << '\n';
        return 1;
    }
    if (neg_resp.status < 200 || neg_resp.status >= 300) {
        std::cerr << "drag push: negotiate failed (HTTP " << neg_resp.status << ")\n";
        std::cerr << neg_resp.body << '\n';
        return 1;
    }

    auto need_hashes = parse_json_string_array(neg_resp.body, "need");
    std::cout << "Objects to upload: " << need_hashes.size() << '\n';

    if (need_hashes.empty()) {
        std::cout << "Everything up-to-date.\n";
        return 0;
    }

    // ── Step 2: Build and upload pack ───────────────────────────────────
    dragyou::RemoteProtocol proto(repo);
    dragyou::Pack pack = proto.build_pack(need_hashes);
    auto pack_bytes = pack.serialize();

    std::cout << "Uploading pack (" << pack_bytes.size() / 1024 << " KB)...\n";

    // Build the ref and tip headers so the server can update the ref
    // after applying the pack.  X-Dragyou-Ref / X-Dragyou-Tip are read
    // in PushPack (remote.go).  http_post does not support extra headers
    // natively, so we embed them as part of the URL query — or better:
    // extend http_post.  For now encode them in a thin JSON wrapper sent
    // as a two-part multipart is over-complex; instead we rely on the
    // dedicated http_post_with_headers overload added in http_client.
    std::string ref_header = "refs/heads/" + branch_name;
    std::string tip_header = *tip;

    auto pack_url  = remote_url + "/push/pack";
    auto pack_resp = http_post_with_ref(pack_url, token, pack_bytes,
                                        "application/x-dragyou-pack",
                                        ref_header, tip_header);

    if (pack_resp.status < 200 || pack_resp.status >= 300) {
        std::cerr << "drag push: pack upload failed (HTTP " << pack_resp.status << ")\n";
        std::cerr << pack_resp.body << '\n';
        return 1;
    }

    std::cout << "✓ Pushed " << branch_name << " → " << remote_name << '\n';
    std::cout << "  " << tip->substr(0, 8) << " " << branch_name << " → " << remote_name << "/" << branch_name << '\n';
    return 0;
}
