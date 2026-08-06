# Dragyou VCS — Backend

A Git-inspired, enterprise-scale Version Control System with:
- **C++20 VCS Engine** — SHA-256 objects, staging index, Myers diff, 3-way merge
- **`drag` CLI** — `init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `diff`, `merge`
- **Go Platform Server** — JWT auth, repository API, PostgreSQL, rate limiting

---

## Directory Structure

```
backend/
├── engine/          ← C++ VCS core (builds libdragyou_engine)
│   ├── include/     ← Public headers
│   ├── src/         ← Implementations
│   └── third_party/ ← picosha2 (SHA-256, header-only)
├── cli/             ← drag CLI (C++, links against engine)
│   └── src/
└── server/          ← Go platform backend (REST API)
    ├── api/         ← Route handlers
    ├── config/      ← Configuration
    ├── engine/      ← C++ engine bridge
    ├── middleware/   ← Auth + rate limiting
    ├── models/      ← GORM models
    └── storage/     ← PostgreSQL connection
```

---

## Prerequisites

### Required tools

| Tool | Version | Install |
|------|---------|---------|
| CMake | ≥ 3.20 | https://cmake.org/download/ |
| C++ compiler | C++20 | Visual Studio 2022 **or** MSYS2/MinGW-w64 |
| zlib | any | Included with MSYS2; or vcpkg |
| Go | ≥ 1.22 | https://go.dev/dl/ |
| PostgreSQL | ≥ 15 | https://www.postgresql.org/download/ |

### Recommended: MSYS2 (Windows)

```powershell
# 1. Install MSYS2 from https://www.msys2.org
# 2. Open MSYS2 MINGW64 shell and run:
pacman -S mingw-w64-x86_64-cmake mingw-w64-x86_64-gcc mingw-w64-x86_64-zlib mingw-w64-x86_64-ninja
```

### Alternative: Visual Studio 2022

Install "Desktop development with C++" workload and install zlib via vcpkg:

```powershell
vcpkg install zlib:x64-windows
```

---

## Build — C++ Engine + CLI

### Using MSYS2/MinGW (recommended)

```bash
# Open MSYS2 MINGW64 shell
cd /d/Dragyou/backend
mkdir build && cd build
cmake .. -G "Ninja" -DCMAKE_BUILD_TYPE=Release
ninja
```

The `drag.exe` binary will be at `build/bin/drag.exe`.

### Using Visual Studio

```powershell
cd d:\Dragyou\backend
mkdir build
cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DCMAKE_TOOLCHAIN_FILE=<vcpkg-root>/scripts/buildsystems/vcpkg.cmake
cmake --build . --config Release
```

---

## Test the CLI

```powershell
# Add build/bin to PATH (or use full path)
$env:PATH = "d:\Dragyou\backend\build\bin;" + $env:PATH

# Create a test repo
mkdir d:\test-repo
cd d:\test-repo
drag init

# Stage and commit files
echo "hello dragyou" > hello.txt
drag add hello.txt
drag commit -m "initial commit"

# Check status and log
drag status
drag log

# Branch workflow
drag branch feature-auth
drag checkout feature-auth
echo "auth feature" > auth.txt
drag add auth.txt
drag commit -m "add auth feature"
drag diff
drag checkout main
drag merge feature-auth
drag log
```

---

## Build — Go Server

```powershell
# Install Go from https://go.dev/dl/ first

cd d:\Dragyou\backend\server

# Copy env file
Copy-Item .env.example .env
# Edit .env with your PostgreSQL credentials

# Download dependencies
go mod tidy

# Run development server
go run .
```

The API will be available at **http://localhost:8080**

---

## API Quick Start

```powershell
# Register
curl -X POST http://localhost:8080/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","email":"alice@example.com","password":"secret123"}'

# Login → get access_token
curl -X POST http://localhost:8080/api/v1/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username":"alice","password":"secret123"}'

# Create a repository
curl -X POST http://localhost:8080/api/v1/repos `
  -H "Authorization: Bearer <access_token>" `
  -H "Content-Type: application/json" `
  -d '{"name":"my-project","visibility":"private"}'

# List repositories
curl http://localhost:8080/api/v1/repos

# Get commits
curl http://localhost:8080/api/v1/repos/alice/my-project/commits

# Health check
curl http://localhost:8080/health
```

---

## API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Register new user |
| POST | `/api/v1/auth/login` | — | Login, get JWT tokens |
| GET | `/api/v1/auth/me` | ✅ | Current user profile |
| POST | `/api/v1/auth/logout` | ✅ | Logout |

### Users
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/users/:username` | — | User public profile |
| GET | `/api/v1/users/:username/repos` | — | User's public repos |

### Repositories
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/repos` | ✅ | Create repository |
| GET | `/api/v1/repos` | — | List repositories |
| GET | `/api/v1/repos/:owner/:repo` | — | Get repository |
| DELETE | `/api/v1/repos/:owner/:repo` | ✅ | Delete repository |
| GET | `/api/v1/repos/:owner/:repo/commits` | — | Commit history |
| GET | `/api/v1/repos/:owner/:repo/branches` | — | Branch list |
| GET | `/api/v1/repos/:owner/:repo/tree/:ref/*` | — | File tree |
| GET | `/api/v1/repos/:owner/:repo/blob/:ref/*` | — | File content |

### Pull Requests
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/repos/:owner/:repo/pulls` | — | List PRs |
| POST | `/api/v1/repos/:owner/:repo/pulls` | ✅ | Create PR |

### Issues
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/repos/:owner/:repo/issues` | — | List issues |
| POST | `/api/v1/repos/:owner/:repo/issues` | ✅ | Create issue |

---

## Rate Limiting

| User type | Limit |
|-----------|-------|
| Anonymous | 100 req/min |
| Authenticated | 1000 req/min |

Redis-backed distributed rate limiting will replace the in-memory implementation in Phase 8.

---

## Object Model

```
Working Tree
     │  drag add
     ▼
   Index (.drag/index)
     │  drag commit
     ▼
   Tree (SHA-256)
     │
     ▼
  Commit (SHA-256)
     │
     ▼
  refs/heads/main → commit hash
     │
     ▼
  HEAD → ref: refs/heads/main
```

Objects are stored compressed (zlib) in `.drag/objects/<2-char-prefix>/<62-char-hash>`.

---

## Roadmap

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | C++ VCS Engine (objects, diff, merge) |
| 2 | ✅ Done | drag CLI (all commands) |
| 3 | ✅ Done | Go REST API (auth, repos, PRs, issues) |
| 4 | 🔜 Next | Remote protocol (push/pull) |
| 5 | 🔜 | SSH key auth + Argon2id |
| 6 | 🔜 | React/Next.js Frontend |
| 7 | 🔜 | Full PR review workflow |
| 8 | 🔜 | Redis rate limiting + caching |
| 9 | 🔜 | Read replicas + cache layer |
| 10 | 🔜 | Kafka async event processing |
| 11 | 🔜 | Packfile + delta compression |
| 12 | 🔜 | Code search (OpenSearch) |
| 13 | 🔜 | Reliability + circuit breakers |
| 14 | 🔜 | OpenTelemetry observability |
| 15 | 🔜 | Security hardening |
