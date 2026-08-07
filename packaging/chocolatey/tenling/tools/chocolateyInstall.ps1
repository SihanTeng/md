$ErrorActionPreference = 'Stop'
$toolsDir   = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$packageName = $env:ChocolateyPackageName

# These two values are rewritten by scripts/update-chocolatey-package.sh on each release.
$softwareVersion = '0.3.1'
$checksum64      = 'REPLACE_WITH_MSI_SHA256'

$packageArgs = @{
  packageName    = $packageName
  fileType       = 'msi'
  url64bit       = "https://github.com/SihanTeng/tenling/releases/download/v${softwareVersion}/tenling-${softwareVersion}-windows-x64.msi"
  softwareName   = 'TenLing*'
  checksum64     = $checksum64
  checksumType64 = 'sha256'
  silentArgs     = "/qn /norestart /l*v `"$($env:TEMP)\$packageName.$($env:chocolateyPackageVersion).MsiInstall.log`""
  validExitCodes = @(0, 3010, 1641)
}

Install-ChocolateyPackage @packageArgs
