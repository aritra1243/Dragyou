// =============================================================================
//  nova diff — Show changes between working tree and index
// =============================================================================

#include "repository.h"
#include "index.h"
#include "diff.h"

#include <filesystem>
#include <fstream>
#include <iostream>

static const char* RESET  = "\033[0m";
static const char* RED    = "\033[31m";
static const char* GREEN  = "\033[32m";
static const char* CYAN   = "\033[36m";
static const char* WHITE  = "\033[97m";

int cmd_diff(int argc, char** argv) {
    // nova diff [--staged] [<file>]
    bool staged = false;
    std::string specific_file;

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--staged" || arg == "--cached") staged = true;
        else if (arg[0] != '-') specific_file = arg;
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova diff: not a Dragyou repository\n";
        return 1;
    }

    try {
        dragyou::Repository repo(*repo_root);
        dragyou::Index idx(repo);
        idx.load();

        bool any_diff = false;

        for (const auto& e : idx.entries()) {
            if (!specific_file.empty() && e.path != specific_file) continue;

            std::string indexed_content;
            {
                dragyou::Blob b = repo.read_blob(e.hash);
                indexed_content = std::string(b.content.begin(), b.content.end());
            }

            std::string work_content;
            std::filesystem::path abs = repo.root() / e.path;
            if (std::filesystem::exists(abs)) {
                std::ifstream fin(abs, std::ios::binary);
                work_content = std::string(
                    (std::istreambuf_iterator<char>(fin)),
                    std::istreambuf_iterator<char>());
            }

            if (indexed_content == work_content) continue;
            any_diff = true;

            auto d = dragyou::diff_strings(indexed_content, work_content);
            std::string unified = d.to_unified("a/" + e.path, "b/" + e.path);

            // Print with colors
            for (auto& line : dragyou::split_lines(unified)) {
                if (line.rfind("---", 0) == 0 || line.rfind("+++", 0) == 0) {
                    std::cout << WHITE << line << RESET << '\n';
                } else if (line.rfind("@@", 0) == 0) {
                    std::cout << CYAN << line << RESET << '\n';
                } else if (!line.empty() && line[0] == '-') {
                    std::cout << RED << line << RESET << '\n';
                } else if (!line.empty() && line[0] == '+') {
                    std::cout << GREEN << line << RESET << '\n';
                } else {
                    std::cout << line << '\n';
                }
            }
        }

        if (!any_diff) {
            std::cout << "No changes.\n";
        }

        return 0;
    } catch (const std::exception& e) {
        std::cerr << "nova diff: " << e.what() << '\n';
        return 1;
    }
}
