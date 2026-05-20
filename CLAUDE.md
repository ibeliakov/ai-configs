# CLAUDE.md — ai-configs

Centralized Claude Code and Cursor IDE configs for THT projects. Rules, commands, and MCP configs live here; projects get hardlinks (Windows) or symlinks (macOS) — no duplication across repos.

## Repo structure

```
ai-configs/
├── common/
│   └── .claude/
│       └── commands/         # shared commands available in every project
│
├── <project-name>/           # one folder per project
│   ├── CLAUDE.md
│   ├── .cursorrules
│   ├── .mcp.json             # macOS MCP config
│   ├── .mcp.windows.json     # Windows MCP config (linked as .mcp.json)
│   └── .claude/
│       ├── settings.json
│       ├── rules/            # detailed rule files referenced from CLAUDE.md
│       └── commands/         # project-specific commands (override common by filename)
│
├── automation/               # Node.js/TypeScript AI automation scripts
│   └── src/
│       ├── pr-reviewer/
│       └── slack-digest/
│
└── scripts/
    ├── setup-windows.ps1
    └── setup-mac.sh
```

## How configs are distributed

**Windows** (NTFS hardlinks, no Developer Mode required):
```powershell
.\scripts\setup-windows.ps1 -ProjectDir "D:\work\THT-myAccount" -Project "THT-myAccount"
```

**macOS** (symlinks):
```bash
./scripts/setup-mac.sh ~/work/THT-myAccount
```

After `git pull` that adds new files — re-run the setup script to create links for those files.

## Adding a new project

1. Create `ai-configs/<project-name>/` and add the files to share (`CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*.md`, etc.)
2. Commit and push
3. Run the setup script on each machine pointing at the local project directory

## Shared vs project-specific commands

- **Shared** — `common/.claude/commands/<name>.md` — linked into every project
- **Project-specific** — `<project>/.claude/commands/<name>.md` — overrides a common command with the same filename

After adding a new file to `common/` or a project's `commands/`, re-run the setup script (Windows) to create the link.

## Automation scripts

`automation/` contains TypeScript scripts using `@anthropic-ai/sdk` and `@slack/web-api`. When adding a new automation script — add a description and usage example to `README.md`.

## Key constraints

- Windows hardlinks require source and target to be on the same drive
- Common commands are linked first; project-specific commands with the same filename override them
