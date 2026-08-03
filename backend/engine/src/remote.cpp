// =============================================================================
//  Dragyou VCS — Remote Protocol implementation
// =============================================================================

#include "remote.h"

#include <cassert>
#include <queue>
#include <stdexcept>

namespace dragyou {

// --------------------------------------------------------------------------
//  Pack serialization
// --------------------------------------------------------------------------
static constexpr std::array<char, 8> PACK_MAGIC = {'D','N','Y','P','A','C','K','\0'};
static constexpr uint32_t PACK_VERSION = 1;

static void put_be32(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back((x >> 24) & 0xFF);
    v.push_back((x >> 16) & 0xFF);
    v.push_back((x >>  8) & 0xFF);
    v.push_back((x >>  0) & 0xFF);
}
static void put_be64(std::vector<uint8_t>& v, uint64_t x) {
    for (int i = 7; i >= 0; --i) v.push_back((x >> (i*8)) & 0xFF);
}
static uint32_t get_be32(const uint8_t* p) {
    return (uint32_t(p[0]) << 24) | (uint32_t(p[1]) << 16) |
           (uint32_t(p[2]) << 8)  |  uint32_t(p[3]);
}
static uint64_t get_be64(const uint8_t* p) {
    uint64_t v = 0;
    for (int i = 0; i < 8; ++i) v = (v << 8) | p[i];
    return v;
}

std::vector<uint8_t> Pack::serialize() const {
    std::vector<uint8_t> out;

    // Header
    out.insert(out.end(), PACK_MAGIC.begin(), PACK_MAGIC.end());
    put_be32(out, PACK_VERSION);
    put_be32(out, static_cast<uint32_t>(entries.size()));

    for (const auto& e : entries) {
        // type (1 byte)
        out.push_back(static_cast<uint8_t>(e.type));
        // hash length (1 byte) + hash (64 bytes)
        out.push_back(static_cast<uint8_t>(e.hash.size()));
        out.insert(out.end(), e.hash.begin(), e.hash.end());
        // data size (8 bytes BE) + data
        put_be64(out, static_cast<uint64_t>(e.data.size()));
        out.insert(out.end(), e.data.begin(), e.data.end());
    }

    return out;
}

Pack Pack::deserialize(const std::vector<uint8_t>& raw) {
    if (raw.size() < 16)
        throw std::runtime_error("Pack too small");

    // Verify magic
    for (int i = 0; i < 8; ++i)
        if (raw[i] != static_cast<uint8_t>(PACK_MAGIC[i]))
            throw std::runtime_error("Invalid pack magic");

    uint32_t version = get_be32(raw.data() + 8);
    if (version != PACK_VERSION)
        throw std::runtime_error("Unsupported pack version: " + std::to_string(version));

    uint32_t count = get_be32(raw.data() + 12);

    Pack pack;
    size_t pos = 16;

    for (uint32_t i = 0; i < count; ++i) {
        if (pos >= raw.size())
            throw std::runtime_error("Truncated pack");

        PackEntry e;
        e.type = static_cast<ObjectType>(raw[pos++]);

        uint8_t hash_len = raw[pos++];
        if (pos + hash_len > raw.size()) throw std::runtime_error("Truncated hash");
        e.hash = std::string(raw.begin() + pos, raw.begin() + pos + hash_len);
        pos += hash_len;

        if (pos + 8 > raw.size()) throw std::runtime_error("Truncated size");
        uint64_t data_size = get_be64(raw.data() + pos);
        pos += 8;

        if (pos + data_size > raw.size()) throw std::runtime_error("Truncated data");
        e.data = std::vector<uint8_t>(raw.begin() + pos, raw.begin() + pos + data_size);
        pos += data_size;

        pack.entries.push_back(std::move(e));
    }

    return pack;
}

// --------------------------------------------------------------------------
//  RemoteProtocol
// --------------------------------------------------------------------------
RemoteProtocol::RemoteProtocol(Repository& repo) : repo_(repo) {}

// Walk commit graph + trees from tip, stop at known hashes
void RemoteProtocol::walk_objects(const Hash& tip,
                                  const std::set<Hash>& stop_at,
                                  std::vector<Hash>& out) const {
    std::set<Hash> visited;
    std::queue<Hash> q;
    q.push(tip);

    while (!q.empty()) {
        Hash cur = q.front(); q.pop();
        if (cur.empty()) continue;
        if (visited.count(cur)) continue;
        if (stop_at.count(cur)) continue;
        if (!repo_.object_exists(cur)) continue;

        visited.insert(cur);

        auto raw = repo_.read_object(cur);
        out.push_back(cur);

        if (raw.type == ObjectType::Commit) {
            Commit c = Commit::deserialize(raw.data);
            // Include tree
            if (!c.tree.empty()) {
                out.push_back(c.tree);
                walk_tree(c.tree, stop_at, out);
            }
            // Walk parents
            for (auto& p : c.parents) q.push(p);
        }
    }
}

void RemoteProtocol::walk_tree(const Hash& tree_hash,
                               const std::set<Hash>& stop_at,
                               std::vector<Hash>& out) const {
    if (tree_hash.empty() || stop_at.count(tree_hash)) return;
    if (!repo_.object_exists(tree_hash)) return;

    Tree t = repo_.read_tree(tree_hash);
    for (const auto& e : t.entries) {
        if (stop_at.count(e.hash)) continue;
        if (e.mode == "040000") {
            out.push_back(e.hash);
            walk_tree(e.hash, stop_at, out);
        } else {
            out.push_back(e.hash);
        }
    }
}

std::vector<Hash> RemoteProtocol::compute_push_objects(
        const Hash& tip, const std::set<Hash>& server_have) const {
    std::vector<Hash> out;
    walk_objects(tip, server_have, out);

    // Deduplicate
    std::set<Hash> seen(out.begin(), out.end());
    out.assign(seen.begin(), seen.end());

    // Remove already-known objects
    out.erase(std::remove_if(out.begin(), out.end(),
              [&](const Hash& h){ return server_have.count(h) > 0; }),
              out.end());
    return out;
}

Pack RemoteProtocol::build_pack(const std::vector<Hash>& hashes) const {
    Pack pack;
    for (const auto& h : hashes) {
        if (!repo_.object_exists(h)) continue;
        auto raw = repo_.read_object(h);
        pack.entries.push_back({raw.type, h, raw.data});
    }
    return pack;
}

std::vector<Hash> RemoteProtocol::compute_fetch_objects(
        const std::vector<Hash>& want, const std::set<Hash>& client_have) const {
    std::vector<Hash> out;
    for (const auto& tip : want) {
        walk_objects(tip, client_have, out);
    }
    // Deduplicate
    std::set<Hash> seen;
    std::vector<Hash> result;
    for (auto& h : out) {
        if (!seen.count(h) && !client_have.count(h)) {
            seen.insert(h);
            result.push_back(h);
        }
    }
    return result;
}

void RemoteProtocol::apply_pack(const Pack& pack) {
    for (const auto& e : pack.entries) {
        Hash computed = repo_.write_object(e.type, e.data);
        if (!e.hash.empty() && e.hash != computed) {
            fs::path src = repo_.object_path(computed);
            fs::path dst = repo_.object_path(e.hash);
            if (fs::exists(src) && !fs::exists(dst)) {
                fs::create_directories(dst.parent_path());
                fs::copy_file(src, dst, fs::copy_options::overwrite_existing);
            }
        }
    }
}

void RemoteProtocol::update_ref(const std::string& ref_name,
                                 const Hash& new_tip,
                                 const Hash& expected_old) {
    if (!expected_old.empty()) {
        auto cur = repo_.read_ref(ref_name);
        if (cur && *cur != expected_old) {
            throw std::runtime_error(
                "Ref update rejected: " + ref_name +
                " expected " + expected_old.substr(0, 8) +
                " but got " + cur->substr(0, 8) +
                " — force-push or pull first");
        }
    }
    repo_.write_ref(ref_name, new_tip);
}

RemoteProtocol::CloneManifest
RemoteProtocol::build_clone_manifest(const std::string& branch, int depth) const {
    CloneManifest manifest;
    manifest.default_branch = branch;

    auto tip = repo_.read_ref("refs/heads/" + branch);
    if (!tip) throw std::runtime_error("Branch not found: " + branch);
    manifest.default_branch_tip = *tip;

    // Walk commit log (depth-limited if depth > 0)
    auto commits = repo_.commit_log(*tip, depth > 0 ? static_cast<size_t>(depth) : 100000);
    for (const auto& c : commits) {
        Hash h = hash_object(ObjectType::Commit, c.serialize());
        manifest.commit_hashes.push_back(h);
        manifest.tree_hashes.push_back(c.tree);
    }

    // Build a metadata-only pack (commits + trees, NO blobs → virtual clone)
    Pack meta;
    std::set<Hash> seen;
    for (auto& ch : manifest.commit_hashes) {
        if (seen.count(ch)) continue;
        seen.insert(ch);
        auto raw = repo_.read_object(ch);
        meta.entries.push_back({raw.type, ch, raw.data});
    }

    std::function<void(const Hash&)> add_trees = [&](const Hash& th) {
        if (th.empty() || seen.count(th) || !repo_.object_exists(th)) return;
        seen.insert(th);
        auto raw = repo_.read_object(th);
        meta.entries.push_back({raw.type, th, raw.data});
        Tree t = Tree::deserialize(raw.data);
        for (const auto& e : t.entries) {
            if (e.mode == "040000") add_trees(e.hash);
            // blobs deliberately excluded — fetched lazily
        }
    };
    for (auto& th : manifest.tree_hashes) add_trees(th);

    manifest.metadata_pack = std::move(meta);
    return manifest;
}

}  // namespace dragyou
