// =============================================================================
//  Dragyou VCS — Blob + Tree + Commit + Tag implementations
//  Objects serialization and hashing
// =============================================================================

#include "objects.h"
#include "picosha2.h"

#include <cstring>
#include <sstream>
#include <stdexcept>

namespace dragyou {

// --------------------------------------------------------------------------
//  ObjectType helpers
// --------------------------------------------------------------------------
std::string object_type_str(ObjectType t) {
    switch (t) {
        case ObjectType::Blob:   return "blob";
        case ObjectType::Tree:   return "tree";
        case ObjectType::Commit: return "commit";
        case ObjectType::Tag:    return "tag";
    }
    return "unknown";
}

ObjectType object_type_from_str(const std::string& s) {
    if (s == "blob")   return ObjectType::Blob;
    if (s == "tree")   return ObjectType::Tree;
    if (s == "commit") return ObjectType::Commit;
    if (s == "tag")    return ObjectType::Tag;
    throw std::invalid_argument("Unknown object type: " + s);
}

// --------------------------------------------------------------------------
//  SHA-256 hashing
// --------------------------------------------------------------------------
Hash sha256_of_bytes(const std::vector<uint8_t>& data) {
    return picosha2::hash256_hex_string(data);
}

Hash sha256_of_string(const std::string& s) {
    return picosha2::hash256_hex_string(s);
}

Hash hash_object(ObjectType type, const std::vector<uint8_t>& content) {
    // Format: "<type> <size>\0<content>"  (same concept as Git)
    std::string header = object_type_str(type) + " " + std::to_string(content.size()) + '\0';
    std::vector<uint8_t> full;
    full.reserve(header.size() + content.size());
    full.insert(full.end(), header.begin(), header.end());
    full.insert(full.end(), content.begin(), content.end());
    return sha256_of_bytes(full);
}

// --------------------------------------------------------------------------
//  Blob
// --------------------------------------------------------------------------
std::vector<uint8_t> Blob::serialize() const {
    // Raw content is the serialized form
    return content;
}

Blob Blob::deserialize(const std::vector<uint8_t>& raw) {
    return Blob{raw};
}

// --------------------------------------------------------------------------
//  Tree
// --------------------------------------------------------------------------
std::vector<uint8_t> Tree::serialize() const {
    // Format per entry: "<mode> <name>\0<32-byte raw hash>"
    // We store the hash as 32 raw bytes (binary SHA-256)
    std::vector<uint8_t> out;
    for (const auto& e : entries) {
        // "100644 filename\0"
        std::string header = e.mode + ' ' + e.name + '\0';
        out.insert(out.end(), header.begin(), header.end());
        // Convert 64-hex SHA-256 → 32 raw bytes
        for (size_t i = 0; i < 64; i += 2) {
            uint8_t byte = static_cast<uint8_t>(std::stoul(e.hash.substr(i, 2), nullptr, 16));
            out.push_back(byte);
        }
    }
    return out;
}

Tree Tree::deserialize(const std::vector<uint8_t>& raw) {
    Tree tree;
    size_t pos = 0;
    while (pos < raw.size()) {
        // Read mode
        size_t sp = pos;
        while (sp < raw.size() && raw[sp] != ' ') ++sp;
        std::string mode(raw.begin() + pos, raw.begin() + sp);
        pos = sp + 1;

        // Read name (up to null)
        size_t null_pos = pos;
        while (null_pos < raw.size() && raw[null_pos] != '\0') ++null_pos;
        std::string name(raw.begin() + pos, raw.begin() + null_pos);
        pos = null_pos + 1;

        // Read 32 raw bytes → 64-char hex
        if (pos + 32 > raw.size())
            throw std::runtime_error("Malformed tree object");
        std::string hash_hex;
        hash_hex.reserve(64);
        for (size_t i = 0; i < 32; ++i) {
            char buf[3];
            std::snprintf(buf, sizeof(buf), "%02x", raw[pos + i]);
            hash_hex += buf;
        }
        pos += 32;

        tree.entries.push_back({mode, name, hash_hex});
    }
    return tree;
}

// --------------------------------------------------------------------------
//  Commit
// --------------------------------------------------------------------------
static std::string format_sig(const Signature& sig) {
    return sig.name + " <" + sig.email + "> " +
           std::to_string(sig.timestamp) + " +0000";
}

static Signature parse_sig(const std::string& line) {
    // "Name <email> timestamp tz"
    Signature sig;
    size_t lt = line.find('<');
    size_t gt = line.find('>');
    if (lt == std::string::npos || gt == std::string::npos)
        return sig;
    sig.name  = line.substr(0, lt - 1);
    sig.email = line.substr(lt + 1, gt - lt - 1);
    size_t ts_start = gt + 2;
    size_t ts_end   = line.find(' ', ts_start);
    sig.timestamp = std::stoll(line.substr(ts_start, ts_end - ts_start));
    return sig;
}

std::vector<uint8_t> Commit::serialize() const {
    std::ostringstream oss;
    oss << "tree " << tree << '\n';
    for (const auto& p : parents)
        oss << "parent " << p << '\n';
    oss << "author "    << format_sig(author)    << '\n';
    oss << "committer " << format_sig(committer) << '\n';
    oss << '\n';
    oss << message;
    std::string s = oss.str();
    return std::vector<uint8_t>(s.begin(), s.end());
}

Commit Commit::deserialize(const std::vector<uint8_t>& raw) {
    std::string text(raw.begin(), raw.end());
    Commit c;
    std::istringstream iss(text);
    std::string line;
    bool in_header = true;
    std::string msg_buf;

    while (std::getline(iss, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (in_header) {
            if (line.empty()) { in_header = false; continue; }
            if (line.rfind("tree ", 0) == 0) {
                c.tree = line.substr(5);
            } else if (line.rfind("parent ", 0) == 0) {
                c.parents.push_back(line.substr(7));
            } else if (line.rfind("author ", 0) == 0) {
                c.author = parse_sig(line.substr(7));
            } else if (line.rfind("committer ", 0) == 0) {
                c.committer = parse_sig(line.substr(10));
            }
        } else {
            if (!msg_buf.empty()) msg_buf += '\n';
            msg_buf += line;
        }
    }
    c.message = msg_buf;
    return c;
}

// --------------------------------------------------------------------------
//  Tag
// --------------------------------------------------------------------------
std::vector<uint8_t> Tag::serialize() const {
    std::ostringstream oss;
    oss << "object " << object << '\n';
    oss << "type "   << object_type_str(object_type) << '\n';
    oss << "tag "    << tag_name << '\n';
    oss << "tagger " << format_sig(tagger) << '\n';
    oss << '\n';
    oss << message;
    std::string s = oss.str();
    return std::vector<uint8_t>(s.begin(), s.end());
}

Tag Tag::deserialize(const std::vector<uint8_t>& raw) {
    std::string text(raw.begin(), raw.end());
    Tag t;
    std::istringstream iss(text);
    std::string line;
    bool in_header = true;
    std::string msg_buf;
    while (std::getline(iss, line)) {
        if (in_header) {
            if (line.empty()) { in_header = false; continue; }
            if (line.rfind("object ", 0) == 0) t.object   = line.substr(7);
            else if (line.rfind("type ", 0) == 0)   t.object_type = object_type_from_str(line.substr(5));
            else if (line.rfind("tag ", 0) == 0)    t.tag_name    = line.substr(4);
            else if (line.rfind("tagger ", 0) == 0) t.tagger      = parse_sig(line.substr(7));
        } else {
            if (!msg_buf.empty()) msg_buf += '\n';
            msg_buf += line;
        }
    }
    t.message = msg_buf;
    return t;
}

}  // namespace dragyou
