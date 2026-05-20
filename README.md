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
├── automation/               # Node.js scripts for AI-powered tooling
│   └── src/
│       └── pr-reviewer/
│           └── index.ts
│
├── common/                   # shared commands available in every project
│   └── .claude/
│       └── commands/
│           └── commit.md
│
└── <project-name>/           # one folder per project
    ├── CLAUDE.md
    ├── .cursorrules
    └── .claude/
        ├── settings.json     # MCP server config
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
    ├── settings.json      -> ai-configs/my-project/.claude/settings.json
    ├── rules/
    │   ├── components.md  -> ai-configs/my-project/.claude/rules/components.md
    │   └── ...
    └── commands/
        ├── commit.md      -> ai-configs/common/.claude/commands/commit.md
        └── custom_icon.md -> ai-configs/my-project/.claude/commands/custom_icon.md
```

Each file is linked individually so local project rules can coexist alongside shared ones.  
Project-specific commands take precedence over common ones if names collide.

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
2. Add the files you want to share (`CLAUDE.md`, `.cursorrules`, `.claude/settings.json`, `.claude/rules/*.md`, `.claude/commands/*.md`).
3. Commit and push.
4. On each machine, run the setup script pointing at the local project directory.

## QA commands setup

The shared commands `/qa-feature` and `/qa-diff` require two environment variables that point to machine-specific directories. Since paths differ per machine, set them in the **project-level** `settings.local.json` (not committed to git).

Create or edit `.claude/settings.local.json` in the root of the project where you run QA commands (e.g. `D:\THT\.claude\settings.local.json`):

```json
{
  "env": {
    "QA_TESTCASES_DIR": "/absolute/path/to/qa-testcases",
    "QA_REPORTS_DIR": "/absolute/path/to/qa-reports"
  }
}
```

| Variable | Purpose | Git-tracked |
|----------|---------|-------------|
| `QA_TESTCASES_DIR` | Shared folder with `.md` test case files | Yes — commit this folder |
| `QA_REPORTS_DIR` | Folder where reports and screenshots are saved | No |

**macOS example** (`~/.../THT/.claude/settings.local.json`):
```json
{
  "env": {
    "QA_TESTCASES_DIR": "/Users/name/THT/qa-testcases",
    "QA_REPORTS_DIR": "/Users/name/THT/qa-reports"
  }
}
```

**Windows example** (`D:\THT\.claude\settings.local.json`):
```json
{
  "env": {
    "QA_TESTCASES_DIR": "D:\\THT\\qa-testcases",
    "QA_REPORTS_DIR": "D:\\THT\\qa-reports"
  }
}
```

> If either variable is missing, the command will stop and remind you to configure it.

---

## Adding a shared command

To make a command available in **every** project without copying it:

1. Place the `.md` file in `common/.claude/commands/`.
2. Commit and push.
3. Re-run the setup script in each project to create the link.

Project-specific commands (in `<project>/.claude/commands/`) override a common command with the same filename.

## Workflow: editing rules

Edit files directly in `ai-configs/` and commit — symlinks in all projects reflect changes immediately (Mac).  
On Windows, re-run the setup script after pulling new files to create hardlinks for them.

## Automation

Node.js automation scripts live in `automation/`. Scripts use `@anthropic-ai/sdk` for Claude API integrations.

### Setup

```bash
cd automation
npm install
```

### PR Reviewer

Runs an AI-powered code review on a git diff between two branches and saves the result as a Markdown file.

**Setup**

Create `automation/.env` with your API key:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Usage**

```bash
cd automation
npm run review -- <project-path> <base-branch> <compare-branch>
```

**Example**

```bash
npm run review -- "D:\THT\THT-myAccount" beta-stage main
```

**What it does**

1. Reads `CLAUDE.md` and `.claude/rules/*.md` from the project to build context
2. Runs `git diff <base>...<compare>` in the project directory
3. Sends the diff to Claude API with a structured review prompt
4. Prints the review to the console
5. Saves the review to `<project-path>/.reviews/review-<branch>-<timestamp>.md`
