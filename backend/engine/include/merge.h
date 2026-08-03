#pragma once
// =============================================================================
//  Dragyou VCS — Three-Way Merge Engine
//
//  Algorithm:
//    1. Diff BASE→OURS  to find changes A made
//    2. Diff BASE→THEIRS to find changes B made
//    3. Apply both; if they touch different regions → clean merge
//       If same region changed differently → conflict
//
//  Conflict marker format (like Git):
//    <<<<<<< OURS
//    their changes here
//    =======
//    our changes here
//    >>>>>>> THEIRS
// =============================================================================

#include <string>
#include <vector>

namespace dragyou {

// --------------------------------------------------------------------------
//  Merge result
// --------------------------------------------------------------------------
struct ConflictRegion {
    int    line_start = 0;   // 1-based in result
    int    line_end   = 0;
    std::string ours_content;
    std::string theirs_content;
};

struct MergeResult {
    bool                        ok = true;   // false if has conflicts
    std::string                 content;     // merged content (with markers if conflicts)
    std::vector<ConflictRegion> conflicts;

    int conflict_count() const { return static_cast<int>(conflicts.size()); }
};

// --------------------------------------------------------------------------
//  Merge functions
// --------------------------------------------------------------------------

/// Three-way merge of text content
MergeResult merge_strings(const std::string& base,
                          const std::string& ours,
                          const std::string& theirs,
                          const std::string& label_ours   = "OURS",
                          const std::string& label_theirs = "THEIRS");

/// Three-way merge of files on disk
MergeResult merge_files(const std::string& base_path,
                        const std::string& ours_path,
                        const std::string& theirs_path);

/// Three-way merge of line vectors
MergeResult merge_lines(const std::vector<std::string>& base,
                        const std::vector<std::string>& ours,
                        const std::vector<std::string>& theirs,
                        const std::string& label_ours   = "OURS",
                        const std::string& label_theirs = "THEIRS");

}  // namespace dragyou
