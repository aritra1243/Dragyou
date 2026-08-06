// =============================================================================
//  Dragyou VCS — drag CLI entry point
// =============================================================================

#include <cstring>
#include <iostream>
#include <string>

// Forward declarations of command handlers
int cmd_init    (int argc, char** argv);
int cmd_add     (int argc, char** argv);
int cmd_commit  (int argc, char** argv);
int cmd_status  (int argc, char** argv);
int cmd_log     (int argc, char** argv);
int cmd_branch  (int argc, char** argv);
int cmd_checkout(int argc, char** argv);
int cmd_diff    (int argc, char** argv);
int cmd_merge   (int argc, char** argv);
// Phase 4 — Remote operations
int cmd_remote  (int argc, char** argv);
int cmd_push    (int argc, char** argv);
int cmd_pull    (int argc, char** argv);
int cmd_clone   (int argc, char** argv);
int cmd_login   (int argc, char** argv);

static void print_usage() {
    std::cout << R"(
Drag - Dragyou Version Control System

Usage: drag <command> [options]

Local Commands:
  init                  Initialize a new repository in the current directory
  add <file>...         Stage files for the next commit  (use '.' for all)
  commit -m <msg>       Create a new commit
  status                Show working tree status
  log [--max <n>]       Show commit history
  branch [<name>]       List or create branches
  branch -d <name>      Delete a branch
  checkout <ref>        Switch to a branch or commit
  diff [<file>]         Show changes between working tree and index
  merge <branch>        Merge a branch into the current branch

Remote Commands:
  login [<server>]                  Authenticate with a Dragyou server
  remote add <name> <url>           Add a remote repository
  remote remove <name>              Remove a remote
  remote list                       List all remotes
  remote set-url <name> <url>       Change a remote URL
  push [<remote>] [<branch>]        Push commits to a remote
  pull [<remote>] [<branch>]        Pull commits from a remote
  clone [--depth <n>] <url> [<dir>] Clone a remote repository

Options:
  --help, -h            Show this help message
  --version             Show version information

Examples:
  drag init
  drag add src/main.cpp
  drag commit -m "initial commit"
  drag login https://dragyou.io
  drag remote add origin https://dragyou.io/alice/myrepo
  drag push origin main
  drag pull origin main
  drag clone https://dragyou.io/alice/myrepo
  drag clone --depth 1 https://dragyou.io/alice/huge-repo
)" << '\n';
}

static void print_version() {
    std::cout << "drag version 0.1.0 (Dragyou VCS)\n";
    std::cout << "Built with C++20, SHA-256, zlib compression\n";
    std::cout << "Remote protocol: object negotiation pack v1\n";
}

int main(int argc, char** argv) {
    if (argc < 2) {
        print_usage();
        return 0;
    }

    std::string cmd = argv[1];

    if (cmd == "--help" || cmd == "-h") { print_usage();   return 0; }
    if (cmd == "--version")             { print_version(); return 0; }

    // Local commands
    if (cmd == "init")     return cmd_init    (argc - 1, argv + 1);
    if (cmd == "add")      return cmd_add     (argc - 1, argv + 1);
    if (cmd == "commit")   return cmd_commit  (argc - 1, argv + 1);
    if (cmd == "status")   return cmd_status  (argc - 1, argv + 1);
    if (cmd == "log")      return cmd_log     (argc - 1, argv + 1);
    if (cmd == "branch")   return cmd_branch  (argc - 1, argv + 1);
    if (cmd == "checkout") return cmd_checkout(argc - 1, argv + 1);
    if (cmd == "diff")     return cmd_diff    (argc - 1, argv + 1);
    if (cmd == "merge")    return cmd_merge   (argc - 1, argv + 1);

    // Remote commands
    if (cmd == "login")    return cmd_login   (argc - 1, argv + 1);
    if (cmd == "remote")   return cmd_remote  (argc - 1, argv + 1);
    if (cmd == "push")     return cmd_push    (argc - 1, argv + 1);
    if (cmd == "pull")     return cmd_pull    (argc - 1, argv + 1);
    if (cmd == "clone")    return cmd_clone   (argc - 1, argv + 1);

    std::cerr << "drag: unknown command '" << cmd << "'\n";
    std::cerr << "Run 'drag --help' for usage.\n";
    return 1;
}

