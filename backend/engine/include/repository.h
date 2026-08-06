#pragma once
// =============================================================================
//  Dragyou VCS — Repository
//  Manages .drag/ directory: object store, refs, HEAD, config
// =============================================================================

#include "objects.h"

#include <filesystem>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace dragyou {

namespace fs = std::filesystem;

// --------------------------------------------------------------------------
//  Repository config (stored in .drag/config)
// --------------------------------------------------------------------------
struct RepoConfig {
    std::string user_name;
    std::string user_email;
    std::string default_branch = "main";

    void load(const fs::path& config_path);
    void save(const fs::path& config_path) const;
};

// --------------------------------------------------------------------------
//  Repository
//
//  Directory layout:
//    <root>/
//      .drag/
//        HEAD          — "ref: refs/heads/main"  or bare hash
//        config        — INI-style config
//        index         — staging area (binary)
//        objects/
//          ab/
//            cdef12...  — zlib-compressed RawObject
//        refs/
//          heads/
//            main       — 64-char hash\n
//          tags/
// --------------------------------------------------------------------------
class Repository {
public:
    // ---- Lifecycle --------------------------------------------------------
    explicit Repository(const fs::path& root);

    /// Create a new .drag/ directory at the given path.
    static void init(const fs::path& root);

    /// Find the repository root by walking up from cwd.
    static std::optional<fs::path> discover(const fs::path& start = fs::current_path());

    // ---- Object store -----------------------------------------------------
    Hash        write_object(ObjectType type, const std::vector<uint8_t>& content);
    RawObject   read_object(const Hash& hash) const;

    // Typed helpers
    Hash  write_blob(const Blob& b);
    Hash  write_tree(const Tree& t);
    Hash  write_commit(const Commit& c);

    Blob   read_blob(const Hash& h)   const;
    Tree   read_tree(const Hash& h)   const;
    Commit read_commit(const Hash& h) const;

    bool object_exists(const Hash& hash) const;

    // ---- Refs -------------------------------------------------------------
    /// Read a ref (e.g. "refs/heads/main") → hash, or nullopt
    std::optional<Hash> read_ref(const std::string& ref) const;

    /// Write a ref
    void write_ref(const std::string& ref, const Hash& hash);

    /// Delete a ref
    void delete_ref(const std::string& ref);

    /// List all refs under a prefix (e.g. "refs/heads/")
    std::vector<std::pair<std::string, Hash>> list_refs(const std::string& prefix = "refs/") const;

    // ---- HEAD -------------------------------------------------------------
    /// Returns "ref: refs/heads/main" or a bare hash (detached HEAD)
    std::string read_HEAD() const;

    /// Set HEAD to a symbolic ref
    void write_HEAD_ref(const std::string& ref);

    /// Set HEAD to a bare hash (detached)
    void write_HEAD_hash(const Hash& hash);

    /// Resolve HEAD to a commit hash (follows symbolic refs)
    std::optional<Hash> resolve_HEAD() const;

    /// Get the current branch name, or nullopt if detached
    std::optional<std::string> current_branch() const;

    // ---- Paths ------------------------------------------------------------
    const fs::path& root()    const { return root_; }
    const fs::path& drag()    const { return drag_; }
    const fs::path& drag()    const { return drag_; }
    fs::path objects_dir()    const { return drag_ / "objects"; }
    fs::path refs_dir()       const { return drag_ / "refs"; }
    fs::path index_path()     const { return drag_ / "index"; }
    fs::path config_path()    const { return drag_ / "config"; }
    fs::path HEAD_path()      const { return drag_ / "HEAD"; }

    // ---- Config -----------------------------------------------------------
    RepoConfig& config()             { return config_; }
    const RepoConfig& config() const { return config_; }

    // ---- Commit utilities -------------------------------------------------
    /// Walk commit history from a given commit hash, return ordered list
    std::vector<Commit> commit_log(const Hash& start, size_t max = 1000) const;

    /// Resolve a ref/branch name or partial hash to a full hash
    std::optional<Hash> resolve_name(const std::string& name) const;

    fs::path object_path(const Hash& hash) const;

private:
    fs::path   root_;
    fs::path   drag_;
    RepoConfig config_;
};

}  // namespace dragyou
