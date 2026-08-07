# TenLing — one-line installer (Windows)
#
#   irm https://raw.githubusercontent.com/SihanTeng/tenling/main/install.ps1 | iex
#
# Downloads the latest MSI from GitHub Releases and installs it.
# Optional env:
#   $env:TENLING_VERSION = 'v0.3.0'   # pin a release tag
#   $env:TENLING_FORCE   = '1'        # allow reinstall

$ErrorActionPreference = 'Stop'

$Repo = 'SihanTeng/tenling'
$Api = "https://api.github.com/repos/$Repo"
$UserAgent = 'tenling-install'

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Green
}
function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}
function Write-Err([string]$Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    exit 1
}

function Get-PinnedVersion {
    if ($env:TENLING_VERSION) { return $env:TENLING_VERSION }
    return $null
}

function Get-Release {
    $headers = @{
        'Accept'     = 'application/vnd.github+json'
        'User-Agent' = $UserAgent
    }

    $pinned = Get-PinnedVersion
    if ($pinned) {
        $tag = $pinned
        if (-not $tag.StartsWith('v')) { $tag = "v$tag" }
        Write-Info "using pinned version $tag"
        $uri = "$Api/releases/tags/$tag"
    }
    else {
        Write-Info 'fetching latest release…'
        $uri = "$Api/releases/latest"
    }

    try {
        $release = Invoke-RestMethod -Uri $uri -Headers $headers
    }
    catch {
        Write-Err "failed to query GitHub releases: $_"
    }

    if (-not $release.tag_name) {
        Write-Err 'could not parse release tag'
    }

    return $release
}

function Find-MsiAsset($release) {
    $version = $release.tag_name.TrimStart('v')
    $candidates = @(
        "tenling-$version-windows-x64.msi"
        "tenling_${version}_x64_en-US.msi"
    )

    foreach ($name in $candidates) {
        $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
        if ($asset) { return $asset }
    }

    $asset = $release.assets | Where-Object { $_.name -like '*.msi' } | Select-Object -First 1
    if ($asset) { return $asset }

    Write-Err 'no Windows MSI asset found on this release'
}

function Install-TenLing {
    Write-Host ''
    Write-Host ' TenLing' -ForegroundColor Cyan -NoNewline
    Write-Host ' — Markdown editor installer'
    Write-Host ''

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Err 'TenLing publishes 64-bit Windows builds only'
    }

    $release = Get-Release
    $tag = $release.tag_name
    $version = $tag.TrimStart('v')
    Write-Info "release $tag"

    $asset = Find-MsiAsset $release
    Write-Info "downloading $($asset.name)…"

    $tmpDir = Join-Path $env:TEMP "tenling-install-$version"
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $msiPath = Join-Path $tmpDir $asset.name

    try {
        $downloadUrl = $asset.browser_download_url
        if (-not $downloadUrl) {
            $downloadUrl = "https://github.com/$Repo/releases/download/$tag/$($asset.name)"
        }
        Invoke-WebRequest -Uri $downloadUrl -OutFile $msiPath -UseBasicParsing -UserAgent $UserAgent
    }
    catch {
        Write-Err "download failed: $_"
    }

    $size = (Get-Item $msiPath).Length
    if ($size -lt 100000) {
        Write-Err "download too small ($size bytes) — expected MSI from release $tag"
    }

    Write-Info 'running MSI installer (may prompt for elevation)…'
    $args = @('/i', "`"$msiPath`"", '/qn', '/norestart')
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $args -Wait -PassThru
    $code = $proc.ExitCode

    if ($code -notin 0, 3010, 1641) {
        Write-Warn "quiet install exited $code — retrying with UI…"
        $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', "`"$msiPath`"") -Wait -PassThru
        if ($proc.ExitCode -notin 0, 3010, 1641) {
            Write-Err "MSI install failed (exit $($proc.ExitCode))"
        }
    }

    try { Remove-Item -Recurse -Force $tmpDir } catch { }

    Write-Host ''
    Write-Info 'installed successfully'
    Write-Host ''
    Write-Host 'Start TenLing from the Start menu, or run:' -ForegroundColor Cyan
    Write-Host '    tenling' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'If the command is not found, open a new terminal.' -ForegroundColor Gray
    Write-Host ''
}

Install-TenLing
