# md — one-line installer (Windows)
#
#   irm https://raw.githubusercontent.com/SihanTeng/md/main/install.ps1 | iex
#
# Downloads the latest MSI from GitHub Releases and installs it.
# Optional env:
#   $env:MD_VERSION = 'v0.2.0'   # pin a release tag
#   $env:MD_FORCE   = '1'        # allow reinstall

$ErrorActionPreference = 'Stop'

$Repo = 'SihanTeng/md'
$Api = "https://api.github.com/repos/$Repo"
$UserAgent = 'md-install'

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

function Get-Release {
    $headers = @{
        'Accept'     = 'application/vnd.github+json'
        'User-Agent' = $UserAgent
    }

    if ($env:MD_VERSION) {
        $tag = $env:MD_VERSION
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
    $canonical = "md-$version-windows-x64.msi"
    $legacy = "md_${version}_x64_en-US.msi"

    foreach ($name in @($canonical, $legacy)) {
        $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
        if ($asset) { return $asset }
    }

    $asset = $release.assets | Where-Object { $_.name -like '*.msi' } | Select-Object -First 1
    if ($asset) { return $asset }

    Write-Err 'no Windows MSI asset found on this release'
}

function Install-Md {
    Write-Host ''
    Write-Host ' md' -ForegroundColor Cyan -NoNewline
    Write-Host ' — Markdown editor installer' 
    Write-Host ''

    if (-not [Environment]::Is64BitOperatingSystem) {
        Write-Err 'md publishes 64-bit Windows builds only'
    }

    $release = Get-Release
    $tag = $release.tag_name
    $version = $tag.TrimStart('v')
    Write-Info "release $tag"

    $asset = Find-MsiAsset $release
    Write-Info "downloading $($asset.name)…"

    $tmpDir = Join-Path $env:TEMP "md-install-$version"
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    $msiPath = Join-Path $tmpDir $asset.name

    try {
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $msiPath -UseBasicParsing -UserAgent $UserAgent
    }
    catch {
        Write-Err "download failed: $_"
    }

    Write-Info 'running MSI installer (may prompt for elevation)…'
    $args = @('/i', "`"$msiPath`"", '/qn', '/norestart')
    $proc = Start-Process -FilePath 'msiexec.exe' -ArgumentList $args -Wait -PassThru
    $code = $proc.ExitCode

    # 0 = success, 3010 = success reboot required, 1641 = success restart initiated
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
    Write-Host 'Start md from the Start menu, or run:' -ForegroundColor Cyan
    Write-Host '    md' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'If the command is not found, open a new terminal.' -ForegroundColor Gray
    Write-Host ''
}

Install-Md
