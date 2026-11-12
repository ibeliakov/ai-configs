# CLAUDE.md — ai-configs

Centralized Claude Code configs for THT projects. Rules, commands, agents, and MCP configs live here; projects get hardlinks (Windows) or symlinks (macOS) — no duplication across repos.

## Repo structure

```
ai-configs/
├── common/
│   ├── .mcp.windows.json     # shared MCP servers, Windows (e.g. shortcut)
│   ├── .mcp.mac.json         # shared MCP servers, macOS
│   └── .claude/
│       ├── commands/         # shared commands available in every project
│       └── agents/           # shared subagents available in every project
│
├── <project-name>/           # one folder per project
│   ├── CLAUDE.md
│   ├── .mcp.windows.json     # project MCP source, Windows
│   ├── .mcp.mac.json         # project MCP source, macOS
│   └── .claude/
│       ├── settings.json
│       ├── rules/            # detailed rule files referenced from CLAUDE.md
│       ├── commands/         # project-specific commands (override common by filename)
│       └── agents/           # project-specific subagents (override common by filename)
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

## MCP config (generated, not linked)

Claude Code reads MCP servers only from a project's `.mcp.json` (the `mcpServers` key in
`settings.json`/`settings.local.json` is **silently ignored**). So the setup script does **not**
hardlink/symlink `.mcp.json` — it **generates** it by merging the OS-specific source
(`<project>/.mcp.windows.json` or `<project>/.mcp.mac.json`) with the shared `common/` one.
Project servers win on key conflict; `common/` adds shared servers like `shortcut`.

The `shortcut` server is the official **hosted** server (`https://mcp.shortcut.com/mcp`, HTTP +
OAuth) — no API token is embedded in `.mcp.json`. Shortcut secrets live in `automation/.env`
(gitignored): the setup script writes both `SHORTCUT_API_TOKEN` and `SHORTCUT_MEMBER_ID` into the
project's `settings.local.json` `env`. The token is **not** for MCP auth (that's OAuth) — the
`/shortcut-*` commands use it to fetch story/epic attachments via the Shortcut REST API. Neither
secret ever enters git. See README → "Shortcut MCP setup".

## Adding a new project

1. Create `ai-configs/<project-name>/` and add the files to share (`CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*.md`, etc.)
2. Commit and push
3. Run the setup script on each machine pointing at the local project directory

## Shared vs project-specific commands and agents

- **Shared** — `common/.claude/commands/<name>.md`, `common/.claude/agents/<name>.md` — linked into every project
- **Project-specific** — `<project>/.claude/commands/<name>.md`, `<project>/.claude/agents/<name>.md` — overrides a common file with the same filename

After adding a new file to `common/` or to a project's `commands/` or `agents/`, re-run the setup script to create the link. Claude Code must be restarted after a project's `.claude/agents/` directory is created for the first time.

Agent files keep `description` to one short line (descriptions load into every session) and pin `model` and `effort` in frontmatter. The `/implement` pipeline (`common/.claude/commands/implement.md` plus the `task-*` agents) is described in README → "`/implement` pipeline"; when changing a stage, keep the command, the agent file and that README section in step.

## Automation scripts

`automation/` contains TypeScript scripts using `@anthropic-ai/sdk` and `@slack/web-api`. When adding a new automation script — add a description and usage example to `README.md`.

## Key constraints

- Windows hardlinks require source and target to be on the same drive
- A project-specific command or agent overrides the common file with the same filename
