#pragma once
// =============================================================================
//  Dragyou VCS — C API (for CGo bridging)
//  All functions use only C-compatible types.
//  Strings returned by dragyou_* functions are heap-allocated.
//  Callers MUST call dragyou_free_string() on them.
// =============================================================================

#ifdef __cplusplus
extern "C" {
#endif

// --------------------------------------------------------------------------
//  Error codes
// --------------------------------------------------------------------------
#define DRAGYOU_OK              0
#define DRAGYOU_ERR_NOT_REPO   -1
#define DRAGYOU_ERR_IO         -2
#define DRAGYOU_ERR_INVALID    -3
#define DRAGYOU_ERR_CONFLICT   -4
#define DRAGYOU_ERR_EXISTS     -5

// --------------------------------------------------------------------------
//  Memory management
// --------------------------------------------------------------------------
void dragyou_free_string(char* s);

// --------------------------------------------------------------------------
//  Repository operations
// --------------------------------------------------------------------------

/// Initialize a new repository at 'path'.
/// Returns DRAGYOU_OK or an error code.
int dragyou_init(const char* path);

/// Stage a file. 'repo' is the repo root, 'rel_path' is repo-relative.
int dragyou_add(const char* repo, const char* rel_path);

/// Remove a file from the index (does not delete from disk).
int dragyou_remove(const char* repo, const char* rel_path);

/// Create a commit. Returns DRAGYOU_OK or error.
/// 'author' format: "Name <email>"
int dragyou_commit(const char* repo, const char* message, const char* author);

/// Return status as a JSON string:
/// [{"path":"src/foo.cpp","index":"modified","work":"unmodified"}, ...]
/// Caller must free with dragyou_free_string().
char* dragyou_status(const char* repo);

/// Return commit log as a JSON string (array of commit objects).
/// Caller must free with dragyou_free_string().
char* dragyou_log(const char* repo, int max_count);

/// Create a branch.
int dragyou_branch_create(const char* repo, const char* name);

/// Delete a branch.
int dragyou_branch_delete(const char* repo, const char* name);

/// List all branches as a JSON array of strings.
char* dragyou_branch_list(const char* repo);

/// Checkout a branch or commit.
int dragyou_checkout(const char* repo, const char* name);

/// Return unified diff of working tree vs index (or HEAD if nothing staged).
char* dragyou_diff(const char* repo);

/// Merge branch 'theirs' into current branch.
/// Returns DRAGYOU_OK if clean merge, DRAGYOU_ERR_CONFLICT if conflicts.
int dragyou_merge(const char* repo, const char* theirs_branch);

/// Return current HEAD branch name (or hash if detached).
char* dragyou_head(const char* repo);

/// Get last error message (thread-local).
const char* dragyou_last_error(void);

#ifdef __cplusplus
}
#endif
