# ai-configs

Centralized storage for Claude Code and Cursor IDE configs across machines.  
Rules live here; projects get symlinks (Mac) or hardlinks (Windows) — no config duplication across repos.

## Structure

```
ai-configs/
├── scripts/
│   ├── setup-mac.sh          # symlinks for macOS
│   └── setup-windows.ps1     # hardlinks for Windows
│
└── <project-name>/           # one folder per project
    ├── CLAUDE.md
    ├── .cursorrules
    └── .claude/
        ├── rules/
        │   ├── components.md
        │   └── ...
        └── commands/
            └── custom_icon.md
```

After running a setup script, the project directory looks like this:

```
~/work/my-project/
├── CLAUDE.md           -> ai-configs/my-project/CLAUDE.md
├── .cursorrules        -> ai-configs/my-project/.cursorrules
└── .claude/
    ├── rules/
    │   ├── components.md  -> ai-configs/my-project/.claude/rules/components.md
    │   └── ...
    └── commands/
        └── custom_icon.md -> ai-configs/my-project/.claude/commands/custom_icon.md
```

Each file is linked individually so local project rules can coexist alongside shared ones.

## Usage

### macOS

```bash
# Make executable once
chmod +x scripts/setup-mac.sh

# Link by project path (project name inferred from folder name)
./scripts/setup-mac.sh ~/work/THT-myaccount

# Or specify the project name explicitly
./scripts/setup-mac.sh ~/work/my-app THT-myaccount
```

### Windows (PowerShell)

No Developer Mode or admin rights required — uses NTFS HardLinks.

```powershell
.\scripts\setup-windows.ps1 -ProjectDir "C:\work\THT-myaccount" -Project "THT-myaccount"
```

> **Note:** HardLinks require source and target to be on the same drive.  
> After `git pull` in ai-configs, run the script again to link any newly added files.

## Adding a new project

1. Create a folder in ai-configs with the project name:
   ```
   ai-configs/my-new-project/
   ```
2. Add the files you want to share (`CLAUDE.md`, `.cursorrules`, `.claude/rules/*.md`, `.claude/commands/*.md`).
3. Commit and push.
4. On each machine, run the setup script pointing at the local project directory.

## Workflow: editing rules

Edit files directly in `ai-configs/` and commit — symlinks in all projects reflect changes immediately (Mac).  
On Windows, re-run the setup script after pulling new files to create hardlinks for them.
