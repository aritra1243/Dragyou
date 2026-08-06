// =============================================================================
//  drag clone — Clone a remote repository (virtual/shallow clone)
//
//  Usage:
//    drag clone <url> [<directory>]
//    drag clone https://dragyou.io/alice/myrepo
//    drag clone https://dragyou.io/alice/myrepo ./local-name
//    drag clone --depth 1 <url>      (shallow: 1 commit only)
//
//  Design (virtual clone):
//    - Downloads only commit graph + tree metadata (~50-200MB)
//    - Blobs are fetched lazily when files are accessed
//    - Creates a full .drag/ structure locally
// =============================================================================

#include "repository.h"
#include "remote.h"
#include "http_client.h"

#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <string>

namespace fs = std::filesystem;

// ── Restore full working tree from tree hash ─────────────────────────────
static void restore_tree(dragyou::Repository& repo, const dragyou::Hash& tree_hash,
                          const std::string& prefix) {
    if (tree_hash.empty() || !repo.object_exists(tree_hash)) return;
    dragyou::Tree t = repo.read_tree(tree_hash);
    for (const auto& e : t.entries) {
        std::string full = prefix + e.name;
        if (e.mode == "040000") {
            fs::create_directories(repo.root() / full);
            restore_tree(repo, e.hash, full + "/");
        } else {
            if (!repo.object_exists(e.hash)) continue;
            dragyou::Blob b = repo.read_blob(e.hash);
            fs::path out_path = repo.root() / full;
            fs::create_directories(out_path.parent_path());
            std::ofstream f(out_path, std::ios::binary);
            f.write(reinterpret_cast<const char*>(b.content.data()),
                    static_cast<std::streamsize>(b.content.size()));
        }
    }
}

// ── Derive repo name from URL ────────────────────────────────────────────
static std::string url_to_dirname(const std::string& url) {
    std::string s = url;
    // Remove trailing .drag or /
    if (s.size() >= 5 && s.substr(s.size() - 5) == ".drag") s = s.substr(0, s.size() - 5);
    while (!s.empty() && (s.back() == '/' || s.back() == '\\')) s.pop_back();
    size_t pos = s.rfind('/');
    if (pos != std::string::npos) s = s.substr(pos + 1);
    return s.empty() ? "repo" : s;
}

int cmd_clone(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: drag clone [--depth <n>] <url> [<directory>]\n";
        return 1;
    }

    std::string url;
    std::string dest;
    int depth = 0;

    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if ((a == "--depth" || a == "-d") && i + 1 < argc) {
            depth = std::stoi(argv[++i]);
        } else if (a[0] != '-' && url.empty()) {
            url = a;
        } else if (a[0] != '-') {
            dest = a;
        }
    }

    if (url.empty()) {
        std::cerr << "drag clone: URL required\n";
        return 1;
    }

    if (dest.empty()) dest = url_to_dirname(url);

    fs::path dest_path = fs::absolute(dest);
    if (fs::exists(dest_path)) {
        std::cerr << "drag clone: destination '" << dest << "' already exists\n";
        return 1;
    }

    std::cout << "Cloning into '" << dest << "'...\n";

    // ── Step 1: Request clone manifest ───────────────────────────────────
    // Token optional (for private repos)
    std::string token;
    {
        // Try to find any token in ~/.drag/credentials or system config
        fs::path home = fs::path(std::getenv("USERPROFILE") ? std::getenv("USERPROFILE") :
                                                               std::getenv("HOME"));
        fs::path cred = home / ".drag" / "credentials";
        if (fs::exists(cred)) {
            std::ifstream f(cred);
            std::string line;
            while (std::getline(f, line))
                if (line.rfind("token=", 0) == 0) { token = line.substr(6); break; }
        }
    }

    std::string clone_body =
        "{\"depth\":" + std::to_string(depth) + "}";
    std::vector<uint8_t> cb(clone_body.begin(), clone_body.end());

    std::string clone_url = url;
    // Append /clone endpoint
    if (clone_url.back() != '/') clone_url += '/';
    clone_url += "clone";

    // We need an HTTP GET-like behavior; use POST with empty body for simplicity
    auto resp = http_post(clone_url, token, cb, "application/json");

    if (resp.status == 401) {
        std::cerr << "drag clone: authentication required. Run 'drag login' first.\n";
        return 1;
    }
    if (resp.status == 404) {
        std::cerr << "drag clone: repository not found at " << url << '\n';
        return 1;
    }
    if (resp.status < 200 || resp.status >= 300) {
        std::cerr << "drag clone: server error (HTTP " << resp.status << ")\n";
        std::cerr << resp.body << '\n';
        return 1;
    }

    // ── Step 2: Parse received pack ────────────────────────────────────
    std::vector<uint8_t> pack_bytes(resp.body.begin(), resp.body.end());
    dragyou::Pack pack;
    try {
        pack = dragyou::Pack::deserialize(pack_bytes);
    } catch (const std::exception& e) {
        std::cerr << "drag clone: invalid pack data: " << e.what() << '\n';
        return 1;
    }

    // ── Step 3: Create local repo ────────────────────────────────────────
    fs::create_directories(dest_path);
    dragyou::Repository::init(dest_path);
    dragyou::Repository repo(dest_path);

    // Store remote config
    {
        std::ofstream f(repo.config_path(), std::ios::app);
        f << "\n[remote \"origin\"]\n";
        f << "\turl = " << url << "\n";
        f << "\tfetch = +refs/heads/*:refs/remotes/origin/*\n";
    }

    // ── Step 4: Apply pack to object store ────────────────────────────────
    dragyou::RemoteProtocol proto(repo);
    proto.apply_pack(pack);

    std::cout << "Received " << pack.entries.size() << " objects\n";

    // ── Step 5: Find HEAD commit ──────────────────────────────────────────
    // Find the most recent commit in the pack
    dragyou::Hash tip;
    for (auto it = pack.entries.rbegin(); it != pack.entries.rend(); ++it) {
        if (it->type == dragyou::ObjectType::Commit) {
            tip = it->hash;
            break;
        }
    }

    if (tip.empty()) {
        std::cerr << "drag clone: no commits found in pack (empty repository?)\n";
        // Initialize as empty repo — that's fine
        std::cout << "Cloned empty repository.\n";
        return 0;
    }

    // Update refs/heads/main
    std::string default_branch = "main";
    repo.write_ref("refs/heads/" + default_branch, tip);
    repo.write_HEAD_ref("refs/heads/" + default_branch);

    // ── Step 6: Restore working tree ────────────────────────────────────
    dragyou::Commit c = repo.read_commit(tip);
    if (!c.tree.empty()) {
        restore_tree(repo, c.tree, "");
    }

    // Write remote tracking ref
    repo.write_ref("refs/remotes/origin/" + default_branch, tip);

    std::cout << '\n';
    std::cout << "✓ Cloned " << url << '\n';
    std::cout << "  Branch: " << default_branch << '\n';
    std::cout << "  HEAD:   " << tip.substr(0, 8) << '\n';
    if (depth > 0) {
        std::cout << "  Depth:  " << depth << " commit(s) (shallow clone)\n";
    }
    std::cout << "\nDone. Enter: cd " << dest << '\n';
    return 0;
}
