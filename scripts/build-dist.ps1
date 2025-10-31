<#
Create a minimal distribution ZIP for Chrome Web Store upload.

Usage (PowerShell):
  .\scripts\build-dist.ps1            # creates guardon-v<version>.zip
  .\scripts\build-dist.ps1 -OutFile my.zip

This script copies only runtime files (manifest, assets, popup/options pages,
background, content script, runtime libs and utils) into a clean dist/ folder
and compresses it.
#>

param(
  [string]$OutFile
)

try {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
  $repoRoot = Resolve-Path (Join-Path $scriptDir '..')
  Set-Location $repoRoot

  # Read version from manifest.json
  $manifest = Get-Content -Raw -Path manifest.json | ConvertFrom-Json
  $version = $manifest.version -replace '[^0-9A-Za-z\.\-]',''
  if (-not $version) { $version = (Get-Date -Format yyyyMMddHHmmss) }

  $defaultZip = "guardon-v$version.zip"
  if (-not $OutFile) { $OutFile = $defaultZip }

  $dist = Join-Path $repoRoot 'dist'
  if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
  New-Item -ItemType Directory -Path $dist | Out-Null

  $includes = @(
    'manifest.json',
    'LICENSE',
    'README.md',
    'SECURITY.md',
    'assets',
    'src\lib',
    'src\utils',
    'src\popup',
    'src\options',
    'src\background.js',
    'src\content.js'
  )

  foreach ($item in $includes) {
    if (Test-Path $item) {
      Write-Output "Copying $item"
      $dest = Join-Path $dist $item
      $parent = Split-Path -Parent $dest
      if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
      Copy-Item -Path $item -Destination $dist -Recurse -Force
    } else {
      Write-Output "Warning: $item not found, skipping"
    }
  }

  # Create zip
  if (Test-Path $OutFile) { Remove-Item -Force $OutFile }
  Compress-Archive -Path (Join-Path $dist '*') -DestinationPath $OutFile -Force
  Write-Output "Created: $OutFile"
} catch {
  Write-Error "Failed to build distribution: $_"
  exit 1
}
