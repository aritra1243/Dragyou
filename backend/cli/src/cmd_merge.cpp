// =============================================================================
//  nova merge — Merge a branch into the current branch
// =============================================================================

#include "repository.h"
#include "index.h"
#include "merge.h"

#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <map>
#include <set>

int cmd_merge(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "Usage: nova merge <branch>\n";
        return 1;
    }

    auto repo_root = dragyou::Repository::discover();
    if (!repo_root) {
        std::cerr << "nova merge: not a Dragyou repository\n";
        return 1;
    }

    std::string theirs_name = argv[1];

    try {
        dragyou::Repository repo(*repo_root);

        auto ours_hash   = repo.resolve_HEAD();
        auto theirs_hash = repo.resolve_name(theirs_name);

        if (!ours_hash)   { std::cerr << "nova merge: no commits on current branch\n"; return 1; }
        if (!theirs_hash) { std::cerr << "nova merge: unknown branch '" << theirs_name << "'\n"; return 1; }

        if (*ours_hash == *theirs_hash) {
            std::cout << "Already up to date.\n";
            return 0;
        }

        // Fast-forward check: walk theirs parents looking for ours
        auto theirs_log = repo.commit_log(*theirs_hash, 10000);
        bool can_ff = false;
        for (const auto& c : theirs_log) {
            dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());
            if (h == *ours_hash) { can_ff = true; break; }
        }

        if (can_ff) {
            auto branch = repo.current_branch();
            if (branch) repo.write_ref("refs/heads/" + *branch, *theirs_hash);
            else        repo.write_HEAD_hash(*theirs_hash);

            dragyou::Commit tc = repo.read_commit(*theirs_hash);
            std::cout << "Fast-forward merge: " << ours_hash->substr(0, 8)
                      << " → " << theirs_hash->substr(0, 8) << '\n';
            return 0;
        }

        // --- Three-way file merge ---
        // Find LCA (Lowest Common Ancestor) by checking ours parents vs theirs log
        dragyou::Hash base_hash;
        {
            auto ours_log = repo.commit_log(*ours_hash, 10000);
            std::set<dragyou::Hash> ours_set;
            for (const auto& c : ours_log)
                ours_set.insert(dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize()));

            for (const auto& c : theirs_log) {
                dragyou::Hash h = dragyou::hash_object(dragyou::ObjectType::Commit, c.serialize());
                if (ours_set.count(h)) { base_hash = h; break; }
            }
        }

        if (base_hash.empty()) {
            std::cerr << "nova merge: no common ancestor found — cannot merge unrelated histories\n";
            return 1;
        }

        dragyou::Commit base_c   = repo.read_commit(base_hash);
        dragyou::Commit ours_c   = repo.read_commit(*ours_hash);
        dragyou::Commit theirs_c = repo.read_commit(*theirs_hash);

        // Collect all files from all three trees
        using FileMap = std::map<std::string, dragyou::Hash>;

        std::function<void(const dragyou::Hash&, const std::string&, FileMap&)> collect_tree =
            [&](const dragyou::Hash& tree_hash, const std::string& prefix, FileMap& out) {
                if (tree_hash.empty() || !repo.object_exists(tree_hash)) return;
                dragyou::Tree t = repo.read_tree(tree_hash);
                for (const auto& e : t.entries) {
                    std::string full = prefix + e.name;
                    if (e.mode == "040000") collect_tree(e.hash, full + "/", out);
                    else out[full] = e.hash;
                }
            };

        FileMap base_files, ours_files, theirs_files;
        collect_tree(base_c.tree, "", base_files);
        collect_tree(ours_c.tree, "", ours_files);
        collect_tree(theirs_c.tree, "", theirs_files);

        // Merge each file
        std::set<std::string> all_paths;
        for (auto& [p,_] : base_files)   all_paths.insert(p);
        for (auto& [p,_] : ours_files)   all_paths.insert(p);
        for (auto& [p,_] : theirs_files) all_paths.insert(p);

        bool has_conflict = false;
        dragyou::Index idx(repo);
        idx.load();

        for (const auto& path : all_paths) {
            bool in_base   = base_files.count(path);
            bool in_ours   = ours_files.count(path);
            bool in_theirs = theirs_files.count(path);

            auto get_content = [&](const FileMap& fm, const std::string& p) -> std::string {
                auto it = fm.find(p);
                if (it == fm.end()) return "";
                dragyou::Blob b = repo.read_blob(it->second);
                return std::string(b.content.begin(), b.content.end());
            };

            std::string base_c_str   = in_base   ? get_content(base_files, path)   : "";
            std::string ours_c_str   = in_ours   ? get_content(ours_files, path)   : "";
            std::string theirs_c_str = in_theirs ? get_content(theirs_files, path) : "";

            std::string merged;

            if (!in_theirs && in_ours) { merged = ours_c_str; }
            else if (!in_ours && in_theirs) { merged = theirs_c_str; }
            else if (ours_c_str == theirs_c_str) { merged = ours_c_str; }
            else {
                auto mr = dragyou::merge_strings(base_c_str, ours_c_str, theirs_c_str,
                                                 "OURS", theirs_name);
                merged = mr.content;
                if (!mr.ok) {
                    std::cerr << "CONFLICT: " << path << " (merge conflict)\n";
                    has_conflict = true;
                }
            }

            // Write merged content to disk
            std::filesystem::path abs = repo.root() / path;
            std::filesystem::create_directories(abs.parent_path());
            std::ofstream f(abs, std::ios::binary);
            f.write(merged.data(), static_cast<std::streamsize>(merged.size()));

            // Stage the merged file
            idx.add(path);
        }

        if (has_conflict) {
            std::cerr << "\nAutomatic merge failed; fix conflicts and then commit.\n";
            return 1;
        }

        // Create merge commit
        dragyou::Hash new_tree = idx.write_tree();
        dragyou::Commit merge_c;
        merge_c.tree    = new_tree;
        merge_c.parents = {*ours_hash, *theirs_hash};

        const auto& cfg = repo.config();
        dragyou::Signature sig;
        sig.name      = cfg.user_name.empty()  ? "Unknown" : cfg.user_name;
        sig.email     = cfg.user_email.empty() ? "unknown@dragyou.vcs" : cfg.user_email;
        sig.timestamp = static_cast<int64_t>(std::time(nullptr));
        merge_c.author    = sig;
        merge_c.committer = sig;
        merge_c.message   = "Merge branch '" + theirs_name + "'";

        dragyou::Hash merge_hash = repo.write_commit(merge_c);
        auto branch = repo.current_branch();
        if (branch) repo.write_ref("refs/heads/" + *branch, merge_hash);

        std::cout << "Merge commit " << merge_hash.substr(0, 8) << ": " << merge_c.message << '\n';
        return 0;

    } catch (const std::exception& e) {
        std::cerr << "nova merge: " << e.what() << '\n';
        return 1;
    }
}
