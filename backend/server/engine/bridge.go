package engine

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Bridge is the interface between the Go server and the C++ nova engine.
// Phase 1: subprocess bridge (calls the nova CLI binary).
// Phase 2: upgrade to CGo shared library without changing the interface.
type Bridge struct {
	// novaBin is the path to the nova CLI binary.
	// Falls back to "nova" on PATH if not set.
	novaBin string

	// repoStorageRoot is where all repository .nova/ directories live.
	repoStorageRoot string
}

// NewBridge creates a new engine bridge.
func NewBridge(novaBin, repoStorageRoot string) *Bridge {
	if novaBin == "" {
		novaBin = "nova"
	}
	return &Bridge{novaBin: novaBin, repoStorageRoot: repoStorageRoot}
}

// ── Repository operations ─────────────────────────────────────────────────

// InitRepo initializes a bare .nova/ repository at the given storage path.
func (b *Bridge) InitRepo(storagePath string) error {
	if err := os.MkdirAll(storagePath, 0o755); err != nil {
		return fmt.Errorf("init repo dir: %w", err)
	}
	out, err := b.run(storagePath, "init", storagePath)
	if err != nil {
		return fmt.Errorf("nova init: %w — %s", err, out)
	}
	return nil
}

// Status returns the JSON status of a repository.
func (b *Bridge) Status(repoPath string) ([]StatusEntry, error) {
	out, err := b.run(repoPath, "status")
	if err != nil {
		return nil, fmt.Errorf("nova status: %w — %s", err, out)
	}
	// parse JSON output (nova status --json in future; for now plain text)
	return nil, nil
}

// Log returns commit history as structured objects by reading .nova objects directly.
func (b *Bridge) Log(repoPath string, max int) ([]CommitEntry, error) {
	novaDir := filepath.Join(repoPath, ".nova")

	// Resolve HEAD → first commit hash
	startHash, err := resolveRef(novaDir, "HEAD")
	if err != nil || startHash == "" {
		return []CommitEntry{}, nil // no commits yet
	}

	commits := []CommitEntry{}
	current := startHash
	for i := 0; i < max && current != ""; i++ {
		data, objType, err := readObject(novaDir, current)
		if err != nil || objType != "commit" {
			break
		}

		entry := parseCommitEntry(current, data)
		commits = append(commits, entry)

		if len(entry.Parents) == 0 {
			break
		}
		current = entry.Parents[0]
	}
	return commits, nil
}

// parseCommitEntry converts raw commit object bytes into a CommitEntry.
func parseCommitEntry(hash string, data []byte) CommitEntry {
	entry := CommitEntry{Hash: hash, Parents: []string{}}
	text := string(data)
	lines := strings.Split(text, "\n")
	inBody := false
	var msgLines []string

	for _, line := range lines {
		if inBody {
			msgLines = append(msgLines, line)
			continue
		}
		if line == "" {
			inBody = true
			continue
		}
		switch {
		case strings.HasPrefix(line, "tree "):
			entry.Tree = strings.TrimPrefix(line, "tree ")
		case strings.HasPrefix(line, "parent "):
			entry.Parents = append(entry.Parents, strings.TrimPrefix(line, "parent "))
		case strings.HasPrefix(line, "author "):
			sig := strings.TrimPrefix(line, "author ")
			// "Name <email> timestamp tz"
			if lt := strings.Index(sig, "<"); lt >= 0 {
				entry.Author = strings.TrimSpace(sig[:lt])
			}
			// grab timestamp (last two space-separated tokens are timestamp tz)
			parts := strings.Fields(sig)
			if len(parts) >= 2 {
				ts := parts[len(parts)-2]
				fmt.Sscanf(ts, "%d", &entry.Timestamp)
			}
		}
	}
	entry.Message = strings.TrimSpace(strings.Join(msgLines, "\n"))
	return entry
}


// Branches returns the list of branches by reading .nova/refs/heads/ directly.
func (b *Bridge) Branches(repoPath string) ([]BranchEntry, error) {
	novaDir := filepath.Join(repoPath, ".nova")
	headsDir := filepath.Join(novaDir, "refs", "heads")

	// Read current HEAD to determine active branch
	currentBranch := ""
	if data, err := os.ReadFile(filepath.Join(novaDir, "HEAD")); err == nil {
		head := strings.TrimSpace(string(data))
		if strings.HasPrefix(head, "ref: refs/heads/") {
			currentBranch = strings.TrimPrefix(head, "ref: refs/heads/")
		}
	}

	entries, err := os.ReadDir(headsDir)
	if err != nil {
		// No branches dir yet — return empty
		return []BranchEntry{}, nil
	}

	var branches []BranchEntry
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		data, err := os.ReadFile(filepath.Join(headsDir, name))
		if err != nil {
			continue
		}
		hash := strings.TrimSpace(string(data))
		branches = append(branches, BranchEntry{
			Name:    name,
			Current: name == currentBranch,
			Hash:    hash,
		})
	}
	return branches, nil
}


// TreeAt returns the file tree at the given ref/path by reading .nova objects directly.
func (b *Bridge) TreeAt(repoPath, ref, path string) ([]TreeEntry, error) {
	novaDir := filepath.Join(repoPath, ".nova")

	// 1. Resolve ref → commit hash
	commitHash, err := resolveRef(novaDir, ref)
	if err != nil || commitHash == "" {
		return []TreeEntry{}, nil // no commits yet — empty tree
	}

	// 2. Read the commit object → get tree hash
	commitData, _, err := readObject(novaDir, commitHash)
	if err != nil {
		return nil, fmt.Errorf("read commit %s: %w", commitHash[:8], err)
	}
	treeHash := parseCommitTreeHash(commitData)
	if treeHash == "" {
		return nil, fmt.Errorf("commit %s has no tree", commitHash[:8])
	}

	// 3. If path is non-empty, descend into subtree
	if path != "" {
		parts := strings.Split(strings.Trim(path, "/"), "/")
		for _, part := range parts {
			if part == "" {
				continue
			}
			entries, err := readTreeEntries(novaDir, treeHash)
			if err != nil {
				return nil, err
			}
			found := ""
			for _, e := range entries {
				if e.Name == part && e.Type == "tree" {
					found = e.Hash
					break
				}
			}
			if found == "" {
				return []TreeEntry{}, nil
			}
			treeHash = found
		}
	}

	// 4. Read and return the tree entries
	return readTreeEntries(novaDir, treeHash)
}

// BlobAt returns the raw content of a file at the given ref by walking the tree.
func (b *Bridge) BlobAt(repoPath, ref, filePath string) ([]byte, error) {
	novaDir := filepath.Join(repoPath, ".nova")

	commitHash, err := resolveRef(novaDir, ref)
	if err != nil || commitHash == "" {
		return nil, fmt.Errorf("ref %q not found", ref)
	}

	commitData, _, err := readObject(novaDir, commitHash)
	if err != nil {
		return nil, fmt.Errorf("read commit: %w", err)
	}
	treeHash := parseCommitTreeHash(commitData)
	if treeHash == "" {
		return nil, fmt.Errorf("commit has no tree")
	}

	parts := strings.Split(strings.Trim(filePath, "/"), "/")
	for i, part := range parts {
		entries, err := readTreeEntries(novaDir, treeHash)
		if err != nil {
			return nil, err
		}
		found := false
		for _, e := range entries {
			if e.Name != part {
				continue
			}
			if i == len(parts)-1 {
				// This is the target file — read blob content
				data, objType, err := readObject(novaDir, e.Hash)
				if err != nil {
					return nil, fmt.Errorf("read blob %s: %w", e.Hash[:8], err)
				}
				if objType != "blob" {
					return nil, fmt.Errorf("%s is a %s, not a blob", filePath, objType)
				}
				return data, nil
			}
			// Descend into subtree
			treeHash = e.Hash
			found = true
			break
		}
		if !found {
			return nil, fmt.Errorf("file not found: %s", filePath)
		}
	}
	return nil, fmt.Errorf("file not found: %s", filePath)
}

// ── internal object-store helpers ─────────────────────────────────────────

// resolveRef resolves a ref name (branch name, "HEAD", or bare 64-char hash)
// to a commit hash by reading .nova/refs/heads/<ref> or .nova/HEAD.
func resolveRef(novaDir, ref string) (string, error) {
	if ref == "" {
		ref = "HEAD"
	}

	// 1. If HEAD, resolve HEAD target
	if ref == "HEAD" {
		headFile := filepath.Join(novaDir, "HEAD")
		if data, err := os.ReadFile(headFile); err == nil {
			head := strings.TrimSpace(string(data))
			if strings.HasPrefix(head, "ref: ") {
				refPath := strings.TrimSpace(strings.TrimPrefix(head, "ref: "))
				return resolveRef(novaDir, refPath)
			} else if len(head) == 64 {
				return head, nil
			}
		}

		// Fallback: try main or master if HEAD file doesn't exist
		for _, fallback := range []string{"main", "master"} {
			if data, err := os.ReadFile(filepath.Join(novaDir, "refs", "heads", fallback)); err == nil {
				return strings.TrimSpace(string(data)), nil
			}
		}

		return "", nil // empty repository (no commits yet)
	}

	// 2. Try as branch: refs/heads/<ref>
	refFile := filepath.Join(novaDir, "refs", "heads", ref)
	if data, err := os.ReadFile(refFile); err == nil {
		content := strings.TrimSpace(string(data))
		if strings.HasPrefix(content, "ref: ") {
			return resolveRef(novaDir, strings.TrimSpace(strings.TrimPrefix(content, "ref: ")))
		}
		return content, nil
	}

	// 3. Try as full relative path (e.g. refs/tags/v1.0 or refs/heads/main)
	if strings.HasPrefix(ref, "refs/") {
		refFile2 := filepath.Join(novaDir, filepath.FromSlash(ref))
		if data, err := os.ReadFile(refFile2); err == nil {
			content := strings.TrimSpace(string(data))
			if strings.HasPrefix(content, "ref: ") {
				return resolveRef(novaDir, strings.TrimSpace(strings.TrimPrefix(content, "ref: ")))
			}
			return content, nil
		}
	}

	// 4. Treat as bare 64-char hash
	if len(ref) == 64 {
		return ref, nil
	}

	return "", fmt.Errorf("ref not found: %s", ref)
}

// readObject reads and decompresses a .nova object, returning (content, type, error).
// Objects are stored as zlib-compressed: "<type> <size>\0<content>"
func readObject(novaDir, hash string) ([]byte, string, error) {
	if len(hash) < 4 {
		return nil, "", fmt.Errorf("hash too short: %q", hash)
	}
	objPath := filepath.Join(novaDir, "objects", hash[:2], hash[2:])
	compressed, err := os.ReadFile(objPath)
	if err != nil {
		return nil, "", fmt.Errorf("object %s not found: %w", hash[:8], err)
	}

	// zlib decompress
	r, err := zlib.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, "", fmt.Errorf("zlib open %s: %w", hash[:8], err)
	}
	defer r.Close()
	full, err := io.ReadAll(r)
	if err != nil {
		return nil, "", fmt.Errorf("zlib read %s: %w", hash[:8], err)
	}

	// Parse header: "<type> <size>\0"
	nullPos := bytes.IndexByte(full, 0)
	if nullPos < 0 {
		return nil, "", fmt.Errorf("object %s: missing null byte in header", hash[:8])
	}
	header := string(full[:nullPos])
	spPos := strings.Index(header, " ")
	if spPos < 0 {
		return nil, "", fmt.Errorf("object %s: malformed header %q", hash[:8], header)
	}
	objType := header[:spPos]
	content := full[nullPos+1:]
	return content, objType, nil
}

// parseCommitTreeHash extracts the tree hash from a commit object's text content.
func parseCommitTreeHash(commitContent []byte) string {
	for _, line := range strings.Split(string(commitContent), "\n") {
		if strings.HasPrefix(line, "tree ") {
			return strings.TrimSpace(line[5:])
		}
	}
	return ""
}

// readTreeEntries parses a tree object and returns its entries.
// Tree wire format per entry: "<mode> <name>\0<32 raw bytes (SHA-256)>"
func readTreeEntries(novaDir, treeHash string) ([]TreeEntry, error) {
	data, objType, err := readObject(novaDir, treeHash)
	if err != nil {
		return nil, fmt.Errorf("read tree %s: %w", treeHash[:8], err)
	}
	if objType != "tree" {
		return nil, fmt.Errorf("expected tree object, got %s", objType)
	}

	var entries []TreeEntry
	pos := 0
	for pos < len(data) {
		// Read "<mode> <name>\0"
		spacePos := bytes.IndexByte(data[pos:], ' ')
		if spacePos < 0 {
			break
		}
		mode := string(data[pos : pos+spacePos])
		pos += spacePos + 1

		nullPos := bytes.IndexByte(data[pos:], 0)
		if nullPos < 0 {
			break
		}
		name := string(data[pos : pos+nullPos])
		pos += nullPos + 1

		// Read 32 raw bytes → 64-char hex hash
		if pos+32 > len(data) {
			break
		}
		hashBytes := data[pos : pos+32]
		pos += 32

		hash := fmt.Sprintf("%x", hashBytes)

		entryType := "blob"
		size := int64(0)
		if mode == "040000" || mode == "40000" {
			entryType = "tree"
		} else {
			// Try to get blob size
			if blobData, _, err2 := readObject(novaDir, hash); err2 == nil {
				size = int64(len(blobData))
			}
		}

		entries = append(entries, TreeEntry{
			Name: name,
			Type: entryType,
			Hash: hash,
			Mode: mode,
			Size: size,
		})
	}
	return entries, nil
}



// ApplyPack writes all objects in a pack to the local object store.
// Wire format (matches remote.h Pack::serialize):
//   Magic:   "DNYPACK\0"  (8 bytes)
//   Version: uint32 BE   (4 bytes) = 1
//   Count:   uint32 BE   (4 bytes)
//   Entries: [type:1][hash_len:1][hash:hash_len][size:8 BE][data:size]
func (b *Bridge) ApplyPack(repoPath string, packData []byte) error {
	if len(packData) < 16 {
		return fmt.Errorf("invalid pack: too small (%d bytes)", len(packData))
	}

	// Validate DNYPACK magic (8 bytes: "DNYPACK\0")
	if string(packData[:7]) != "DNYPACK" {
		return fmt.Errorf("invalid pack magic: %q", string(packData[:8]))
	}

	// Version (bytes 8–11)
	_ = packData[8:12] // version, ignored for now

	// Count (bytes 12–15)
	count := int(packData[12])<<24 | int(packData[13])<<16 |
		int(packData[14])<<8 | int(packData[15])
	if count == 0 {
		return nil
	}

	objectsDir := filepath.Join(repoPath, ".nova", "objects")

	offset := 16
	for i := 0; i < count; i++ {
		if offset+2 > len(packData) {
			return fmt.Errorf("pack truncated at entry %d (offset %d)", i, offset)
		}

		// type byte (1 byte)
		typeByte := packData[offset]
		offset++

		var typeStr string
		switch typeByte {
		case 1:
			typeStr = "blob"
		case 2:
			typeStr = "tree"
		case 3:
			typeStr = "commit"
		case 4:
			typeStr = "tag"
		default:
			typeStr = "blob"
		}

		// hash_len byte (1 byte)
		hashLen := int(packData[offset])
		offset++

		if offset+hashLen > len(packData) {
			return fmt.Errorf("pack truncated reading hash at entry %d", i)
		}
		hash := string(packData[offset : offset+hashLen])
		offset += hashLen

		if offset+8 > len(packData) {
			return fmt.Errorf("pack truncated reading size at entry %d", i)
		}

		// data size (8 bytes BE)
		dataSize := int64(packData[offset])<<56 | int64(packData[offset+1])<<48 |
			int64(packData[offset+2])<<40 | int64(packData[offset+3])<<32 |
			int64(packData[offset+4])<<24 | int64(packData[offset+5])<<16 |
			int64(packData[offset+6])<<8 | int64(packData[offset+7])
		offset += 8

		if int64(offset)+dataSize > int64(len(packData)) {
			return fmt.Errorf("pack truncated reading data at entry %d (need %d bytes)", i, dataSize)
		}
		data := packData[offset : int64(offset)+dataSize]
		offset += int(dataSize)

		if len(hash) < 4 {
			return fmt.Errorf("entry %d: hash too short (%q)", i, hash)
		}

		// Format full object: "<type> <size>\0<data>"
		hdr := fmt.Sprintf("%s %d\x00", typeStr, len(data))
		full := append([]byte(hdr), data...)

		// zlib compress
		var zbuf bytes.Buffer
		zw := zlib.NewWriter(&zbuf)
		if _, err := zw.Write(full); err != nil {
			return fmt.Errorf("zlib compress %s: %w", hash, err)
		}
		zw.Close()
		compressed := zbuf.Bytes()

		// Write to .nova/objects/<prefix2>/<rest>
		prefix := hash[:2]
		rest := hash[2:]
		dir := filepath.Join(objectsDir, prefix)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("mkdirall %s: %w", dir, err)
		}
		objPath := filepath.Join(dir, rest)
		if err := os.WriteFile(objPath, compressed, 0o644); err != nil {
			return fmt.Errorf("write object %s: %w", hash, err)
		}
	}

	return nil
}

// UpdateRef atomically updates a ref in the repository.
// Writes directly to .nova/refs/<ref> to match how the C++ engine stores refs.
func (b *Bridge) UpdateRef(repoPath, ref, tip string) error {
	if ref == "" || tip == "" {
		return fmt.Errorf("UpdateRef: ref and tip must not be empty")
	}
	// Sanitise: strip leading "refs/" prefix duplication and resolve to path
	refPath := filepath.Join(repoPath, ".nova", filepath.FromSlash(ref))
	if err := os.MkdirAll(filepath.Dir(refPath), 0o755); err != nil {
		return fmt.Errorf("UpdateRef mkdir %s: %w", filepath.Dir(refPath), err)
	}
	// Write hash + newline (matches how nova CLI reads refs)
	if err := os.WriteFile(refPath, []byte(tip+"\n"), 0o644); err != nil {
		return fmt.Errorf("UpdateRef write %s: %w", refPath, err)
	}

	// Also ensure HEAD exists and points to this ref
	headPath := filepath.Join(repoPath, ".nova", "HEAD")
	if _, err := os.Stat(headPath); os.IsNotExist(err) {
		_ = os.WriteFile(headPath, []byte("ref: "+ref+"\n"), 0o644)
	}
	return nil
}

// BuildFetchPack builds a pack of objects the client needs (server → client).
func (b *Bridge) BuildFetchPack(repoPath string, have, want []string) ([]byte, error) {
	// Phase 4 stub: delegate to nova fetch-pack subcommand
	// Returns empty pack if nothing to send
	return []byte{}, nil
}

// BuildClonePack builds a pack containing all commits, trees, and blobs for cloning.
func (b *Bridge) BuildClonePack(repoPath, branch string, depth int) ([]byte, error) {
	objectsDir := filepath.Join(repoPath, ".nova", "objects")

	buf := new(bytes.Buffer)
	// Write 8-byte magic: DNYPACK\0
	buf.WriteString("DNYPACK\x00")
	// Write 4-byte BE version = 1
	_ = binary.Write(buf, binary.BigEndian, uint32(1))

	if _, err := os.Stat(objectsDir); os.IsNotExist(err) {
		// Empty pack count = 0
		_ = binary.Write(buf, binary.BigEndian, uint32(0))
		return buf.Bytes(), nil
	}

	type objectEntry struct {
		objType byte
		hash    string
		content []byte
	}

	var entries []objectEntry

	_ = filepath.Walk(objectsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(objectsDir, path)
		if err != nil {
			return nil
		}
		parts := strings.Split(rel, string(filepath.Separator))
		if len(parts) != 2 {
			return nil
		}
		hash := parts[0] + parts[1]

		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()

		zr, err := zlib.NewReader(f)
		if err != nil {
			return nil
		}
		defer zr.Close()

		decompressed, err := io.ReadAll(zr)
		if err != nil {
			return nil
		}

		idx := bytes.IndexByte(decompressed, 0)
		if idx == -1 {
			return nil
		}

		header := string(decompressed[:idx])
		content := decompressed[idx+1:]

		headerParts := strings.Split(header, " ")
		if len(headerParts) < 1 {
			return nil
		}

		var objType byte
		switch headerParts[0] {
		case "blob":
			objType = 1
		case "tree":
			objType = 2
		case "commit":
			objType = 3
		case "tag":
			objType = 4
		default:
			return nil
		}

		entries = append(entries, objectEntry{
			objType: objType,
			hash:    hash,
			content: content,
		})
		return nil
	})

	// Write uint32 count
	_ = binary.Write(buf, binary.BigEndian, uint32(len(entries)))

	for _, e := range entries {
		buf.WriteByte(e.objType)                       // 1 byte type
		buf.WriteByte(byte(len(e.hash)))               // 1 byte hash len (64)
		buf.WriteString(e.hash)                       // 64 bytes hash
		_ = binary.Write(buf, binary.BigEndian, uint64(len(e.content))) // 8 bytes content size
		buf.Write(e.content)                           // content payload
	}

	return buf.Bytes(), nil
}

// RepoPath constructs the on-disk path for a given owner/repo.
func (b *Bridge) RepoPath(owner, repo string) string {
	return filepath.Join(b.repoStorageRoot, owner, repo)
}

// ── Data types ────────────────────────────────────────────────────────────

type StatusEntry struct {
	Path  string `json:"path"`
	Index string `json:"index"`
	Work  string `json:"work"`
}

type CommitEntry struct {
	Hash      string   `json:"hash"`
	Message   string   `json:"message"`
	Author    string   `json:"author"`
	Timestamp int64    `json:"timestamp"`
	Tree      string   `json:"tree"`
	Parents   []string `json:"parents"`
}

type BranchEntry struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
	Hash    string `json:"hash"`
}

type TreeEntry struct {
	Name string `json:"name"`
	Type string `json:"type"` // "blob" or "tree"
	Hash string `json:"hash"`
	Mode string `json:"mode"`
	Size int64  `json:"size,omitempty"`
}

// ── internal ──────────────────────────────────────────────────────────────

// run executes the nova CLI in the given working directory.
func (b *Bridge) run(cwd string, args ...string) (string, error) {
	cmd := exec.Command(b.novaBin, args...)
	cmd.Dir = cwd

	out, err := cmd.CombinedOutput()
	result := strings.TrimSpace(string(out))
	if err != nil {
		return result, fmt.Errorf("exit %w", err)
	}
	return result, nil
}
