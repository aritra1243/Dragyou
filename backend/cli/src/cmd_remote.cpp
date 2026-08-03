// =============================================================================
//  nova remote — Manage remote repository references
//
//  Usage:
//    nova remote add <name> <url>      Add a remote
//    nova remote remove <name>         Remove a remote
//    nova remote list                  List all remotes
//    nova remote set-url <name> <url>  Update remote URL
// =============================================================================

#include "repository.h"

#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <string>

namespace fs = std::filesystem;

// Remotes stored in .nova/config under [remote "<name>"] sections
// Format:
//   [remote "origin"]
//   url = https://dragyou.io/alice/myrepo
//   fetch = +refs/heads/*:refs/remotes/origin/*

struct RemoteEntry {
    std::string name;
    std::string url;
    std::string fetch;
};

static std::map<std::string, RemoteEntry> read_remotes(const fs::path& config_path) {
    std::map<std::string, RemoteEntry> remotes;
    std::ifstream f(config_path);
    if (!f) return remotes;

    std::string line, cur_remote;
    while (std::getline(f, line)) {
        // Strip leading whitespace
        size_t start = line.find_first_not_of(" \t");
        if (start == std::string::npos) continue;
        line = line.substr(start);

        if (line.rfind("[remote \"", 0) == 0) {
            size_t end = line.find("\"", 9);
            cur_remote = line.substr(9, end - 9);
            remotes[cur_remote].name = cur_remote;
        } else if (!cur_remote.empty()) {
            auto eq = line.find('=');
            if (eq == std::string::npos) { cur_remote.clear(); continue; }
            std::string key   = line.substr(0, eq);
            std::string value = line.substr(eq + 1);
            // trim
            key.erase(key.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t"));
            if (key == "url")   remotes[cur_remote].url   = value;
            if (key == "fetch") remotes[cur_remote].fetch = value;
        }
    }
    return remotes;
}

static void write_remotes(const fs::path& config_path,
                          const std::map<std::string, RemoteEntry>& remotes,
                          const dragyou::RepoConfig& cfg) {
    std::ofstream f(config_path);
    // Write core config
    f << "name="   << cfg.user_name      << '\n';
    f << "email="  << cfg.user_email     << '\n';
    f << "branch=" << cfg.default_branch << '\n';
    f << '\n';
    // Write remotes
    for (auto& [name, r] : remotes) {
        f << "[remote \"" << name << "\"]\n";
        f << "\turl = " << r.url << '\n';
        if (!r.fetch.empty())
            f << "\tfetch = " << r.fetch << '\n';
        else
            f << "\tfetch = +refs/heads/*:refs/remotes/" << name << "/*\n";
        f << '\n';
    }
}

int cmd_remote(int argc, char** argv) {
    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova remote: not a Dragyou repository\n";
        return 1;
    }

    dragyou::Repository repo(*repo_root);
    auto remotes = read_remotes(repo.config_path());

    // nova remote  /  nova remote list
    if (argc <= 1 || std::string(argv[1]) == "list") {
        if (remotes.empty()) {
            std::cout << "No remotes configured.\n";
            return 0;
        }
        for (auto& [name, r] : remotes) {
            std::cout << name << "\t" << r.url << "\t(fetch)\n";
            std::cout << name << "\t" << r.url << "\t(push)\n";
        }
        return 0;
    }

    // nova remote add <name> <url>
    if (std::string(argv[1]) == "add") {
        if (argc < 4) {
            std::cerr << "Usage: nova remote add <name> <url>\n";
            return 1;
        }
        std::string name = argv[2];
        std::string url  = argv[3];
        if (remotes.count(name)) {
            std::cerr << "nova remote: remote '" << name << "' already exists\n";
            return 1;
        }
        remotes[name] = {name, url, ""};
        write_remotes(repo.config_path(), remotes, repo.config());
        std::cout << "Added remote '" << name << "' → " << url << '\n';
        return 0;
    }

    // nova remote remove <name>
    if (std::string(argv[1]) == "remove" || std::string(argv[1]) == "rm") {
        if (argc < 3) {
            std::cerr << "Usage: nova remote remove <name>\n";
            return 1;
        }
        std::string name = argv[2];
        if (!remotes.count(name)) {
            std::cerr << "nova remote: no remote named '" << name << "'\n";
            return 1;
        }
        remotes.erase(name);
        write_remotes(repo.config_path(), remotes, repo.config());
        std::cout << "Removed remote '" << name << "'\n";
        return 0;
    }

    // nova remote set-url <name> <url>
    if (std::string(argv[1]) == "set-url") {
        if (argc < 4) {
            std::cerr << "Usage: nova remote set-url <name> <url>\n";
            return 1;
        }
        std::string name = argv[2];
        std::string url  = argv[3];
        if (!remotes.count(name)) {
            std::cerr << "nova remote: no remote named '" << name << "'\n";
            return 1;
        }
        remotes[name].url = url;
        write_remotes(repo.config_path(), remotes, repo.config());
        std::cout << "Updated '" << name << "' → " << url << '\n';
        return 0;
    }

    std::cerr << "nova remote: unknown subcommand '" << argv[1] << "'\n";
    std::cerr << "Usage: nova remote [add|remove|list|set-url] ...\n";
    return 1;
}
