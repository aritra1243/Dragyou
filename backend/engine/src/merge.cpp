// =============================================================================
//  Dragyou VCS — Three-Way Merge Engine
// =============================================================================

#include "merge.h"
#include "diff.h"

#include <fstream>
#include <sstream>

namespace dragyou {

// --------------------------------------------------------------------------
//  Core three-way merge on line vectors
// --------------------------------------------------------------------------
MergeResult merge_lines(const std::vector<std::string>& base,
                        const std::vector<std::string>& ours,
                        const std::vector<std::string>& theirs,
                        const std::string& label_ours,
                        const std::string& label_theirs) {
    // Compute diffs from base to each side
    DiffResult d_ours   = diff_lines(base, ours);
    DiffResult d_theirs = diff_lines(base, theirs);

    // Walk through base lines and decide what to emit for each region
    // Strategy: for each base line, track what both sides do:
    //   - both keep  → emit base line
    //   - only A changes → emit A's version
    //   - only B changes → emit B's version
    //   - both change differently → conflict

    // Build edit maps: base_line_idx → {keep/change/delete} for each side
    // We'll use a simple linear scan approach

    MergeResult result;
    std::ostringstream out;

    // Convert diff hunks to a map: base_line_idx → replacement (ours/theirs)
    // Then walk and reconcile
    struct Edit {
        enum { Keep, Delete, Insert } kind;
        std::string line;
        int base_idx = -1;  // for Keep/Delete
    };

    auto build_edits = [](const DiffResult& d) {
        std::vector<Edit> edits;
        for (const auto& h : d.hunks) {
            if (h.op == DiffOp::Equal) {
                edits.push_back({Edit::Keep, h.line, h.line_a - 1});
            } else if (h.op == DiffOp::Delete) {
                edits.push_back({Edit::Delete, h.line, h.line_a - 1});
            } else {
                edits.push_back({Edit::Insert, h.line, -1});
            }
        }
        return edits;
    };

    auto edits_ours   = build_edits(d_ours);
    auto edits_theirs = build_edits(d_theirs);

    // Align both edit sequences relative to base
    // For each base position, determine what ours and theirs emit

    // Group by base index
    int n_base = static_cast<int>(base.size());

    // For each base line: collect ours-edits and theirs-edits
    // ours_before_base[i] = lines inserted by ours before base[i]
    // ours_keeps[i]       = true if ours keeps base[i]
    std::vector<std::vector<std::string>> ours_before(n_base + 1);
    std::vector<bool>                     ours_keeps(n_base, true);
    std::vector<std::vector<std::string>> theirs_before(n_base + 1);
    std::vector<bool>                     theirs_keeps(n_base, true);

    {
        int bi = 0;
        for (const auto& e : edits_ours) {
            if (e.kind == Edit::Keep)   { bi = e.base_idx + 1; }
            else if (e.kind == Edit::Delete) { ours_keeps[e.base_idx] = false; }
            else { ours_before[bi].push_back(e.line); }
        }
    }
    {
        int bi = 0;
        for (const auto& e : edits_theirs) {
            if (e.kind == Edit::Keep)   { bi = e.base_idx + 1; }
            else if (e.kind == Edit::Delete) { theirs_keeps[e.base_idx] = false; }
            else { theirs_before[bi].push_back(e.line); }
        }
    }

    // Now emit merged output
    int conflict_start_line = 1;
    std::vector<std::string> result_lines;

    auto flush_inserts = [&](int pos) {
        // Emit insertions from both sides before position
        const auto& oi = ours_before[pos];
        const auto& ti = theirs_before[pos];

        if (oi == ti) {
            // Both insert same lines → no conflict
            for (auto& l : oi) result_lines.push_back(l);
        } else if (oi.empty()) {
            for (auto& l : ti) result_lines.push_back(l);
        } else if (ti.empty()) {
            for (auto& l : oi) result_lines.push_back(l);
        } else {
            // Conflict in insertions
            ConflictRegion cr;
            cr.line_start = static_cast<int>(result_lines.size()) + 1;
            result_lines.push_back("<<<<<<< " + label_ours);
            for (auto& l : oi) result_lines.push_back(l);
            result_lines.push_back("=======");
            for (auto& l : ti) result_lines.push_back(l);
            result_lines.push_back(">>>>>>> " + label_theirs);
            cr.line_end = static_cast<int>(result_lines.size());
            for (auto& l : oi) cr.ours_content   += l + '\n';
            for (auto& l : ti) cr.theirs_content += l + '\n';
            result.conflicts.push_back(cr);
        }
    };

    for (int i = 0; i < n_base; ++i) {
        flush_inserts(i);

        bool ok_keep   = ours_keeps[i];
        bool th_keep   = theirs_keeps[i];

        if (ok_keep && th_keep) {
            // Both keep base line
            result_lines.push_back(base[i]);
        } else if (!ok_keep && !th_keep) {
            // Both delete — gone, no conflict
        } else if (!ok_keep && th_keep) {
            // Only ours deletes — use ours (delete)
        } else {
            // Only theirs deletes — use theirs (delete)
        }
    }
    // Trailing inserts
    flush_inserts(n_base);

    result.ok = result.conflicts.empty();
    for (const auto& l : result_lines) {
        out << l << '\n';
    }
    result.content = out.str();
    return result;
}

// --------------------------------------------------------------------------
//  Public API
// --------------------------------------------------------------------------
MergeResult merge_strings(const std::string& base,
                          const std::string& ours,
                          const std::string& theirs,
                          const std::string& label_ours,
                          const std::string& label_theirs) {
    return merge_lines(split_lines(base), split_lines(ours), split_lines(theirs),
                       label_ours, label_theirs);
}

MergeResult merge_files(const std::string& base_path,
                        const std::string& ours_path,
                        const std::string& theirs_path) {
    auto read_file = [](const std::string& p) {
        std::ifstream f(p);
        return std::string((std::istreambuf_iterator<char>(f)),
                           std::istreambuf_iterator<char>());
    };
    return merge_strings(read_file(base_path), read_file(ours_path), read_file(theirs_path));
}

}  // namespace dragyou
