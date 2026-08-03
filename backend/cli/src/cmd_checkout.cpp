// =============================================================================
//  nova checkout — Switch to a branch or commit
// =============================================================================

#include "repository.h"
#include "index.h"

#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>

int cmd_checkout(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: nova checkout <branch|commit>\n";
        return 1;
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova checkout: not a Dragyou repository\n";
        return 1;
    }

    std::string target = argv[1];

    try {
        dragyou::Repository repo(*repo_root);

        auto target_hash = repo.resolve_name(target);
        if (!target_hash) {
            std::cerr << "nova checkout: unknown branch or commit '" << target << "'\n";
            return 1;
        }

        dragyou::Commit c = repo.read_commit(*target_hash);

        // Restore files from the target tree
        std::function<void(const dragyou::Hash&, const std::string&)> restore =
            [&](const dragyou::Hash& tree_hash, const std::string& prefix) {
                dragyou::Tree t = repo.read_tree(tree_hash);
                for (const auto& e : t.entries) {
                    std::string full = prefix + e.name;
                    if (e.mode == "040000") {
                        std::filesystem::create_directories(repo.root() / full);
                        restore(e.hash, full + "/");
                    } else {
                        dragyou::Blob b = repo.read_blob(e.hash);
                        std::filesystem::path out_path = repo.root() / full;
                        std::filesystem::create_directories(out_path.parent_path());
                        std::ofstream f(out_path, std::ios::binary);
                        f.write(reinterpret_cast<const char*>(b.content.data()),
                                static_cast<std::streamsize>(b.content.size()));
                    }
                }
            };

        if (!c.tree.empty() && repo.object_exists(c.tree)) {
            restore(c.tree, "");
        }

        // Update HEAD
        std::string ref = "refs/heads/" + target;
        if (repo.read_ref(ref)) {
            repo.write_HEAD_ref(ref);
            std::cout << "Switched to branch '" << target << "'\n";
        } else {
            repo.write_HEAD_hash(*target_hash);
            std::cout << "HEAD is now at " << target_hash->substr(0, 8)
                      << " (detached)\n";
        }

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "nova checkout: " << e.what() << '\n';
        return 1;
    }
}
