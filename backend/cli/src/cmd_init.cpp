// =============================================================================
//  drag init — Initialize a new Dragyou repository
// =============================================================================

#include "repository.h"

#include <filesystem>
#include <iostream>

int cmd_init(int argc, char** argv) {
    namespace fs = std::filesystem;

    // drag init [path]
    fs::path target = (argc >= 2) ? fs::path(argv[1]) : fs::current_path();

    try {
        dragyou::Repository::init(target);
        std::cout << "Initialized empty Dragyou repository in "
                  << (target / ".drag").string() << '\n';
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "drag init: " << e.what() << '\n';
        return 1;
    }
}
