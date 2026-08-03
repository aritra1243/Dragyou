#pragma once
// =============================================================================
//  Dragyou VCS — Object Model
//  Content-addressable storage: Blob, Tree, Commit, Tag
//  SHA-256 based (not SHA-1 like Git)
// =============================================================================

#include <array>
#include <cstdint>
#include <ctime>
#include <optional>
#include <string>
#include <vector>

namespace dragyou {

// --------------------------------------------------------------------------
//  SHA-256 hash type  (64 hex chars)
// --------------------------------------------------------------------------
using Hash = std::string;  // 64-char lowercase hex string

constexpr size_t HASH_HEX_LEN = 64;
constexpr size_t HASH_BYTES   = 32;

// --------------------------------------------------------------------------
//  Object types
// --------------------------------------------------------------------------
enum class ObjectType : uint8_t {
    Blob   = 1,
    Tree   = 2,
    Commit = 3,
    Tag    = 4,
};

std::string object_type_str(ObjectType t);
ObjectType  object_type_from_str(const std::string& s);

// --------------------------------------------------------------------------
//  Raw object (as stored on disk)
// --------------------------------------------------------------------------
struct RawObject {
    ObjectType          type;
    std::vector<uint8_t> data;   // uncompressed content
};

// --------------------------------------------------------------------------
//  Blob — raw file content
//
//  Serialized format:
//    blob <size>\0<raw bytes>
// --------------------------------------------------------------------------
struct Blob {
    std::vector<uint8_t> content;

    std::vector<uint8_t> serialize() const;
    static Blob          deserialize(const std::vector<uint8_t>& raw);
};

// --------------------------------------------------------------------------
//  Tree — directory listing
//
//  Serialized format (one entry per line, null-separated like Git):
//    <mode> <name>\0<20-byte binary hash>   (we use 32 bytes for SHA-256)
//
//  Modes:
//    100644 — regular file
//    100755 — executable
//    040000 — directory (subtree)
//    120000 — symlink
// --------------------------------------------------------------------------
struct TreeEntry {
    std::string mode;   // "100644", "040000", etc.
    std::string name;
    Hash        hash;   // points to a Blob or another Tree
};

struct Tree {
    std::vector<TreeEntry> entries;

    std::vector<uint8_t> serialize() const;
    static Tree          deserialize(const std::vector<uint8_t>& raw);
};

// --------------------------------------------------------------------------
//  Commit
//
//  Serialized format (text, like Git):
//    tree <hash>\n
//    [parent <hash>\n]...
//    author <name> <email> <timestamp> <tz>\n
//    committer <name> <email> <timestamp> <tz>\n
//    \n
//    <message>
// --------------------------------------------------------------------------
struct Signature {
    std::string name;
    std::string email;
    int64_t     timestamp = 0;  // Unix epoch seconds
    int         tz_offset = 0;  // minutes from UTC
};

struct Commit {
    Hash                  tree;
    std::vector<Hash>     parents;   // 0 = root, 1 = normal, 2 = merge
    Signature             author;
    Signature             committer;
    std::string           message;

    std::vector<uint8_t>  serialize() const;
    static Commit         deserialize(const std::vector<uint8_t>& raw);
};

// --------------------------------------------------------------------------
//  Tag (annotated)
// --------------------------------------------------------------------------
struct Tag {
    Hash        object;       // points to any object (usually a Commit)
    ObjectType  object_type;
    std::string tag_name;
    Signature   tagger;
    std::string message;

    std::vector<uint8_t> serialize() const;
    static Tag           deserialize(const std::vector<uint8_t>& raw);
};

// --------------------------------------------------------------------------
//  Hash utilities
// --------------------------------------------------------------------------
Hash sha256_of_bytes(const std::vector<uint8_t>& data);
Hash sha256_of_string(const std::string& s);

// Hash an object with its type header (like Git's "blob <size>\0...")
Hash hash_object(ObjectType type, const std::vector<uint8_t>& content);

}  // namespace dragyou
