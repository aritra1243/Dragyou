cmake_minimum_required(VERSION 3.20)
project(DragyouEngine VERSION 0.1.0 LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 20)

set(ENGINE_SOURCES
    src/blob.cpp
    src/tree.cpp
    src/commit.cpp
    src/repository.cpp
    src/index.cpp
    src/diff.cpp
    src/merge.cpp
    src/remote.cpp
    src/api.cpp
    src/pack.cpp
    third_party/miniz/miniz.c
    third_party/miniz/miniz_tdef.c
    third_party/miniz/miniz_tinfl.c
)
set_source_files_properties(
    third_party/miniz/miniz.c
    third_party/miniz/miniz_tdef.c
    third_party/miniz/miniz_tinfl.c
    PROPERTIES LANGUAGE CXX
)

set(ENGINE_HEADERS
    include/objects.h
    include/repository.h
    include/index.h
    include/diff.h
    include/merge.h
    include/remote.h
    include/dragyou_api.h
)

# Static library (linked into CLI and tests)
add_library(dragyou_engine_static STATIC ${ENGINE_SOURCES})
target_include_directories(dragyou_engine_static PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party/miniz
)
set_target_properties(dragyou_engine_static PROPERTIES OUTPUT_NAME "dragyou_engine")
add_library(dragyou_engine ALIAS dragyou_engine_static)

# Install headers
install(FILES ${ENGINE_HEADERS} DESTINATION include/dragyou)
install(TARGETS dragyou_engine_static
        LIBRARY DESTINATION lib
        ARCHIVE DESTINATION lib)
