#pragma once
// =============================================================================
//  Dragyou VCS — Myers Diff Engine
//  Implements the Myers O(ND) diff algorithm for line-based diffs.
//  Reference: Eugene W. Myers, "An O(ND) Difference Algorithm and Its
//             Variations", Algorithmica 1:2, pp. 251–266, 1986.
// =============================================================================

#include <string>
#include <vector>

namespace dragyou {

// --------------------------------------------------------------------------
//  Diff hunk types
// --------------------------------------------------------------------------
enum class DiffOp {
    Equal,   // line exists in both A and B
    Insert,  // line added in B (not in A)
    Delete,  // line removed from A (not in B)
};

struct DiffHunk {
    DiffOp      op;
    std::string line;
    int         line_a = -1;   // 1-based line number in A, -1 if not applicable
    int         line_b = -1;   // 1-based line number in B, -1 if not applicable
};

// --------------------------------------------------------------------------
//  Diff result
// --------------------------------------------------------------------------
struct DiffResult {
    std::vector<DiffHunk> hunks;

    /// Format as a unified diff patch string
    std::string to_unified(const std::string& name_a = "a",
                           const std::string& name_b = "b",
                           int context_lines = 3) const;

    int added()   const;
    int deleted() const;
    bool empty()  const;
};

// --------------------------------------------------------------------------
//  Core diff functions
// --------------------------------------------------------------------------

/// Diff two sequences of lines using Myers algorithm
DiffResult diff_lines(const std::vector<std::string>& a,
                      const std::vector<std::string>& b);

/// Convenience: split string into lines and diff
DiffResult diff_strings(const std::string& a, const std::string& b);

/// Diff two files on disk
DiffResult diff_files(const std::string& path_a, const std::string& path_b);

// --------------------------------------------------------------------------
//  Helper
// --------------------------------------------------------------------------
std::vector<std::string> split_lines(const std::string& text);
std::string              join_lines(const std::vector<std::string>& lines);

}  // namespace dragyou
