// =============================================================================
//  Dragyou VCS — Myers Diff Engine
//  Reference: Eugene Myers, "An O(ND) Difference Algorithm", Algorithmica 1986
// =============================================================================

#include "diff.h"

#include <algorithm>
#include <cassert>
#include <fstream>
#include <limits>
#include <sstream>

namespace dragyou {

// --------------------------------------------------------------------------
//  Helpers
// --------------------------------------------------------------------------
std::vector<std::string> split_lines(const std::string& text) {
    std::vector<std::string> lines;
    std::istringstream iss(text);
    std::string line;
    while (std::getline(iss, line)) lines.push_back(line);
    return lines;
}

std::string join_lines(const std::vector<std::string>& lines) {
    std::string out;
    for (size_t i = 0; i < lines.size(); ++i) {
        out += lines[i];
        out += '\n';
    }
    return out;
}

// --------------------------------------------------------------------------
//  Myers diff core
//
//  Returns a list of edit operations on B relative to A.
//  Each element is a pair {op, index_in_a_or_b}.
// --------------------------------------------------------------------------
struct EditStep {
    DiffOp op;
    int    idx_a;  // index in A (-1 if Insert)
    int    idx_b;  // index in B (-1 if Delete)
};

static std::vector<EditStep> myers_ses(const std::vector<std::string>& a,
                                       const std::vector<std::string>& b) {
    int n = static_cast<int>(a.size());
    int m = static_cast<int>(b.size());
    int max = n + m;

    // v[k] = furthest reaching x on diagonal k
    std::vector<int> v(2 * max + 2, 0);
    // trace[d] = copy of v after d edits
    std::vector<std::vector<int>> trace;

    for (int d = 0; d <= max; ++d) {
        trace.push_back(v);
        for (int k = -d; k <= d; k += 2) {
            int idx = k + max;
            int x;
            if (k == -d || (k != d && v[idx - 1] < v[idx + 1])) {
                x = v[idx + 1];  // move down
            } else {
                x = v[idx - 1] + 1;  // move right
            }
            int y = x - k;
            // Extend diagonal (snake)
            while (x < n && y < m && a[x] == b[y]) { ++x; ++y; }
            v[idx] = x;
            if (x >= n && y >= m) {
                // Backtrack to find the actual edits
                std::vector<EditStep> steps;
                int cx = n, cy = m;
                for (int dd = d; dd > 0; --dd) {
                    const auto& vv = trace[dd];
                    int kk = cx - cy;
                    int kk_idx = kk + max;
                    bool went_down;
                    if (kk == -dd || (kk != dd && vv[kk_idx - 1] < vv[kk_idx + 1])) {
                        went_down = true;
                    } else {
                        went_down = false;
                    }

                    int px, py;
                    if (went_down) {
                        px = vv[kk_idx + 1];
                        py = px - (kk + 1);
                    } else {
                        px = vv[kk_idx - 1];
                        py = px - (kk - 1);
                    }

                    // snake backwards
                    while (cx > px && cy > py) {
                        steps.push_back({DiffOp::Equal, cx - 1, cy - 1});
                        --cx; --cy;
                    }

                    if (went_down) {
                        steps.push_back({DiffOp::Insert, -1, cy - 1});
                        --cy;
                    } else {
                        steps.push_back({DiffOp::Delete, cx - 1, -1});
                        --cx;
                    }
                }
                // Remaining snake at start
                while (cx > 0 && cy > 0) {
                    steps.push_back({DiffOp::Equal, cx - 1, cy - 1});
                    --cx; --cy;
                }
                std::reverse(steps.begin(), steps.end());
                return steps;
            }
        }
    }
    return {};
}

// --------------------------------------------------------------------------
//  diff_lines
// --------------------------------------------------------------------------
DiffResult diff_lines(const std::vector<std::string>& a,
                      const std::vector<std::string>& b) {
    auto steps = myers_ses(a, b);
    DiffResult result;
    for (const auto& s : steps) {
        DiffHunk h;
        h.op = s.op;
        switch (s.op) {
            case DiffOp::Equal:
                h.line   = a[s.idx_a];
                h.line_a = s.idx_a + 1;
                h.line_b = s.idx_b + 1;
                break;
            case DiffOp::Delete:
                h.line   = a[s.idx_a];
                h.line_a = s.idx_a + 1;
                break;
            case DiffOp::Insert:
                h.line   = b[s.idx_b];
                h.line_b = s.idx_b + 1;
                break;
        }
        result.hunks.push_back(h);
    }
    return result;
}

DiffResult diff_strings(const std::string& a, const std::string& b) {
    return diff_lines(split_lines(a), split_lines(b));
}

DiffResult diff_files(const std::string& path_a, const std::string& path_b) {
    auto read_file = [](const std::string& p) -> std::string {
        std::ifstream f(p);
        if (!f) return "";
        return std::string((std::istreambuf_iterator<char>(f)),
                           std::istreambuf_iterator<char>());
    };
    return diff_strings(read_file(path_a), read_file(path_b));
}

// --------------------------------------------------------------------------
//  DiffResult accessors
// --------------------------------------------------------------------------
int DiffResult::added() const {
    int n = 0;
    for (auto& h : hunks) if (h.op == DiffOp::Insert) ++n;
    return n;
}

int DiffResult::deleted() const {
    int n = 0;
    for (auto& h : hunks) if (h.op == DiffOp::Delete) ++n;
    return n;
}

bool DiffResult::empty() const {
    for (auto& h : hunks) if (h.op != DiffOp::Equal) return false;
    return true;
}

// --------------------------------------------------------------------------
//  Unified diff formatter
// --------------------------------------------------------------------------
std::string DiffResult::to_unified(const std::string& name_a,
                                   const std::string& name_b,
                                   int context_lines) const {
    if (hunks.empty()) return "";

    std::ostringstream out;
    out << "--- " << name_a << '\n';
    out << "+++ " << name_b << '\n';

    // Group hunks into change regions with context
    struct Hunk {
        int start_a, start_b, count_a, count_b;
        std::vector<std::string> lines;
    };

    std::vector<Hunk> unified_hunks;
    size_t i = 0;

    while (i < hunks.size()) {
        // Find next non-Equal hunk
        if (hunks[i].op == DiffOp::Equal) { ++i; continue; }

        // Start of a change region
        int hunk_start = static_cast<int>(i);
        // Expand backwards for context
        int ctx_start = std::max(0, hunk_start - context_lines);

        Hunk h;
        h.start_a = (ctx_start < (int)hunks.size() && hunks[ctx_start].line_a > 0)
                    ? hunks[ctx_start].line_a : 1;
        h.start_b = (ctx_start < (int)hunks.size() && hunks[ctx_start].line_b > 0)
                    ? hunks[ctx_start].line_b : 1;
        h.count_a = 0;
        h.count_b = 0;

        // Add pre-context
        for (int j = ctx_start; j < hunk_start; ++j) {
            h.lines.push_back(" " + hunks[j].line);
            h.count_a++; h.count_b++;
        }

        // Add changes + post-context
        while (i < hunks.size()) {
            if (hunks[i].op == DiffOp::Equal) {
                // Check if this is just post-context before next change
                bool near_change = false;
                for (int k = 1; k <= context_lines && (i + k) < hunks.size(); ++k) {
                    if (hunks[i + k].op != DiffOp::Equal) { near_change = true; break; }
                }
                if (!near_change && (int)(i - hunk_start) >= context_lines) break;

                h.lines.push_back(" " + hunks[i].line);
                h.count_a++; h.count_b++;
            } else if (hunks[i].op == DiffOp::Delete) {
                h.lines.push_back("-" + hunks[i].line);
                h.count_a++;
            } else {
                h.lines.push_back("+" + hunks[i].line);
                h.count_b++;
            }
            ++i;
        }
        unified_hunks.push_back(h);
    }

    for (const auto& h : unified_hunks) {
        out << "@@ -" << h.start_a << "," << h.count_a
            << " +" << h.start_b << "," << h.count_b << " @@\n";
        for (const auto& l : h.lines) out << l << '\n';
    }

    return out.str();
}

}  // namespace dragyou
