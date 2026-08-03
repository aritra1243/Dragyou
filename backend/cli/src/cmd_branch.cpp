// =============================================================================
//  nova branch — List or create branches
// =============================================================================

#include "repository.h"

#include <iostream>

static const char* RESET = "\033[0m";
static const char* GREEN = "\033[32m";
static const char* CYAN  = "\033[36m";

int cmd_branch(int argc, char** argv) {
    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova branch: not a Dragyou repository\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);

        // nova branch           → list
        // nova branch <name>    → create
        // nova branch -d <name> → delete

        if (argc == 1) {
            // List branches
            auto refs = repo.list_refs("refs/heads/");
            auto current = repo.current_branch();

            if (refs.empty()) {
                std::cout << "No branches yet. Commit something first.\n";
                return 0;
            }

            for (const auto& [ref, hash] : refs) {
                std::string name = ref.substr(ref.rfind('/') + 1);
                bool is_current = (current && *current == name);
                if (is_current) {
                    std::cout << GREEN << "* " << name << RESET;
                } else {
                    std::cout << "  " << name;
                }
                std::cout << "  " << CYAN << hash.substr(0, 8) << RESET << '\n';
            }
            return 0;
        }

        // Delete
        if (std::string(argv[1]) == "-d" || std::string(argv[1]) == "--delete") {
            if (argc < 3) {
                std::cerr << "Usage: nova branch -d <name>\n";
                return 1;
            }
            auto branch = repo.current_branch();
            if (branch && *branch == argv[2]) {
                std::cerr << "nova branch: cannot delete the currently checked-out branch '"
                          << argv[2] << "'\n";
                return 1;
            }
            repo.delete_ref(std::string("refs/heads/") + argv[2]);
            std::cout << "Deleted branch " << argv[2] << '\n';
            return 0;
        }

        // Create
        std::string name = argv[1];
        auto head = repo.resolve_HEAD();
        if (!head) {
            std::cerr << "nova branch: no commits yet, cannot create branch\n";
            return 1;
        }

        std::string ref = "refs/heads/" + name;
        if (repo.read_ref(ref)) {
            std::cerr << "nova branch: branch '" << name << "' already exists\n";
            return 1;
        }

        repo.write_ref(ref, *head);
        std::cout << "Created branch " << name << " at " << head->substr(0, 8) << '\n';
        return 0;

    } catch (const std::exception& e) {
        std::cerr << "nova branch: " << e.what() << '\n';
        return 1;
    }
}
