// =============================================================================
//  drag log — Show commit history
// =============================================================================

#include "repository.h"

#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>

static std::string format_time(int64_t ts) {
    std::time_t t = static_cast<std::time_t>(ts);
    std::tm* tm = std::localtime(&t);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%a %b %d %H:%M:%S %Y", tm);
    return buf;
}

static const char* RESET  = "\033[0m";
static const char* YELLOW = "\033[33m";
static const char* CYAN   = "\033[36m";
static const char* WHITE  = "\033[97m";

int cmd_log(int argc, char** argv) {
    size_t max_count = 50;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if ((arg == "--max" || arg == "-n") && i + 1 < argc) {
            max_count = static_cast<size_t>(std::stoul(argv[++i]));
        }
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "drag log: not a Dragyou repository\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);
        auto head = repo.resolve_HEAD();
        if (!head) {
            std::cout << "No commits yet.\n";
            return 0;
        }

        auto branch = repo.current_branch();
        std::cout << "Branch: " << CYAN << (branch ? *branch : "(detached)") << RESET << "\n\n";

        auto commits = repo.commit_log(*head, max_count);
        if (commits.empty()) {
            std::cout << "No commits found.\n";
            return 0;
        }

        std::string current_hash = *head;
        for (const auto& c : commits) {
            dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());

            std::cout << YELLOW << "commit " << h << RESET;
            if (h == *head && branch) {
                std::cout << " " << CYAN << "(" << *branch << ")" << RESET;
            }
            std::cout << '\n';

            if (c.parents.size() > 1) {
                std::cout << "Merge:  ";
                for (auto& p : c.parents) std::cout << p.substr(0, 8) << " ";
                std::cout << '\n';
            }

            std::cout << "Author: " << WHITE << c.author.name << " <" << c.author.email << ">" << RESET << '\n';
            std::cout << "Date:   " << format_time(c.author.timestamp) << '\n';
            std::cout << '\n';

            // Indent message
            std::istringstream iss(c.message);
            std::string line;
            while (std::getline(iss, line)) {
                std::cout << "    " << line << '\n';
            }
            std::cout << '\n';
        }

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "drag log: " << e.what() << '\n';
        return 1;
    }
}
