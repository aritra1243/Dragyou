#pragma once
// =============================================================================
//  Dragyou VCS — Remote Protocol
//
//  Object negotiation protocol (Phase 4):
//
//  PUSH:
//    1. Client opens connection: POST /api/v1/repos/:owner/:repo/push/negotiate
//       Body: {"have": ["hash1", "hash2", ...], "want": ["tip_hash"]}
//    2. Server responds: {"need": ["hash3", "hash4"]} (objects server is missing)
//    3. Client streams only missing objects: POST /api/v1/repos/:owner/:repo/push/pack
//       Body: binary packstream (chunked)
//    4. Server applies pack, updates ref
//
//  PULL / FETCH:
//    1. Client sends: POST /api/v1/repos/:owner/:repo/fetch
//       Body: {"have": [...], "want": ["refs/heads/main"]}
//    2. Server responds with thin pack of needed objects
//
//  CLONE (shallow):
//    POST /api/v1/repos/:owner/:repo/clone
//    Body: {"depth": 1}  → returns commit graph + directory metadata (~50-200MB)
//    Files themselves fetched lazily (virtual clone)
//
// =============================================================================

#include "objects.h"
#include "repository.h"

#include <functional>
#include <set>
#include <string>
#include <vector>

namespace dragyou {

// --------------------------------------------------------------------------
//  Packstream — a sequence of (type, data) pairs to transfer objects
// --------------------------------------------------------------------------
struct PackEntry {
    ObjectType           type;
    Hash                 hash;
    std::vector<uint8_t> data;   // uncompressed object content
};

struct Pack {
    std::vector<PackEntry> entries;

    // Serialize to wire format:
    //   Magic: "DNYPACK\0" (8 bytes)
    //   Version: uint32_t (4 bytes BE) = 1
    //   Count: uint32_t (4 bytes BE)
    //   Entries: [type:1][hash_len:1][hash:64][size:8BE][data:size]
    std::vector<uint8_t> serialize() const;
    static Pack deserialize(const std::vector<uint8_t>& raw);
};

// --------------------------------------------------------------------------
//  Negotiation protocol structures
// --------------------------------------------------------------------------
struct NegotiateRequest {
    std::vector<Hash> have;  // hashes the client already has
    std::vector<Hash> want;  // tip hashes the client wants to reach
};

struct NegotiateResponse {
    std::vector<Hash> need;  // hashes the server needs from client (for push)
                             // or hashes the server will send (for pull)
    bool             ready = true;
};

// --------------------------------------------------------------------------
//  RemoteProtocol — local side of the negotiation
// --------------------------------------------------------------------------
class RemoteProtocol {
public:
    explicit RemoteProtocol(Repository& repo);

    // ── PUSH side (client) ──────────────────────────────────────────────

    /// Compute which objects would need to be sent to make the server have 'tip'.
    /// 'server_have' = hashes the server already possesses.
    std::vector<Hash> compute_push_objects(const Hash& tip,
                                           const std::set<Hash>& server_have) const;

    /// Build a Pack from a set of hashes.
    Pack build_pack(const std::vector<Hash>& hashes) const;

    // ── PULL side (server) ──────────────────────────────────────────────

    /// Given client's 'have' set, compute objects to send to reach 'want' tips.
    std::vector<Hash> compute_fetch_objects(const std::vector<Hash>& want,
                                            const std::set<Hash>& client_have) const;

    /// Apply a received Pack to the local object store.
    void apply_pack(const Pack& pack);

    /// Update a ref after a successful push/pull.
    void update_ref(const std::string& ref_name, const Hash& new_tip,
                    const Hash& expected_old_tip = "");

    // ── Clone ────────────────────────────────────────────────────────────

    /// Build a shallow clone pack (commit graph + tree metadata, no blobs).
    struct CloneManifest {
        Hash              default_branch_tip;
        std::string       default_branch;
        std::vector<Hash> commit_hashes;   // all commits (or depth-limited)
        std::vector<Hash> tree_hashes;     // all referenced trees
        // Blobs are fetched lazily by the client
        Pack              metadata_pack;   // commits + trees only
    };
    CloneManifest build_clone_manifest(const std::string& branch, int depth = 0) const;

private:
    Repository& repo_;

    /// Walk the commit graph from 'tip', collecting all reachable objects.
    void walk_objects(const Hash& tip,
                      const std::set<Hash>& stop_at,
                      std::vector<Hash>& out) const;

    /// Walk a tree recursively, collecting all blob/tree hashes.
    void walk_tree(const Hash& tree_hash,
                   const std::set<Hash>& stop_at,
                   std::vector<Hash>& out) const;
};

}  // namespace dragyou
