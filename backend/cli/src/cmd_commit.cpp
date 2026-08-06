// =============================================================================
//  drag commit — Create a new commit
// =============================================================================

#include "repository.h"
#include "index.h"

#include <ctime>
#include <filesystem>
#include <iostream>

int cmd_commit(int argc, char** argv) {
    // Parse: drag commit -m "message"
    std::string message;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "-m" || arg == "--message") && i + 1 < argc) {
            message = argv[++i];
        }
    }

    if (message.empty()) {
        std::cerr << "Usage: drag commit -m <message>\n";
        return 1;
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "drag commit: not a Dragyou repository\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);
        dragyou::Index idx(repo);
        idx.load();

        if (idx.entries().empty()) {
            std::cerr << "drag commit: nothing to commit (use 'drag add' to stage files)\n";
            return 1;
        }

        // Build tree from index
        dragyou::Hash tree_hash = idx.write_tree();

        // Build commit object
        dragyou::Commit c;
        c.tree = tree_hash;

        auto head_hash = repo.resolve_HEAD();
        if (head_hash) c.parents.push_back(*head_hash);

        // Author from config
        const auto& cfg = repo.config();
        std::string name  = cfg.user_name.empty()  ? "Unknown"              : cfg.user_name;
        std::string email = cfg.user_email.empty() ? "unknown@dragyou.vcs" : cfg.user_email;

        dragyou::Signature sig;
        sig.name      = name;
        sig.email     = email;
        sig.timestamp = static_cast<int64_t>(std::time(nullptr));

        c.author    = sig;
        c.committer = sig;
        c.message   = message;

        dragyou::Hash commit_hash = repo.write_commit(c);

        // Update branch ref
        auto branch = repo.current_branch();
        if (branch) {
            repo.write_ref("refs/heads/" + *branch, commit_hash);
        } else {
            repo.write_HEAD_hash(commit_hash);
        }

        std::cout << "[" << (branch ? *branch : "(detached)") << " "
                  << commit_hash.substr(0, 8) << "] " << message << '\n';
        std::cout << " " << idx.entries().size() << " file(s) committed\n";

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "drag commit: " << e.what() << '\n';
        return 1;
    }
}
