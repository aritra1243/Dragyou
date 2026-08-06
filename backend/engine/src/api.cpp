#include "dragyou_api.h"
#include "repository.h"
#include "index.h"
#include "diff.h"
#include "merge.h"

#include <cstring>
#include <ctime>
#include <fstream>
#include <functional>
#include <sstream>
#include <stdexcept>

// Thread-local error message
static thread_local std::string g_last_error;

static void set_error(const std::string& msg) { g_last_error = msg; }

// Helper internal functions outside extern "C"
static dragyou::Signature parse_author_str(const std::string& s) {
    dragyou::Signature sig;
    size_t lt = s.find('<');
    size_t gt = s.find('>');
    if (lt != std::string::npos && gt != std::string::npos) {
        sig.name  = s.substr(0, lt - 1);
        sig.email = s.substr(lt + 1, gt - lt - 1);
    } else {
        sig.name = s;
    }
    sig.timestamp = static_cast<int64_t>(std::time(nullptr));
    return sig;
}

static std::string state_str(dragyou::Index::StatusEntry::State s) {
    using S = dragyou::Index::StatusEntry::State;
    switch (s) {
        case S::Staged:    return "staged";
        case S::Modified:  return "modified";
        case S::Deleted:   return "deleted";
        case S::Untracked: return "untracked";
        case S::Unchanged: return "unchanged";
    }
    return "unknown";
}

static std::string escape_json_string(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"')  out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else                out += c;
    }
    return out;
}

extern "C" {

void dragyou_free_string(char* s) { free(s); }

const char* dragyou_last_error(void) { return g_last_error.c_str(); }

// --------------------------------------------------------------------------
int dragyou_init(const char* path) {
    try {
        dragyou::Repository::init(path);
        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

// --------------------------------------------------------------------------
int dragyou_add(const char* repo, const char* rel_path) {
    try {
        dragyou::Repository r(repo);
        dragyou::Index idx(r);
        idx.load();
        idx.add(rel_path);
        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

// --------------------------------------------------------------------------
int dragyou_remove(const char* repo, const char* rel_path) {
    try {
        dragyou::Repository r(repo);
        dragyou::Index idx(r);
        idx.load();
        idx.remove(rel_path);
        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}


// --------------------------------------------------------------------------
char* dragyou_status(const char* repo) {
    try {
        dragyou::Repository r(repo);
        dragyou::Index idx(r);
        idx.load();
        auto entries = idx.status();

        std::ostringstream oss;
        oss << "[";
        bool first = true;
        for (const auto& e : entries) {
            if (!first) oss << ",";
            first = false;
            oss << "{\"path\":\"" << e.path << "\","
                << "\"index\":\"" << state_str(e.index_state) << "\","
                << "\"work\":\"" << state_str(e.work_state) << "\"}";
        }
        oss << "]";

        std::string s = oss.str();
        char* out = static_cast<char*>(malloc(s.size() + 1));
        std::memcpy(out, s.c_str(), s.size() + 1);
        return out;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}




char* dragyou_log(const char* repo, int max_count) {
    try {
        dragyou::Repository r(repo);
        auto head = r.resolve_HEAD();
        if (!head) {
            const char* empty = "[]";
            char* out = static_cast<char*>(malloc(3));
            std::memcpy(out, empty, 3);
            return out;
        }

        auto commits = r.commit_log(*head, static_cast<size_t>(max_count > 0 ? max_count : 100));

        std::ostringstream oss;
        oss << "[";
        bool first = true;
        for (const auto& c : commits) {
            if (!first) oss << ",";
            first = false;
            dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());
            oss << "{"
                << "\"hash\":\"" << h << "\","
                << "\"message\":\"" << escape_json_string(c.message) << "\","
                << "\"author\":\"" << escape_json_string(c.author.name + " <" + c.author.email + ">") << "\","
                << "\"timestamp\":" << c.author.timestamp << ","
                << "\"tree\":\"" << c.tree << "\","
                << "\"parents\":[";
            bool fp = true;
            for (auto& p : c.parents) {
                if (!fp) oss << ",";
                fp = false;
                oss << "\"" << p << "\"";
            }
            oss << "]}";
        }
        oss << "]";

        std::string s = oss.str();
        char* out = static_cast<char*>(malloc(s.size() + 1));
        std::memcpy(out, s.c_str(), s.size() + 1);
        return out;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}

// --------------------------------------------------------------------------
int dragyou_branch_create(const char* repo, const char* name) {
    try {
        dragyou::Repository r(repo);
        auto head = r.resolve_HEAD();
        if (!head) throw std::runtime_error("No commits yet");
        std::string ref = std::string("refs/heads/") + name;
        if (r.read_ref(ref)) throw std::runtime_error("Branch already exists: " + std::string(name));
        r.write_ref(ref, *head);
        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

int dragyou_branch_delete(const char* repo, const char* name) {
    try {
        dragyou::Repository r(repo);
        auto branch = r.current_branch();
        if (branch && *branch == name)
            throw std::runtime_error("Cannot delete current branch: " + std::string(name));
        r.delete_ref(std::string("refs/heads/") + name);
        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

char* dragyou_branch_list(const char* repo) {
    try {
        dragyou::Repository r(repo);
        auto refs = r.list_refs("refs/heads/");
        auto current = r.current_branch();

        std::ostringstream oss;
        oss << "[";
        bool first = true;
        for (const auto& [ref, hash] : refs) {
            std::string name = ref.substr(ref.rfind('/') + 1);
            bool is_current = (current && *current == name);
            if (!first) oss << ",";
            first = false;
            oss << "{\"name\":\"" << name << "\","
                << "\"current\":" << (is_current ? "true" : "false") << ","
                << "\"hash\":\"" << hash << "\"}";
        }
        oss << "]";

        std::string s = oss.str();
        char* out = static_cast<char*>(malloc(s.size() + 1));
        std::memcpy(out, s.c_str(), s.size() + 1);
        return out;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}

// --------------------------------------------------------------------------
// Checkout: restore working tree + update HEAD
int dragyou_checkout(const char* repo, const char* name) {
    try {
        dragyou::Repository r(repo);
        auto target_hash = r.resolve_name(name);
        if (!target_hash)
            throw std::runtime_error("Unknown ref or hash: " + std::string(name));

        dragyou::Commit c = r.read_commit(*target_hash);

        // Restore files from tree
        std::function<void(const dragyou::Hash&, const std::string&)> restore =
            [&](const dragyou::Hash& tree_hash, const std::string& prefix) {
                dragyou::Tree t = r.read_tree(tree_hash);
                for (const auto& e : t.entries) {
                    std::string full = prefix + e.name;
                    if (e.mode == "040000") {
                        std::filesystem::create_directories(r.root() / full);
                        restore(e.hash, full + "/");
                    } else {
                        dragyou::Blob b = r.read_blob(e.hash);
                        std::filesystem::path out = r.root() / full;
                        std::filesystem::create_directories(out.parent_path());
                        std::ofstream f(out, std::ios::binary);
                        f.write(reinterpret_cast<const char*>(b.content.data()),
                                static_cast<std::streamsize>(b.content.size()));
                    }
                }
            };

        if (!c.tree.empty() && r.object_exists(c.tree))
            restore(c.tree, "");

        // Update index to match
        dragyou::Index idx(r);
        idx.load();
        // Re-add all restored files
        // (simplified: just update HEAD ref)

        // Update HEAD
        auto ref = std::string("refs/heads/") + name;
        if (r.read_ref(ref)) {
            r.write_HEAD_ref(ref);
        } else {
            r.write_HEAD_hash(*target_hash);
        }

        return DRAGYOU_OK;
    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

// --------------------------------------------------------------------------
char* dragyou_diff(const char* repo) {
    try {
        dragyou::Repository r(repo);
        dragyou::Index idx(r);
        idx.load();

        std::ostringstream combined;

        for (const auto& e : idx.entries()) {
            dragyou::Blob indexed_blob = r.read_blob(e.hash);
            std::string indexed_content(indexed_blob.content.begin(),
                                        indexed_blob.content.end());

            std::filesystem::path abs = r.root() / e.path;
            if (!std::filesystem::exists(abs)) {
                combined << "deleted: " << e.path << '\n';
                continue;
            }

            std::ifstream fin(abs, std::ios::binary);
            std::ostringstream ss;
            ss << fin.rdbuf();
            std::string work_content = ss.str();

            if (indexed_content == work_content) continue;

            auto d = dragyou::diff_strings(indexed_content, work_content);
            combined << d.to_unified("a/" + e.path, "b/" + e.path);
        }

        std::string s = combined.str();
        char* out = static_cast<char*>(malloc(s.size() + 1));
        std::memcpy(out, s.c_str(), s.size() + 1);
        return out;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}

// --------------------------------------------------------------------------
int dragyou_merge(const char* repo, const char* theirs_branch) {
    try {
        dragyou::Repository r(repo);

        auto ours_hash   = r.resolve_HEAD();
        auto theirs_hash = r.resolve_name(theirs_branch);

        if (!ours_hash)   throw std::runtime_error("No commits on current branch");
        if (!theirs_hash) throw std::runtime_error("Unknown branch: " + std::string(theirs_branch));

        dragyou::Commit ours_c   = r.read_commit(*ours_hash);
        dragyou::Commit theirs_c = r.read_commit(*theirs_hash);

        // Fast-forward check: if ours is ancestor of theirs
        // (simplified: walk theirs parents looking for ours_hash)
        auto log = r.commit_log(*theirs_hash, 1000);
        bool ff = false;
        for (const auto& c : log) {
            dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());
            if (h == *ours_hash) { ff = true; break; }
        }

        if (ff) {
            // Fast-forward merge
            auto branch = r.current_branch();
            if (branch) r.write_ref("refs/heads/" + *branch, *theirs_hash);
            return DRAGYOU_OK;
        }

        // TODO: full three-way merge (find LCA, then merge trees file by file)
        // For now: report as needing manual merge
        set_error("Non-fast-forward merge: three-way merge not yet implemented. Use drag checkout and manually resolve.");
        return DRAGYOU_ERR_CONFLICT;

    } catch (const std::exception& e) {
        set_error(e.what());
        return DRAGYOU_ERR_IO;
    }
}

// --------------------------------------------------------------------------
char* dragyou_head(const char* repo) {
    try {
        dragyou::Repository r(repo);
        auto branch = r.current_branch();
        std::string s;
        if (branch) s = *branch;
        else {
            auto h = r.resolve_HEAD();
            s = h ? *h : "(none)";
        }
        char* out = static_cast<char*>(malloc(s.size() + 1));
        std::memcpy(out, s.c_str(), s.size() + 1);
        return out;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}

}  // extern "C"
