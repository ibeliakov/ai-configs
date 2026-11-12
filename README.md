# ai-configs

Centralized storage for Claude Code configs across machines.  
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
├── common/                   # shared, linked into every project
│   ├── .mcp.windows.json     # shared MCP servers, Windows (e.g. shortcut)
│   ├── .mcp.mac.json         # shared MCP servers, macOS
│   └── .claude/
│       ├── commands/
│       │   ├── commit.md
│       │   └── implement.md
│       └── agents/
│           ├── task-planner.md
│           └── ...
│
└── <project-name>/           # one folder per project
    ├── CLAUDE.md
    ├── .mcp.windows.json     # project MCP servers, Windows (merged with common)
    ├── .mcp.mac.json         # project MCP servers, macOS (merged with common)
    └── .claude/
        ├── settings.json
        ├── rules/
        │   ├── components.md
        │   └── ...
        ├── commands/
        │   └── custom_icon.md
        └── agents/           # project-specific subagents (optional)
```

> **MCP config:** Claude Code reads MCP servers only from a project's `.mcp.json` (the
> `mcpServers` key in `settings.json` is ignored). The setup script **generates** each project's
> `.mcp.json` by merging the OS-specific source (`.mcp.windows.json` / `.mcp.mac.json`) with the
> shared `common/` one — so a server like `shortcut` is available in every project without
> duplicating it. See [Shortcut MCP setup](#shortcut-mcp-setup).

After running a setup script, the project directory looks like this:

```
~/work/my-project/
├── CLAUDE.md           -> ai-configs/my-project/CLAUDE.md
├── .mcp.json              (generated: project MCP servers + common shortcut; gitignored)
└── .claude/
    ├── settings.json      -> ai-configs/my-project/.claude/settings.json
    ├── settings.local.json   (generated/merged: AI_CONFIGS_DIR, SHORTCUT_API_TOKEN, SHORTCUT_MEMBER_ID; gitignored)
    ├── rules/
    │   ├── components.md  -> ai-configs/my-project/.claude/rules/components.md
    │   └── ...
    ├── commands/
    │   ├── commit.md      -> ai-configs/common/.claude/commands/commit.md
    │   └── custom_icon.md -> ai-configs/my-project/.claude/commands/custom_icon.md
    └── agents/
        ├── task-planner.md -> ai-configs/common/.claude/agents/task-planner.md
        └── ...
```

Each file is linked individually so local project rules can coexist alongside shared ones.  
Project-specific commands and agents take precedence over common ones if names collide.

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
2. Add the files you want to share (`CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*.md`, `.claude/commands/*.md`, `.claude/agents/*.md`).
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

## Shortcut MCP setup

The shared commands `/shortcut-story` and `/shortcut-epic` use the **official hosted Shortcut MCP
server** (`https://mcp.shortcut.com/mcp`). The server is declared once in `common/.mcp.windows.json` /
`common/.mcp.mac.json` and merged into every project's generated `.mcp.json` by the setup script.

The hosted server authenticates via **OAuth** — no API token is needed for MCP. On first use the
client opens a browser to authorize with your Shortcut account; check the connection with `/mcp`.

> The self-hosted `@shortcut/mcp` (npx) server is deprecated. This config has been migrated to the
> hosted server, so that deprecation warning no longer appears.

`SHORTCUT_API_TOKEN` is still used — but **not** for MCP auth. The `/shortcut-*` commands use it to
download story/epic **attachments** (images, PDF, Word) via the Shortcut REST API, because the MCP
server does not return attached files. Secrets are **not** stored in git. Put them in `automation/.env`
(gitignored — see `automation/.env.example`):

```env
# Generate at https://app.shortcut.com/settings/account/api-tokens — used by /shortcut-* to fetch attachments
SHORTCUT_API_TOKEN=...
# Shortcut member ID assigned to Frontend subtasks
SHORTCUT_MEMBER_ID=...
```

When you run a setup script, it writes both `SHORTCUT_API_TOKEN` and `SHORTCUT_MEMBER_ID` from
`automation/.env` into the project's `.claude/settings.local.json` `env` block (gitignored, never in
git), so the commands can read them via `$SHORTCUT_API_TOKEN` / `$SHORTCUT_MEMBER_ID`
(`$env:...` on Windows).

After editing `automation/.env`, re-run the setup script for the changes to take effect, then
restart Claude Code and check the server with `/mcp`.

| Variable | Purpose | Git-tracked |
|----------|---------|-------------|
| `SHORTCUT_API_TOKEN` | Used by `/shortcut-*` to fetch attachments via REST (MCP itself uses OAuth) | No — `automation/.env` only |
| `SHORTCUT_MEMBER_ID` | Assignee for Frontend subtasks | No — `automation/.env` only |

---

## Adding a shared command

To make a command available in **every** project without copying it:

1. Place the `.md` file in `common/.claude/commands/`.
2. Commit and push.
3. Re-run the setup script in each project to create the link.

Project-specific commands (in `<project>/.claude/commands/`) override a common command with the same filename.

## Adding a shared agent

Subagents are Markdown files with YAML frontmatter (`name`, `description`, `model`, tool restrictions) followed by the agent's system prompt. To make one available in **every** project:

1. Place the `.md` file in `common/.claude/agents/`.
2. Commit and push.
3. Re-run the setup script in each project to create the link.
4. Restart Claude Code if the script created the project's `.claude/agents/` directory for the first time: a new agents directory is only picked up at startup. Later edits to existing agent files apply without a restart.

Project-specific agents (in `<project>/.claude/agents/`) override a common agent with the same filename.

Keep `description` to one short line: the descriptions of all agents are loaded into every session. Details belong in the body.

## `/implement` pipeline

`/implement <story or epic ID or URL> [extra instructions]` takes a Shortcut story or epic from requirements to an open pull request. The command (`common/.claude/commands/implement.md`) is the orchestrator and runs in the main session; the work is done by five subagents in `common/.claude/agents/`, each with its own context and a pinned model.

| Stage | Who | Output |
|---|---|---|
| Context: story or epic, comments, attachments, linked videos and documents | orchestrator | `01-context.md` |
| Plan: read-only code research | `task-planner` (fable) | `02-plan.md` |
| **Plan gate**: `approve`, free-text feedback (the same planner revises the plan), or a manual edit of the file followed by `approve` | you | |
| Worktrees: `<repo>-<id>` from the chosen base branch for every repository the plan touches | orchestrator | |
| Implementation, phase by phase | `task-implementer` (opus) | code, `03-implementation.md` |
| Review of each phase, with a fix loop | `task-reviewer` (fable) | `04-review.md` |
| Documentation and test cases in the documentation repository | `task-docs` (opus) | `05-docs.md` |
| QA in the running application: test cases, documented behaviour, unusual user actions | `task-qa` (opus) | `06-qa.md` |
| **PR gate**: `yes / no / edit` | you | |
| Pull requests and the review bot loop (CodeRabbit) | orchestrator, reviewer, implementer | `07-pr.md` |
| Summary and an optional Shortcut comment (`yes / no / edit`) | orchestrator | |

How it behaves:

- **Nothing is built before `approve`.** No worktrees, no code changes, no commits.
- **A story** is read together with its parent epic: the epic's description, comments, documents and backend links go into the context as reference, and its other stories are listed so the planner sees the boundaries. Only the story itself is implemented.
- **An epic** is planned as one plan with one phase per frontend story. Backend stories are included only when the extra instructions ask for them. Each repository gets one branch and one pull request.
- **Tests.** All new and changed code is covered by automated tests: every line and branch of a new file, every changed line of a changed file. The plan has a `Tests` section, and anything it leaves uncovered is shown to you at the plan gate. A refactoring or a library replacement starts with a separate phase of characterization tests. The reviewer blocks a phase that misses this.
- **Open questions go to you.** When an agent sees two viable approaches or an ambiguity, it stops and the orchestrator asks you; it never decides on its own.
- **QA findings** go back to the implementer, the fix is reviewed again, the documentation is updated when behaviour changed, and QA reruns the affected cases.
- **Review bot comments** are triaged by the reviewer: fixed, or answered with a reason. Fixes are pushed once per round.

What it writes outside your machine:

- **Shortcut:** moves the story to In Development when the command starts (for an epic, each story when its phase starts). This is automatic. The final comment is posted only after `yes`. Nothing else is written.
- **Git:** local commits in the task worktrees are made automatically after each approved phase, in the `commit.md` format. Push and pull requests happen only after `yes` at the PR gate; after that, fixes for bot comments and replies in threads need no further confirmation. Pull requests are never merged.

Artifacts live in `.tasks/<key>/` (`sc-<id>` or `epic-<id>`) inside the directory where the session was started, together with `state.md`, downloaded attachments and QA screenshots. All state passes between agents through these files, so a run can be continued in a new session. When you start sessions inside a project repository, keep the directory out of git without touching the project:

```bash
echo '.tasks/' >> ~/.config/git/ignore
```

Requirements:

- the setup script has been run for the project, so the command, the agents and `.mcp.json` are in place;
- the session is not in plan mode (subagents would be forced into plan mode and could not write);
- `gh` is authenticated, otherwise the pull request stages are skipped;
- `SHORTCUT_API_TOKEN` is set (see [Shortcut MCP setup](#shortcut-mcp-setup)); it is used to read attachments;
- test users for the local and staging applications are listed in the project's `.claude/settings.local.json`, so agents can log in without asking:

  ```json
  {
    "test_users": [
      { "role": "admin", "email": "...", "password": "..." }
    ]
  }
  ```

  These accounts must hold test data only: agents are allowed to create, change and delete data with them. Agents never log in to production, and they ask you to log in to external systems yourself.

Models and effort are pinned in each agent's frontmatter; to change them, edit the agent file. A session running in `acceptEdits` or auto mode passes that mode to the subagents.

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
