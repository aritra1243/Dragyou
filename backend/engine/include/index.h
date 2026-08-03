#pragma once
// =============================================================================
//  Dragyou VCS — Staging Index
//  The index (.nova/index) tracks staged files.
//  Binary format:
//    Magic: "DNYIDX\0\0" (8 bytes)
//    Version: uint32_t (4 bytes, big-endian) = 1
//    Entry count: uint32_t
//    Entries: variable
//    Checksum: SHA-256 of all preceding bytes (32 bytes)
//
//  Each entry:
//    ctime_sec:   int64_t
//    mtime_sec:   int64_t
//    file_size:   uint64_t
//    mode:        uint32_t  (e.g. 0100644)
//    flags:       uint16_t
//    hash_len:    uint8_t   (= 64, for the hex SHA-256)
//    hash:        char[64]
//    path_len:    uint16_t
//    path:        char[path_len]  (relative to repo root, UTF-8)
//    padding:     to align to 8 bytes
// =============================================================================

#include "objects.h"
#include "repository.h"

#include <filesystem>
#include <string>
#include <vector>

namespace dragyou {

namespace fs = std::filesystem;

// --------------------------------------------------------------------------
//  Index entry
// --------------------------------------------------------------------------
struct IndexEntry {
    int64_t     ctime_sec  = 0;
    int64_t     mtime_sec  = 0;
    uint64_t    file_size  = 0;
    uint32_t    mode       = 0100644;   // octal: regular file
    uint16_t    flags      = 0;
    Hash        hash;          // 64-char hex SHA-256
    std::string path;          // relative to repo root

    bool operator==(const IndexEntry& o) const { return path == o.path; }
};

// --------------------------------------------------------------------------
//  Index
// --------------------------------------------------------------------------
class Index {
public:
    explicit Index(Repository& repo);

    // ---- I/O --------------------------------------------------------------
    void load();
    void save() const;

    // ---- Staging ----------------------------------------------------------
    /// Stage a file from the working tree.  path is relative to repo root.
    void add(const std::string& rel_path);

    /// Remove a file from the index (does not delete from disk).
    void remove(const std::string& rel_path);

    /// Return all entries.
    const std::vector<IndexEntry>& entries() const { return entries_; }

    // ---- Tree building ----------------------------------------------------
    /// Write the current index as a Tree object hierarchy and return root hash.
    Hash write_tree();

    // ---- Status -----------------------------------------------------------
    struct StatusEntry {
        enum class State {
            Staged,       // in index, not in HEAD (new file)
            Modified,     // in both, hash differs (modified)
            Deleted,      // in HEAD but not index
            Untracked,    // on disk but not in index
            Unchanged,    // same in index and working tree
        };
        std::string path;
        State       index_state  = State::Unchanged;
        State       work_state   = State::Unchanged;
    };

    std::vector<StatusEntry> status() const;

private:
    Repository&             repo_;
    std::vector<IndexEntry> entries_;

    static constexpr std::array<char, 8> MAGIC = {'D','N','Y','I','D','X','\0','\0'};
    static constexpr uint32_t VERSION = 1;

    /// Build a Tree from the given entries (recursive for subdirs).
    Hash build_tree(const std::vector<IndexEntry>& flat_entries, const std::string& prefix);

    /// Get all entry paths from HEAD commit tree (flattened).
    std::vector<std::pair<std::string, Hash>> head_tree_entries() const;
};

}  // namespace dragyou
