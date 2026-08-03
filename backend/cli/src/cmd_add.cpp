// =============================================================================
//  nova add — Stage files for the next commit
// =============================================================================

#include "repository.h"
#include "index.h"

#include <filesystem>
#include <iostream>

int cmd_add(int argc, char** argv) {
    namespace fs = std::filesystem;

    if (argc < 2) {
        std::cerr << "Usage: nova add <file> [<file>...]\n";
        return 1;
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova add: not a Dragyou repository (no .nova/ found)\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);
        dragyou::Index idx(repo);
        idx.load();

        // Support "nova add ." to stage all modified files
        if (std::string(argv[1]) == ".") {
            int count = 0;
            for (auto& entry : fs::recursive_directory_iterator(*repo_root)) {
                if (!entry.is_regular_file()) continue;
                std::string rel = fs::relative(entry.path(), *repo_root).string();
                std::replace(rel.begin(), rel.end(), '\\', '/');
                // Skip .nova/
                if (rel.rfind(".nova/", 0) == 0 || rel == ".nova") continue;
                try {
                    idx.add(rel);
                    std::cout << "  staged: " << rel << '\n';
                    ++count;
                } catch (...) {}
            }
            std::cout << count << " file(s) staged.\n";
            return 0;
        }

        for (int i = 1; i < argc; ++i) {
            fs::path abs = fs::absolute(argv[i]);
            std::string rel = fs::relative(abs, *repo_root).string();
            std::replace(rel.begin(), rel.end(), '\\', '/');

            if (!fs::exists(abs)) {
                std::cerr << "nova add: pathspec '" << argv[i] << "' did not match any files\n";
                continue;
            }

            idx.add(rel);
            std::cout << "  staged: " << rel << '\n';
        }

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "nova add: " << e.what() << '\n';
        return 1;
    }
}
