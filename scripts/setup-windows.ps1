#Requires -Version 5.1
<#
.SYNOPSIS
  Links ai-configs rules into a project via NTFS HardLinks (no Developer Mode required).

.PARAMETER ProjectDir
  Absolute path to the target project directory.

.PARAMETER Project
  Folder name inside ai-configs that contains the configs to link.

.EXAMPLE
  .\setup-windows.ps1 -ProjectDir "C:\work\THT-myaccount" -Project "THT-myaccount"
  .\setup-windows.ps1 -ProjectDir "D:\projects\my-app" -Project "my-project-name"

.NOTES
  HardLinks require source and target to be on the same drive.
  After a `git pull` in ai-configs run this script again to re-link any new files.
#>

param(
  [Parameter(Mandatory, HelpMessage="Absolute path to the target project")]
  [string]$ProjectDir,

  [Parameter(Mandatory, HelpMessage="Folder name in ai-configs")]
  [string]$Project
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$SourceDir = Join-Path $RepoRoot $Project

if (-not (Test-Path $SourceDir -PathType Container)) {
  $available = Get-ChildItem $RepoRoot -Directory |
    Where-Object { $_.Name -notmatch '^(scripts|\.)' } |
    Select-Object -ExpandProperty Name
  Write-Error "Project folder not found: $SourceDir`nAvailable: $($available -join ', ')"
  exit 1
}

function Link-File {
  param([string]$Src, [string]$Dst)

  $dir = Split-Path -Parent $Dst
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }

  if (Test-Path $Dst) {
    Remove-Item $Dst -Force
}

  New-Item -ItemType HardLink -Path $Dst -Target $Src | Out-Null
  Write-Host "  linked $Dst"
  Write-Host "      -> $Src"
}

Write-Host "Project : $Project"
Write-Host "Source  : $SourceDir"
Write-Host "Target  : $ProjectDir"
Write-Host ""

# CLAUDE.md
$f = Join-Path $SourceDir "CLAUDE.md"
if (Test-Path $f) { Link-File $f (Join-Path $ProjectDir "CLAUDE.md") }

# .cursorrules
$f = Join-Path $SourceDir ".cursorrules"
if (Test-Path $f) { Link-File $f (Join-Path $ProjectDir ".cursorrules") }

# .mcp.json — Playwright MCP (Windows-specific)
$f = Join-Path $SourceDir ".mcp.windows.json"
if (Test-Path $f) { Link-File $f (Join-Path $ProjectDir ".mcp.json") }

# .claude/settings.json — MCP server config
$f = Join-Path $SourceDir ".claude\settings.json"
if (Test-Path $f) { Link-File $f (Join-Path $ProjectDir ".claude\settings.json") }

# .claude/rules/*.md — individual files
$rulesDir = Join-Path $SourceDir ".claude\rules"
if (Test-Path $rulesDir -PathType Container) {
  Get-ChildItem (Join-Path $rulesDir "*.md") | ForEach-Object {
    Link-File $_.FullName (Join-Path $ProjectDir ".claude\rules\$($_.Name)")
  }
}

# common/.claude/commands/*.md — shared commands (linked first; project-specific overrides below)
$commonCommandsDir = Join-Path $RepoRoot "common\.claude\commands"
if (Test-Path $commonCommandsDir -PathType Container) {
  Get-ChildItem (Join-Path $commonCommandsDir "*.md") | ForEach-Object {
    Link-File $_.FullName (Join-Path $ProjectDir ".claude\commands\$($_.Name)")
  }
}

# .claude/commands/*.md — individual files (overrides common if same name)
$commandsDir = Join-Path $SourceDir ".claude\commands"
if (Test-Path $commandsDir -PathType Container) {
  Get-ChildItem (Join-Path $commandsDir "*.md") | ForEach-Object {
    Link-File $_.FullName (Join-Path $ProjectDir ".claude\commands\$($_.Name)")
  }
}

# .claude/settings.local.json — inject AI_CONFIGS_DIR
$settingsLocalPath = Join-Path $ProjectDir ".claude\settings.local.json"
$settingsLocalDir  = Split-Path -Parent $settingsLocalPath
if (-not (Test-Path $settingsLocalDir)) {
  New-Item -ItemType Directory -Path $settingsLocalDir -Force | Out-Null
}

if (Test-Path $settingsLocalPath) {
  $json = Get-Content $settingsLocalPath -Raw | ConvertFrom-Json
} else {
  $json = [PSCustomObject]@{}
}

if (-not $json.PSObject.Properties['env']) {
  $json | Add-Member -MemberType NoteProperty -Name 'env' -Value ([PSCustomObject]@{})
}
$json.env | Add-Member -MemberType NoteProperty -Name 'AI_CONFIGS_DIR' `
  -Value ($RepoRoot -replace '\\', '/') -Force

$json | ConvertTo-Json -Depth 10 | Set-Content $settingsLocalPath -Encoding utf8
Write-Host "  updated $settingsLocalPath"
Write-Host "     AI_CONFIGS_DIR=$($RepoRoot -replace '\\', '/')"

Write-Host ""
Write-Host "Done."
