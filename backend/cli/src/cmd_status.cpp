// =============================================================================
//  nova status — Show working tree status
// =============================================================================

#include "repository.h"
#include "index.h"

#include <algorithm>
#include <filesystem>
#include <iostream>
#include <set>

static const char* RESET  = "\033[0m";
static const char* GREEN  = "\033[32m";
static const char* RED    = "\033[31m";
static const char* YELLOW = "\033[33m";
static const char* CYAN   = "\033[36m";

int cmd_status(int /*argc*/, char** /*argv*/) {
    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova status: not a Dragyou repository\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);
        dragyou::Index idx(repo);
        idx.load();

        // Print current branch
        auto branch = repo.current_branch();
        std::cout << "On branch " << CYAN
                  << (branch ? *branch : "(detached HEAD)") << RESET << '\n';

        auto head = repo.resolve_HEAD();
        if (!head) {
            std::cout << "\nNo commits yet\n\n";
        }

        auto entries = idx.status();

        using S = dragyou::Index::StatusEntry::State;

        // Categorize
        std::vector<std::string> index_staged;
        std::vector<std::string> index_modified;
        std::vector<std::string> index_deleted;
        std::vector<std::string> work_modified;
        std::vector<std::string> work_deleted;
        std::vector<std::string> untracked;

        for (const auto& e : entries) {
            if (e.index_state == S::Staged)   index_staged.push_back(e.path);
            if (e.index_state == S::Modified) index_modified.push_back(e.path);
            if (e.index_state == S::Deleted)  index_deleted.push_back(e.path);
            if (e.work_state  == S::Modified) work_modified.push_back(e.path);
            if (e.work_state  == S::Deleted)  work_deleted.push_back(e.path);
        }

        // Scan for untracked files
        std::set<std::string> indexed_paths;
        for (const auto& e : idx.entries()) indexed_paths.insert(e.path);

        namespace fs = std::filesystem;
        for (auto& de : fs::recursive_directory_iterator(*repo_root)) {
            if (!de.is_regular_file()) continue;
            std::string rel = fs::relative(de.path(), *repo_root).string();
            std::replace(rel.begin(), rel.end(), '\\', '/');
            if (rel.rfind(".nova/", 0) == 0) continue;
            if (indexed_paths.find(rel) == indexed_paths.end())
                untracked.push_back(rel);
        }

        if (index_staged.empty() && index_modified.empty() && index_deleted.empty() &&
            work_modified.empty() && work_deleted.empty() && untracked.empty()) {
            std::cout << "\nnothing to commit, working tree clean\n";
            return 0;
        }

        if (!index_staged.empty() || !index_modified.empty() || !index_deleted.empty()) {
            std::cout << "\nChanges staged for commit:\n";
            std::cout << "  (use \"nova commit -m <msg>\" to commit)\n\n";
            for (auto& p : index_staged)   std::cout << GREEN  << "  new file:  " << p << RESET << '\n';
            for (auto& p : index_modified) std::cout << GREEN  << "  modified:  " << p << RESET << '\n';
            for (auto& p : index_deleted)  std::cout << RED    << "  deleted:   " << p << RESET << '\n';
        }

        if (!work_modified.empty() || !work_deleted.empty()) {
            std::cout << "\nChanges not staged for commit:\n";
            std::cout << "  (use \"nova add <file>\" to update what will be committed)\n\n";
            for (auto& p : work_modified) std::cout << RED    << "  modified:  " << p << RESET << '\n';
            for (auto& p : work_deleted)  std::cout << RED    << "  deleted:   " << p << RESET << '\n';
        }

        if (!untracked.empty()) {
            std::cout << "\nUntracked files:\n";
            std::cout << "  (use \"nova add <file>\" to include in what will be committed)\n\n";
            for (auto& p : untracked) std::cout << YELLOW << "  " << p << RESET << '\n';
        }

        std::cout << '\n';
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "nova status: " << e.what() << '\n';
        return 1;
    }
}
