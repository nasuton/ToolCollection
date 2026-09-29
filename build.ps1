<#
.SYNOPSIS
    PowerShell equivalent of the Makefile for Windows users.

.DESCRIPTION
    Compiles the Go logic to WebAssembly, stages wasm_exec.js into web/public/,
    and runs the Vite build / dev server / preview.

.PARAMETER Task
    wasm    - Build main.wasm and copy wasm_exec.js into web/public/ (default)
    build   - wasm + npm ci + npm run build
    dev     - wasm + npm install + npm run dev
    preview - build + npm run preview
    test    - go vet ./... + go test ./... + GOOS=js GOARCH=wasm go vet ./cmd/...
    clean   - Remove generated wasm artifacts and web/dist

.EXAMPLE
    .\build.ps1 build
    .\build.ps1 preview
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('wasm', 'build', 'dev', 'preview', 'test', 'clean')]
    [string]$Task = 'wasm'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$webDir = Join-Path $root 'web'
$publicDir = Join-Path $webDir 'public'
$wasmOut = Join-Path $publicDir 'main.wasm'
$wasmExecOut = Join-Path $publicDir 'wasm_exec.js'

function Invoke-Checked {
    param([string]$Command, [string[]]$Arguments)
    Write-Host ">> $Command $($Arguments -join ' ')" -ForegroundColor Cyan
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE"
    }
}

function Build-Wasm {
    if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
        throw 'go was not found in PATH. Install Go from https://go.dev/dl/'
    }
    $goroot = (& go env GOROOT).Trim()

    # Go >= 1.24 ships wasm_exec.js under lib/wasm; older versions under misc/wasm.
    $wasmExecSrc = @(
        (Join-Path $goroot 'lib\wasm\wasm_exec.js'),
        (Join-Path $goroot 'misc\wasm\wasm_exec.js')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $wasmExecSrc) {
        throw "wasm_exec.js was not found under $goroot (checked lib\wasm and misc\wasm)"
    }

    New-Item -ItemType Directory -Force -Path $publicDir | Out-Null

    $prevGoos = $env:GOOS
    $prevGoarch = $env:GOARCH
    try {
        $env:GOOS = 'js'
        $env:GOARCH = 'wasm'
        Push-Location $root
        try {
            # -s -w strips symbol/DWARF data (~2% smaller); -trimpath keeps the build reproducible.
            Invoke-Checked go @('build', '-trimpath', '-ldflags=-s -w', '-o', $wasmOut, './cmd/wasm')
        } finally {
            Pop-Location
        }
    } finally {
        $env:GOOS = $prevGoos
        $env:GOARCH = $prevGoarch
    }

    Write-Host ">> Copy-Item $wasmExecSrc -> $wasmExecOut" -ForegroundColor Cyan
    Copy-Item $wasmExecSrc $wasmExecOut -Force

    Write-Host "wasm artifacts ready:" -ForegroundColor Green
    Get-Item $wasmOut, $wasmExecOut | Format-Table Name, Length, LastWriteTime -AutoSize
}

function Resolve-Npm {
    # Prefer npm.cmd over npm.ps1: the .ps1 shim shipped with some Node installs
    # (e.g. nvm-windows) re-parses the caller's source line instead of the actual
    # argument values, which turns '& $Command @Arguments' into 'npm Command'.
    $cmd = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $exe = Get-Command npm -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { return $exe.Source }
    throw 'npm was not found in PATH. Install Node.js from https://nodejs.org/'
}

function Invoke-Npm {
    param([string[]]$Arguments)
    $npm = Resolve-Npm
    Push-Location $webDir
    try {
        Invoke-Checked $npm $Arguments
    } finally {
        Pop-Location
    }
}

function Build-Web {
    Build-Wasm
    Invoke-Npm @('ci')
    Invoke-Npm @('run', 'build')

    foreach ($f in @('wasm_exec.js', 'main.wasm')) {
        $p = Join-Path $webDir "dist\$f"
        if (-not (Test-Path $p)) {
            throw "Expected $p to exist after build, but it is missing."
        }
    }
    Write-Host 'web/dist is ready (includes wasm_exec.js and main.wasm).' -ForegroundColor Green
}

switch ($Task) {
    'wasm' {
        Build-Wasm
    }
    'build' {
        Build-Web
    }
    'dev' {
        Build-Wasm
        Invoke-Npm @('install')
        Invoke-Npm @('run', 'dev')
    }
    'preview' {
        Build-Web
        Write-Host 'Open http://localhost:4173/go-wasm-tools/ (note the /go-wasm-tools/ base path).' -ForegroundColor Yellow
        Invoke-Npm @('run', 'preview')
    }
    'test' {
        Push-Location $root
        try {
            Invoke-Checked go @('vet', './...')
            Invoke-Checked go @('test', './...')
            $prevGoos = $env:GOOS
            $prevGoarch = $env:GOARCH
            try {
                $env:GOOS = 'js'
                $env:GOARCH = 'wasm'
                Invoke-Checked go @('vet', './cmd/...')
            } finally {
                $env:GOOS = $prevGoos
                $env:GOARCH = $prevGoarch
            }
        } finally {
            Pop-Location
        }
    }
    'clean' {
        foreach ($p in @($wasmOut, $wasmExecOut, (Join-Path $webDir 'dist'))) {
            if (Test-Path $p) {
                Write-Host ">> Remove $p" -ForegroundColor Cyan
                Remove-Item $p -Recurse -Force
            }
        }
    }
}
