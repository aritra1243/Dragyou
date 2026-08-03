// =============================================================================
//  Dragyou VCS — Staging Index implementation
// =============================================================================

#include "index.h"
#include "diff.h"

#include <algorithm>
#include <cassert>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <functional>
#include <map>
#include <stdexcept>

namespace dragyou {

namespace fs = std::filesystem;

// --------------------------------------------------------------------------
//  Big-endian I/O helpers
// --------------------------------------------------------------------------
static void write_be64(std::ostream& out, uint64_t v) {
    for (int i = 7; i >= 0; --i)
        out.put(static_cast<char>((v >> (i * 8)) & 0xFF));
}
static void write_be32(std::ostream& out, uint32_t v) {
    for (int i = 3; i >= 0; --i)
        out.put(static_cast<char>((v >> (i * 8)) & 0xFF));
}
static void write_be16(std::ostream& out, uint16_t v) {
    out.put(static_cast<char>((v >> 8) & 0xFF));
    out.put(static_cast<char>(v & 0xFF));
}

static uint64_t read_be64(std::istream& in) {
    uint64_t v = 0;
    for (int i = 0; i < 8; ++i) v = (v << 8) | static_cast<uint8_t>(in.get());
    return v;
}
static uint32_t read_be32(std::istream& in) {
    uint32_t v = 0;
    for (int i = 0; i < 4; ++i) v = (v << 8) | static_cast<uint8_t>(in.get());
    return v;
}
static uint16_t read_be16(std::istream& in) {
    uint16_t v = 0;
    for (int i = 0; i < 2; ++i) v = (v << 8) | static_cast<uint8_t>(in.get());
    return v;
}

// --------------------------------------------------------------------------
Index::Index(Repository& repo) : repo_(repo) {}

void Index::load() {
    entries_.clear();
    fs::path p = repo_.index_path();
    if (!fs::exists(p)) return;

    std::ifstream f(p, std::ios::binary);
    if (!f) return;

    // Magic
    char magic[8];
    f.read(magic, 8);
    // Version
    uint32_t ver = read_be32(f);
    if (ver != VERSION) throw std::runtime_error("Unsupported index version");
    // Entry count
    uint32_t count = read_be32(f);

    for (uint32_t i = 0; i < count; ++i) {
        IndexEntry e;
        e.ctime_sec  = static_cast<int64_t>(read_be64(f));
        e.mtime_sec  = static_cast<int64_t>(read_be64(f));
        e.file_size  = read_be64(f);
        e.mode       = read_be32(f);
        e.flags      = read_be16(f);

        uint8_t hash_len = static_cast<uint8_t>(f.get());
        std::string hash(hash_len, '\0');
        f.read(hash.data(), hash_len);
        e.hash = hash;

        uint16_t path_len = read_be16(f);
        std::string path(path_len, '\0');
        f.read(path.data(), path_len);
        e.path = path;

        // Padding to 8-byte alignment
        size_t entry_size = 8+8+8+4+2+1+hash_len+2+path_len;
        size_t pad = (8 - (entry_size % 8)) % 8;
        for (size_t j = 0; j < pad; ++j) f.get();

        entries_.push_back(std::move(e));
    }
}

void Index::save() const {
    fs::path p = repo_.index_path();
    std::ofstream f(p, std::ios::binary);
    if (!f) throw std::runtime_error("Cannot write index: " + p.string());

    // Magic
    f.write(MAGIC.data(), 8);
    // Version
    write_be32(f, VERSION);
    // Count
    write_be32(f, static_cast<uint32_t>(entries_.size()));

    for (const auto& e : entries_) {
        write_be64(f, static_cast<uint64_t>(e.ctime_sec));
        write_be64(f, static_cast<uint64_t>(e.mtime_sec));
        write_be64(f, e.file_size);
        write_be32(f, e.mode);
        write_be16(f, e.flags);

        uint8_t hash_len = static_cast<uint8_t>(e.hash.size());
        f.put(static_cast<char>(hash_len));
        f.write(e.hash.data(), hash_len);

        uint16_t path_len = static_cast<uint16_t>(e.path.size());
        write_be16(f, path_len);
        f.write(e.path.data(), path_len);

        // Padding
        size_t entry_size = 8+8+8+4+2+1+hash_len+2+path_len;
        size_t pad = (8 - (entry_size % 8)) % 8;
        for (size_t j = 0; j < pad; ++j) f.put('\0');
    }
}

void Index::add(const std::string& rel_path) {
    fs::path abs = repo_.root() / rel_path;
    if (!fs::exists(abs))
        throw std::runtime_error("File not found: " + abs.string());

    // Read file content
    std::ifstream fin(abs, std::ios::binary);
    std::vector<uint8_t> content(
        (std::istreambuf_iterator<char>(fin)),
        std::istreambuf_iterator<char>());

    // Write blob object
    Blob blob{content};
    Hash h = repo_.write_blob(blob);

    // Build entry
    IndexEntry e;
    e.hash      = h;
    e.file_size = content.size();
    e.mode      = 0100644;

    // Use forward slashes in stored path
    std::string stored_path = rel_path;
    std::replace(stored_path.begin(), stored_path.end(), '\\', '/');
    e.path = stored_path;

    auto fs_stat = fs::last_write_time(abs);
    auto dur = fs_stat.time_since_epoch();
    e.mtime_sec = std::chrono::duration_cast<std::chrono::seconds>(dur).count();
    e.ctime_sec = e.mtime_sec;

    // Remove existing entry for this path (update)
    entries_.erase(
        std::remove_if(entries_.begin(), entries_.end(),
                       [&](const IndexEntry& ex){ return ex.path == stored_path; }),
        entries_.end());

    entries_.push_back(std::move(e));

    // Keep sorted by path
    std::sort(entries_.begin(), entries_.end(),
              [](const IndexEntry& a, const IndexEntry& b){ return a.path < b.path; });

    save();
}

void Index::remove(const std::string& rel_path) {
    std::string stored_path = rel_path;
    std::replace(stored_path.begin(), stored_path.end(), '\\', '/');
    entries_.erase(
        std::remove_if(entries_.begin(), entries_.end(),
                       [&](const IndexEntry& e){ return e.path == stored_path; }),
        entries_.end());
    save();
}

// ---- Tree building -------------------------------------------------------
Hash Index::write_tree() {
    return build_tree(entries_, "");
}

Hash Index::build_tree(const std::vector<IndexEntry>& flat, const std::string& prefix) {
    // Collect direct children
    // Key: first path component after prefix
    std::map<std::string, std::vector<IndexEntry>> groups;

    for (const auto& e : flat) {
        if (!prefix.empty() && e.path.rfind(prefix, 0) != 0) continue;
        std::string rel = prefix.empty() ? e.path : e.path.substr(prefix.size());
        if (rel.empty()) continue;

        size_t slash = rel.find('/');
        if (slash == std::string::npos) {
            // Direct file child
            groups[rel].push_back(e);
        } else {
            // Subdirectory
            std::string dir = rel.substr(0, slash);
            groups[dir].push_back(e);
        }
    }

    Tree tree;
    for (auto& [name, children] : groups) {
        std::string new_prefix = prefix + name;
        if (children.size() == 1 && children[0].path == new_prefix) {
            // It's a file
            tree.entries.push_back({"100644", name, children[0].hash});
        } else {
            // It's a directory → recurse
            new_prefix += "/";
            Hash sub_hash = build_tree(flat, new_prefix);
            tree.entries.push_back({"040000", name, sub_hash});
        }
    }

    return repo_.write_tree(tree);
}

// ---- Status --------------------------------------------------------------
std::vector<std::pair<std::string, Hash>> Index::head_tree_entries() const {
    auto head_hash = repo_.resolve_HEAD();
    if (!head_hash) return {};

    // Walk the tree recursively
    std::vector<std::pair<std::string, Hash>> result;
    std::function<void(const Hash&, const std::string&)> walk =
        [&](const Hash& tree_hash, const std::string& prefix) {
            Tree t = repo_.read_tree(tree_hash);
            for (const auto& e : t.entries) {
                std::string full = prefix + e.name;
                if (e.mode == "040000") {
                    walk(e.hash, full + "/");
                } else {
                    result.emplace_back(full, e.hash);
                }
            }
        };

    Commit c = repo_.read_commit(*head_hash);
    if (!c.tree.empty() && repo_.object_exists(c.tree))
        walk(c.tree, "");
    return result;
}

std::vector<Index::StatusEntry> Index::status() const {
    std::vector<StatusEntry> result;

    // Build maps
    std::map<std::string, Hash> head_files;
    for (auto& [p, h] : head_tree_entries()) head_files[p] = h;

    std::map<std::string, const IndexEntry*> index_map;
    for (const auto& e : entries_) index_map[e.path] = &e;

    // Check index vs HEAD
    for (const auto& e : entries_) {
        StatusEntry se;
        se.path = e.path;
        auto it = head_files.find(e.path);
        if (it == head_files.end()) {
            se.index_state = StatusEntry::State::Staged;
        } else if (it->second != e.hash) {
            se.index_state = StatusEntry::State::Modified;
        } else {
            se.index_state = StatusEntry::State::Unchanged;
        }

        // Check working tree vs index
        fs::path abs = repo_.root() / e.path;
        if (!fs::exists(abs)) {
            se.work_state = StatusEntry::State::Deleted;
        } else {
            std::ifstream fin(abs, std::ios::binary);
            std::vector<uint8_t> content(
                (std::istreambuf_iterator<char>(fin)),
                std::istreambuf_iterator<char>());
            Hash wh = hash_object(ObjectType::Blob, content);
            se.work_state = (wh == e.hash) ? StatusEntry::State::Unchanged
                                            : StatusEntry::State::Modified;
        }
        result.push_back(se);
    }

    // Check HEAD files that are not in index (deleted)
    for (auto& [p, h] : head_files) {
        if (index_map.find(p) == index_map.end()) {
            StatusEntry se;
            se.path = p;
            se.index_state = StatusEntry::State::Deleted;
            result.push_back(se);
        }
    }

    return result;
}

}  // namespace dragyou
