cmake_minimum_required(VERSION 3.20)
project(DragyouCLI VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)

set(CLI_SOURCES
    src/main.cpp
    src/cmd_init.cpp
    src/cmd_add.cpp
    src/cmd_commit.cpp
    src/cmd_status.cpp
    src/cmd_log.cpp
    src/cmd_branch.cpp
    src/cmd_checkout.cpp
    src/cmd_diff.cpp
    src/cmd_merge.cpp
    # Phase 4 — Remote protocol
    src/http_client.cpp
    src/cmd_remote.cpp
    src/cmd_push.cpp
    src/cmd_pull.cpp
    src/cmd_clone.cpp
    src/cmd_login.cpp
)

add_executable(drag ${CLI_SOURCES})

target_include_directories(drag PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../engine/include
    ${CMAKE_CURRENT_SOURCE_DIR}/../engine/third_party
)

target_link_libraries(drag PRIVATE dragyou_engine_static)

# Platform-specific HTTP libraries
if(WIN32)
    target_link_libraries(drag PRIVATE winhttp)
else()
    find_package(CURL REQUIRED)
    target_link_libraries(drag PRIVATE CURL::libcurl)
endif()

install(TARGETS drag DESTINATION bin)
