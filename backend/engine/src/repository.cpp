// =============================================================================
//  Dragyou VCS — Repository implementation
//  Manages .drag/ directory, object store, refs, HEAD
// =============================================================================

#include "repository.h"

#include "miniz.h"
#include <cassert>
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <algorithm>

namespace dragyou {

// --------------------------------------------------------------------------
//  RepoConfig
// --------------------------------------------------------------------------
void RepoConfig::load(const fs::path& p) {
    std::ifstream f(p);
    if (!f) return;
    std::string line;
    while (std::getline(f, line)) {
        if (line.rfind("name=", 0) == 0)          user_name      = line.substr(5);
        else if (line.rfind("email=", 0) == 0)    user_email     = line.substr(6);
        else if (line.rfind("branch=", 0) == 0)   default_branch = line.substr(7);
    }
}

void RepoConfig::save(const fs::path& p) const {
    std::ofstream f(p);
    f << "name="   << user_name      << '\n';
    f << "email="  << user_email     << '\n';
    f << "branch=" << default_branch << '\n';
}

// --------------------------------------------------------------------------
// zlib / miniz helpers
// --------------------------------------------------------------------------
static std::vector<uint8_t> zlib_compress(const std::vector<uint8_t>& in) {
    mz_ulong out_size = mz_compressBound(static_cast<mz_ulong>(in.size()));
    std::vector<uint8_t> out(out_size);
    if (mz_compress(out.data(), &out_size,
                    in.data(), static_cast<mz_ulong>(in.size())) != MZ_OK) {
        throw std::runtime_error("compress failed");
    }
    out.resize(out_size);
    return out;
}

static std::vector<uint8_t> zlib_decompress(const std::vector<uint8_t>& in,
                                             size_t hint = 64 * 1024) {
    std::vector<uint8_t> out(hint);
    while (true) {
        mz_ulong out_size = static_cast<mz_ulong>(out.size());
        int rc = mz_uncompress(out.data(), &out_size,
                               in.data(), static_cast<mz_ulong>(in.size()));
        if (rc == MZ_OK) { out.resize(out_size); return out; }
        if (rc == MZ_BUF_ERROR) { out.resize(out.size() * 2); continue; }
        throw std::runtime_error("decompress failed (code=" + std::to_string(rc) + ")");
    }
}

// --------------------------------------------------------------------------
//  Repository
// --------------------------------------------------------------------------
Repository::Repository(const fs::path& root)
    : root_(fs::absolute(root)) {
    if (fs::exists(fs::absolute(root) / ".drag")) {
        drag_ = fs::absolute(root) / ".drag";
    } else {
        drag_ = fs::absolute(root) / ".drag";
    }
    config_.load(config_path());
}

void Repository::init(const fs::path& root) {
    fs::path drag = root / ".drag";
    if (fs::exists(drag) || fs::exists(root / ".drag"))
        throw std::runtime_error("Repository already exists at: " + root.string());

    // Create directory skeleton
    fs::create_directories(drag / "objects");
    fs::create_directories(drag / "refs" / "heads");
    fs::create_directories(drag / "refs" / "tags");

    // HEAD → main
    std::ofstream(drag / "HEAD") << "ref: refs/heads/main\n";

    // Default config
    RepoConfig cfg;
    cfg.default_branch = "main";
    cfg.save(drag / "config");
}

std::optional<fs::path> Repository::discover(const fs::path& start) {
    fs::path cur = fs::absolute(start);
    while (true) {
        if (fs::exists(cur / ".drag") || fs::exists(cur / ".drag")) return cur;
        fs::path parent = cur.parent_path();
        if (parent == cur) return std::nullopt;
        cur = parent;
    }
}

// ---- Object store --------------------------------------------------------
fs::path Repository::object_path(const Hash& hash) const {
    assert(hash.size() >= 4);
    return objects_dir() / hash.substr(0, 2) / hash.substr(2);
}

Hash Repository::write_object(ObjectType type, const std::vector<uint8_t>& content) {
    Hash h = hash_object(type, content);

    if (object_exists(h)) return h;  // already stored (immutable)

    // Prepend header: "<type> <size>\0"
    std::string hdr = object_type_str(type) + " " + std::to_string(content.size()) + '\0';
    std::vector<uint8_t> full;
    full.reserve(hdr.size() + content.size());
    full.insert(full.end(), hdr.begin(), hdr.end());
    full.insert(full.end(), content.begin(), content.end());

    auto compressed = zlib_compress(full);

    fs::path p = object_path(h);
    fs::create_directories(p.parent_path());

    std::ofstream ofs(p, std::ios::binary);
    if (!ofs) throw std::runtime_error("Cannot write object: " + p.string());
    ofs.write(reinterpret_cast<const char*>(compressed.data()),
              static_cast<std::streamsize>(compressed.size()));
    return h;
}

RawObject Repository::read_object(const Hash& hash) const {
    fs::path p = object_path(hash);
    if (!fs::exists(p))
        throw std::runtime_error("Object not found: " + hash);

    // Read compressed bytes
    std::ifstream ifs(p, std::ios::binary);
    std::vector<uint8_t> compressed(
        (std::istreambuf_iterator<char>(ifs)),
        std::istreambuf_iterator<char>());

    auto full = zlib_decompress(compressed);

    // Parse header: "<type> <size>\0"
    size_t null_pos = 0;
    while (null_pos < full.size() && full[null_pos] != '\0') ++null_pos;

    std::string hdr(full.begin(), full.begin() + null_pos);
    size_t sp = hdr.find(' ');
    ObjectType t = object_type_from_str(hdr.substr(0, sp));

    std::vector<uint8_t> data(full.begin() + null_pos + 1, full.end());
    return RawObject{t, std::move(data)};
}

bool Repository::object_exists(const Hash& hash) const {
    return fs::exists(object_path(hash));
}

Hash Repository::write_blob(const Blob& b) {
    return write_object(ObjectType::Blob, b.serialize());
}
Hash Repository::write_tree(const Tree& t) {
    return write_object(ObjectType::Tree, t.serialize());
}
Hash Repository::write_commit(const Commit& c) {
    return write_object(ObjectType::Commit, c.serialize());
}

Blob   Repository::read_blob(const Hash& h)   const { return Blob::deserialize(read_object(h).data); }
Tree   Repository::read_tree(const Hash& h)   const { return Tree::deserialize(read_object(h).data); }
Commit Repository::read_commit(const Hash& h) const { return Commit::deserialize(read_object(h).data); }

// ---- Refs ----------------------------------------------------------------
std::optional<Hash> Repository::read_ref(const std::string& ref) const {
    fs::path p = drag_ / ref;
    if (!fs::exists(p)) return std::nullopt;
    std::ifstream f(p);
    std::string line;
    std::getline(f, line);
    if (line.empty()) return std::nullopt;
    return line;
}

void Repository::write_ref(const std::string& ref, const Hash& hash) {
    fs::path p = drag_ / ref;
    fs::create_directories(p.parent_path());
    std::ofstream(p) << hash << '\n';
}

void Repository::delete_ref(const std::string& ref) {
    fs::path p = drag_ / ref;
    if (fs::exists(p)) fs::remove(p);
}

std::vector<std::pair<std::string, Hash>>
Repository::list_refs(const std::string& prefix) const {
    std::vector<std::pair<std::string, Hash>> result;
    fs::path base = drag_ / prefix;
    if (!fs::exists(base)) return result;

    for (auto& entry : fs::recursive_directory_iterator(base)) {
        if (entry.is_regular_file()) {
            std::string rel = "refs/" + fs::relative(entry.path(), drag_ / "refs").string();
            // normalize path separators
            std::replace(rel.begin(), rel.end(), '\\', '/');
            std::ifstream f(entry.path());
            std::string hash_line;
            std::getline(f, hash_line);
            if (!hash_line.empty())
                result.emplace_back(rel, hash_line);
        }
    }
    return result;
}

// ---- HEAD ----------------------------------------------------------------
std::string Repository::read_HEAD() const {
    std::ifstream f(HEAD_path());
    std::string line;
    std::getline(f, line);
    return line;
}

void Repository::write_HEAD_ref(const std::string& ref) {
    std::ofstream(HEAD_path()) << "ref: " << ref << '\n';
}

void Repository::write_HEAD_hash(const Hash& hash) {
    std::ofstream(HEAD_path()) << hash << '\n';
}

std::optional<Hash> Repository::resolve_HEAD() const {
    std::string head = read_HEAD();
    if (head.rfind("ref: ", 0) == 0) {
        std::string ref = head.substr(5);
        // trim trailing whitespace
        while (!ref.empty() && (ref.back() == '\n' || ref.back() == '\r' || ref.back() == ' '))
            ref.pop_back();
        return read_ref(ref);
    }
    // detached HEAD — bare hash
    while (!head.empty() && (head.back() == '\n' || head.back() == '\r'))
        head.pop_back();
    if (head.size() == HASH_HEX_LEN) return head;
    return std::nullopt;
}

std::optional<std::string> Repository::current_branch() const {
    std::string head = read_HEAD();
    if (head.rfind("ref: refs/heads/", 0) == 0) {
        std::string branch = head.substr(16);
        while (!branch.empty() && (branch.back() == '\n' || branch.back() == '\r'))
            branch.pop_back();
        return branch;
    }
    return std::nullopt;
}

// ---- Commit log ----------------------------------------------------------
std::vector<Commit> Repository::commit_log(const Hash& start, size_t max) const {
    std::vector<Commit> log;
    Hash cur = start;
    while (!cur.empty() && log.size() < max) {
        if (!object_exists(cur)) break;
        Commit c = read_commit(cur);
        log.push_back(c);
        cur = c.parents.empty() ? "" : c.parents[0];
    }
    return log;
}

std::optional<Hash> Repository::resolve_name(const std::string& name) const {
    // 1. Try as a direct ref: "refs/heads/<name>"
    auto r = read_ref("refs/heads/" + name);
    if (r) return r;

    // 2. Try as a tag: "refs/tags/<name>"
    r = read_ref("refs/tags/" + name);
    if (r) return r;

    // 3. Try as HEAD
    if (name == "HEAD") return resolve_HEAD();

    // 4. Treat as a bare hash (validate size)
    if (name.size() == HASH_HEX_LEN) {
        if (object_exists(name)) return name;
    }

    return std::nullopt;
}

}  // namespace dragyou
