// =============================================================================
//  nova login — Authenticate with a Dragyou server
//
//  Usage:
//    nova login [<server-url>]
//    nova login https://dragyou.io
//
//  Stores the access token in .nova/credentials (repo-local)
//  and also in ~/.nova/credentials (global, for clone without a repo)
// =============================================================================

#include "repository.h"
#include "http_client.h"

#ifdef _WIN32
#include <windows.h>
#else
#include <termios.h>
#include <unistd.h>
#endif

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

namespace fs = std::filesystem;

static std::string get_input(const std::string& prompt, bool secret = false) {
    std::cout << prompt;
    std::cout.flush();
    std::string input;
    if (secret) {
        // Disable echo on Windows
#ifdef _WIN32
        HANDLE hStdin = GetStdHandle(STD_INPUT_HANDLE);
        DWORD mode = 0;
        GetConsoleMode(hStdin, &mode);
        SetConsoleMode(hStdin, mode & (~ENABLE_ECHO_INPUT));
        std::getline(std::cin, input);
        SetConsoleMode(hStdin, mode);
        std::cout << '\n';
#else
        // Unix: use termios
        struct termios oldt, newt;
        tcgetattr(STDIN_FILENO, &oldt);
        newt = oldt;
        newt.c_lflag &= ~ECHO;
        tcsetattr(STDIN_FILENO, TCSANOW, &newt);
        std::getline(std::cin, input);
        tcsetattr(STDIN_FILENO, TCSANOW, &oldt);
        std::cout << '\n';
#endif
    } else {
        std::getline(std::cin, input);
    }
    return input;
}

static void save_credentials(const std::string& server, const std::string& token,
                              const fs::path& cred_path) {
    fs::create_directories(cred_path.parent_path());
    // Read existing (other servers)
    std::string existing;
    if (fs::exists(cred_path)) {
        std::ifstream in(cred_path);
        std::string line;
        while (std::getline(in, line)) {
            if (line.rfind("server=", 0) == 0) {
                // check if next line is for this server — skip it
                std::string srv = line.substr(7);
                if (srv == server) continue;
            }
            existing += line + '\n';
        }
    }
    std::ofstream out(cred_path);
    out << existing;
    out << "server=" << server << '\n';
    out << "token="  << token  << '\n';

#ifndef _WIN32
    fs::permissions(cred_path, fs::perms::owner_read | fs::perms::owner_write);
#endif
}

int cmd_login(int argc, char** argv) {
    std::string server = "https://dragyou.io";
    if (argc >= 2 && std::string(argv[1])[0] != '-') {
        server = argv[1];
    }
    // Remove trailing slash
    while (!server.empty() && server.back() == '/') server.pop_back();

    std::cout << "Logging in to " << server << '\n';
    std::cout << "Enter your credentials:\n\n";

    std::string username = get_input("Username: ");
    std::string password = get_input("Password: ", true);

    // POST /api/v1/auth/login
    std::string body = "{\"username\":\"" + username + "\",\"password\":\"" + password + "\"}";
    std::vector<uint8_t> body_bytes(body.begin(), body.end());

    std::string login_url = server + "/api/v1/auth/login";
    auto resp = http_post(login_url, "", body_bytes, "application/json");

    if (resp.status == 401) {
        std::cerr << "\nnova login: invalid credentials\n";
        return 1;
    }
    if (resp.status < 200 || resp.status >= 300) {
        std::cerr << "\nnova login: server error (HTTP " << resp.status << ")\n";
        return 1;
    }

    // Parse token from JSON response
    std::string token;
    {
        const std::string key = "\"access_token\"";
        size_t pos = resp.body.find(key);
        if (pos != std::string::npos) {
            pos = resp.body.find(':', pos + key.size());
            if (pos != std::string::npos) {
                pos = resp.body.find('"', pos);
                if (pos != std::string::npos) {
                    pos += 1; // skip the quote
                    size_t end = resp.body.find('"', pos);
                    if (end != std::string::npos) {
                        token = resp.body.substr(pos, end - pos);
                    }
                }
            }
        }
    }

    if (token.empty()) {
        std::cerr << "\nnova login: could not parse token from response\n";
        return 1;
    }

    // Save to repo-local credentials if inside a repo
    auto repo_root = dragyou::Repository::discover();
    if (repo_root) {
        dragyou::Repository repo(*repo_root);
        save_credentials(server, token, repo.nova() / "credentials");
    }

    // Always save to global ~/.nova/credentials
    const char* home = std::getenv("USERPROFILE");
    if (!home) home = std::getenv("HOME");
    if (home) {
        save_credentials(server, token, fs::path(home) / ".nova" / "credentials");
    }

    std::cout << "\n✓ Logged in as " << username << " on " << server << '\n';
    std::cout << "  Token stored in credentials file\n";
    return 0;
}
