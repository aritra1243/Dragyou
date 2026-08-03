# Dragyou VCS — Monorepo Architecture

**Dragyou** is a modern, high-performance Version Control System built specifically for giant monorepos, virtual clones, and enterprise collaboration workflows.

---

## 🏗️ Architecture Overview

```
                      DEVELOPER / USER
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
    React + Next.js Frontend             Nova C++ CLI
   (Web Dashboard & Browser)          (Local VCS commands)
            │                                 │
            └────────────────┬────────────────┘
                             │
                    HTTP REST & Pack API
                             │
                             ▼
                    Go Platform Backend
                    (Auth, Repos, PRs)
                             │
                    C++ VCS Core Engine
                 (SHA-256, Objects, Diff)
```

---

## 📂 Repository Structure

- `backend/`
  - `engine/` — C++20 VCS Core (SHA-256 objects, Myers diff, 3-way merge, pack engine)
  - `cli/` — C++ `nova` CLI executable (`init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `diff`, `merge`, `remote`, `push`, `pull`, `clone`, `login`)
  - `server/` — Go Platform REST API backend (Chi router, JWT authentication, PostgreSQL, GORM, rate limiting, remote pack protocol)
- `frontend/` — Next.js 14 (React, TypeScript, TailwindCSS, Lucide icons, glassmorphism dark UI)

---

## 🚀 Getting Started

### 1. Build Backend (C++ Engine + CLI)

```powershell
# Requirements: CMake 3.20+, Visual Studio 2022 Build Tools (MSVC) or GCC
cd d:\Dragyou\backend
.\build.ps1
```

The compiled `nova.exe` CLI binary will be located in `backend/build/bin/nova.exe`.

### 2. Start Go Server

```powershell
# Requirements: Go 1.22+, PostgreSQL
cd d:\Dragyou\backend\server
Copy-Item .env.example .env
$env:PATH = "C:\Program Files\Go\bin;" + $env:PATH
go run .
```

The API server runs at **http://localhost:8080**

### 3. Start Next.js Frontend

```powershell
cd d:\Dragyou\frontend
npm run dev
```

The web dashboard is live at **http://localhost:3000**

---

## 🧪 Testing Nova CLI

```powershell
# 1. Initialize a test repository
mkdir d:\my-test-repo
cd d:\my-test-repo
nova init

# 2. Add and commit files
echo "Hello Dragyou" > hello.txt
nova add hello.txt
nova commit -m "initial commit"
nova status
nova log

# 3. Branch & merge
nova branch dev
nova checkout dev
echo "Feature work" > feature.txt
nova add feature.txt
nova commit -m "add feature"
nova diff
nova checkout main
nova merge dev

# 4. Remote push & pull
nova login http://localhost:8080
nova remote add origin http://localhost:8080/api/v1/repos/alice/my-test-repo.nova
nova push origin main
```
