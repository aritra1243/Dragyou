# ============================================================
#  Dragyou Backend Build Script (Windows PowerShell)
#  Run from: d:\Dragyou\backend\
# ============================================================

param(
    [string]$Target = "all",    # all | engine | cli | server | clean
    [string]$BuildType = "Release",
    [string]$Generator = ""       # Leave empty to let CMake auto-detect (e.g., Visual Studio)
)

$Root      = $PSScriptRoot
$BuildDir  = Join-Path $Root "build"
$BinDir    = Join-Path $BuildDir "bin"
$ServerDir = Join-Path $Root "server"

function Write-Step([string]$msg) {
    Write-Host "`n===> $msg" -ForegroundColor Cyan
}

function Assert-Tool([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "ERROR: '$name' not found in PATH." -ForegroundColor Red
        Write-Host "See backend\README.md for installation instructions."
        exit 1
    }
}

# ── Clean ────────────────────────────────────────────────────────────────
if ($Target -eq "clean") {
    Write-Step "Cleaning build directory"
    Remove-Item -Recurse -Force $BuildDir -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

# ── C++ Engine + CLI ─────────────────────────────────────────────────────
if ($Target -in @("all", "engine", "cli")) {
    Write-Step "Building C++ Engine and nova CLI"

    Assert-Tool "cmake"

    if (-not (Test-Path $BuildDir)) {
        New-Item -ItemType Directory -Path $BuildDir | Out-Null
    }

    Push-Location $BuildDir
    try {
        Write-Host "Configuring with CMake..."
        if ($Generator) {
            cmake .. -G $Generator -DCMAKE_BUILD_TYPE=$BuildType
        } else {
            cmake .. -DCMAKE_BUILD_TYPE=$BuildType
        }
        if ($LASTEXITCODE -ne 0) { throw "CMake configure failed" }

        Write-Host "Building..."
        cmake --build . --config $BuildType
        if ($LASTEXITCODE -ne 0) { throw "CMake build failed" }

        Write-Host "nova CLI built: $BinDir\nova.exe" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ── Go Server ────────────────────────────────────────────────────────────
if ($Target -in @("all", "server")) {
    Write-Step "Building Go Platform Server"

    Assert-Tool "go"

    Push-Location $ServerDir
    try {
        if (-not (Test-Path ".env")) {
            Copy-Item ".env.example" ".env"
            Write-Host "Created .env from .env.example - edit your database credentials!" -ForegroundColor Yellow
        }

        Write-Host "Downloading Go modules..."
        go mod tidy
        if ($LASTEXITCODE -ne 0) { throw "go mod tidy failed" }

        Write-Host "Building server binary..."
        go build -o (Join-Path $BinDir "dragyou-server.exe") .
        if ($LASTEXITCODE -ne 0) { throw "go build failed" }

        Write-Host "Server built: $BinDir\dragyou-server.exe" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ── Summary ──────────────────────────────────────────────────────────────
Write-Step "Build Complete"
Write-Host ""
Write-Host "Binaries in: $BinDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Add $BinDir to your PATH"
Write-Host "  2. Edit backend\server\.env with your PostgreSQL credentials"
Write-Host "  3. Run: nova init   (to test the CLI)"
Write-Host "  4. Run: cd backend\server && go run .   (to start the API)"
Write-Host "  5. Visit: http://localhost:8080"
