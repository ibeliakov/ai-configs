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

`/implement <story or epic ID or URL> [extra instructions]` takes a Shortcut story or epic from requirements to an open pull request. The command (`common/.claude/commands/implement.md`) is the orchestrator and runs in the main session; the work is done by five subagents in `common/.claude/agents/` (`task-planner`, `task-implementer`, `task-reviewer`, `task-docs`, `task-qa`), each with its own context and a pinned model.

| Stage | Who | Output |
|---|---|---|
| Context: the `/epic-readiness` analysis of the epic when there is one, otherwise the story or epic, comments, attachments, linked videos and documents | orchestrator | `01-context.md` |
| Plan: read-only code research | `task-planner` (fable) | `02-plan.md` (overview), `02-plan/phase-<n>.md` |
| **Plan gate**: `approve`, free-text feedback (the same planner revises the plan), or a manual edit of the file followed by `approve` | you | |
| Worktrees: `<repo>-<id>` from the chosen base branch for every repository the plan touches | orchestrator | |
| Implementation, phase by phase, a new agent for each phase | `task-implementer` (opus) | code, `03-implementation/phase-<n>.md` |
| Review of each phase from its diff, with a fix loop, a new agent for each phase | `task-reviewer` (fable) | `04-review/phase-<n>.md` |
| Documentation and test cases in the documentation repository | `task-docs` (opus) | `05-docs.md` |
| QA in the running application: test cases, documented behaviour, unusual user actions | `task-qa` (opus) | `06-qa.md` |
| **PR gate**: `yes / no / edit` | you | |
| Pull requests and the review bot loop (CodeRabbit) | orchestrator, reviewer, implementer | `07-pr.md` |
| Summary and an optional Shortcut comment (`yes / no / edit`) | orchestrator | |

How it behaves:

- **Nothing is built before `approve`.** No worktrees, no code changes, no commits.
- **The epic analysis is reused.** When `/epic-readiness` has been run for the epic (or for a story's parent epic), `/implement` does not collect the sources again. It reads what changed since the analysis (new comments, a new contract version, story states), takes your decisions and the base branches from it, and gives the planner the report, the specification and the code maps by path. With the verdict `partly` it plans only the areas that can start now; what waits is shown at the plan gate. Without an analysis it recommends running `/epic-readiness` first and lets you choose to collect the context itself.
- **A story** is read together with its parent epic: the epic's description, comments, documents and backend links go into the context as reference, and its other stories are listed so the planner sees the boundaries. Only the story itself is implemented.
- **An epic** is planned as one plan with one phase per frontend story. Backend stories are included only when the extra instructions ask for them. Each repository gets one branch and one pull request.
- **Tests.** All new and changed code is covered by automated tests: every line and branch of a new file, every changed line of a changed file. The plan has a `Tests` section, and anything it leaves uncovered is shown to you at the plan gate. A refactoring or a library replacement starts with a separate phase of characterization tests. The reviewer blocks a phase that misses this.
- **Open questions go to you.** When an agent sees two viable approaches or an ambiguity, it stops and the orchestrator asks you; it never decides on its own.
- **QA findings** go back to the implementer, the fix is reviewed again, the documentation is updated when behaviour changed, and QA reruns the affected cases.
- **Review bot comments** are triaged by the reviewer: fixed, or answered with a reason. Fixes are pushed once per round.
- **Token use.** An agent reads its whole history again on every turn, so the cost of an agent grows roughly with the square of the number of steps it takes. The pipeline therefore keeps agents short-lived:
  - the implementer and the reviewer are new instances for every phase and read only the plan overview and their phase file; the reviewer works from the diff of the phase;
  - the planner sizes a phase to about sixty tool calls (usually 5 to 15 changed files), splits a larger story into several phases and may merge very small neighbouring stories;
  - an agent that runs long hands over: it returns `partial` with a list of what remains, and a fresh instance continues from the report. An agent that reached its turn limit is replaced the same way, not resumed;
  - a documentation `sync` and a QA `retest` are new instances that read the earlier report;
  - the implementer does not start the application or a browser; that is QA's job. QA gets its environment (URLs, which API each application talks to, known constraints, test data notes) from the context file and stops early with `blocked` when the environment does not work, instead of working around it;
  - agents read the project rules that apply to the code they touch, not every rule file;
  - the orchestrator does not read plans and reports in full, and asks about the application together with the base branches, so nothing stops the run between the plan gate and the PR gate.

  For the same reason `/implement` has to be started in a fresh session: in a session that already holds a long conversation (for example a `/epic-readiness` run) every orchestrator turn pays for that conversation again, and the command asks you to start a new one. A long run is also cheaper to continue in a new session: the state is in files.

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
- the session is new, or was cleared with `/clear`, before the command is started;
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

Models and effort are pinned in each agent's frontmatter; to change them, edit the agent file. The one exception is written into `/fix-bugs`, which launches `task-docs` and `task-qa` with `effort: high` for its bounded bug modes. A session running in `acceptEdits` or auto mode passes that mode to the subagents.

## `/fix-bugs` command

`/fix-bugs <epic ID or URL> [bug story IDs] [extra instructions]` fixes a batch of bug stories of one epic in a single run. The command (`common/.claude/commands/fix-bugs.md`) is a lighter sibling of `/implement`. Its own agent, `task-bugfixer`, owns one bug from diagnosis to fix, so the code is studied once; `task-reviewer`, `task-docs` and `task-qa` are shared with `/implement` and run in their bug modes. The planner and the implementer take no part.

| Stage | Who | Output |
|---|---|---|
| Choose the bugs: open bug stories of the epic are listed and you answer which to fix (numbers, IDs or `all`); backend bugs are left out | you | |
| Context: the chosen bugs in full, the paths of the feature's document and test case file, the base branches, how the application will be available, and the known environment. The epic is not read | orchestrator | `01-context.md` |
| Worktrees, created before the diagnosis so the agents read the code directly; nothing is edited yet | orchestrator | |
| Diagnosis, all bugs at the same time, one agent per bug: root cause, fix, regression test, affected documentation and test cases | `task-bugfixer` (opus) | `bugs/sc-<id>.md` |
| **Diagnosis gate**: `approve`, feedback, `skip <ID>` or `cancel` | you | |
| Fix: the same agent of each bug continues with a failing regression test, then the fix. Bugs in different repositories run at the same time, bugs in one repository one after another | `task-bugfixer` | code, `bugs/sc-<id>.md` |
| Review of each bug from its diff, with a fix loop; one commit per bug | `task-reviewer` (fable) | `bugs/sc-<id>.review.md` |
| Documentation, at `high` effort: the feature document is corrected only where it describes the affected behaviour; test cases are corrected, and a regression case is added for a bug no case would have caught | `task-docs` (opus) | `05-docs.md` |
| Retest in the browser (Playwright), after the documentation and at `high` effort. Per bug: the story's steps to reproduce, the test cases the documentation step changed, added or tied to the bug, executed as written, and up to three unusual actions at the fixed spot. A wrongly worded case comes back as a `DOC` finding | `task-qa` (opus) | `06-qa.md` |
| **PR gate** (`yes / no / edit`), one pull request per repository, then the review bot loop | you, orchestrator | `07-pr.md` |
| Summary and a short comment in every fixed bug story (`yes / no / edit <N>`) | orchestrator | |

A retest finding caused by a fix goes back to that bug's agent, is reviewed again, and the failed items are rerun by a new QA instance. A defect that existed before the fix, or whose cause is in the backend, is reported as an `OUT` finding and starts no fix round: you decide at the PR gate whether it becomes a new story. What the command writes outside your machine is the same as for `/implement`: a bug story moves to In Development when its fix starts, code edits and local commits follow the diagnosis approval, push and pull requests need `yes` at the PR gate, comments need `yes`.

Artifacts live in `.tasks/epic-<id>/bugfix-<n>/`, one directory per run, next to the `/implement` files and the `/epic-readiness` analysis of the same epic and separate from them. The requirements are the same as for `/implement`, including the fresh session.

The pipeline costs more than fixing a bug directly in one session, because every agent starts with an empty context. It pays off for a batch of bugs; for one or two simple ones, asking for the fix directly is cheaper.

## `/epic-readiness` command

`/epic-readiness <epic ID or URL> [extra instructions]` checks whether a Shortcut epic is ready for frontend work. The command (`common/.claude/commands/epic-readiness.md`) runs in the main session and answers three questions: is there enough to start the frontend, which implementation questions are open, and is the API contract sufficient.

| Stage | Output |
|---|---|
| Update the local backend, documentation and frontend repositories (`fetch` and `pull --ff-only` on the current branch) | table of branches and commits |
| Collect the sources: epic, stories, all comments, the specification, attachments, links, recorded walkthroughs | `sources/`, `attachments/` |
| Find the API contract in the documentation repository, in comments or in the backend repository | |
| Map the code with read-only subagents: frontend projects, and the contract against the backend code | `code-map-frontend.md`, `code-map-backend.md` |
| Analyse: requirements against the contract, contradictions, undefined states, open threads | |
| Questions to you wherever the choice of path is yours | `clarifications.md` |
| Report with the three answers | `README.md` |
| Draft comments for the backend developer and the product manager, each with a translation into your language | `comments/` |
| **Approval gate**: `Post`, `Edit` or `Skip` for each draft | |
| Post the approved comments | `state.md` |

How it behaves:

- **Local code.** Repositories are updated first and then read from disk. A repository with local changes, without an upstream or diverged from it is left alone, and you are asked how to go on. Branches are never switched.
- **Logins.** When a linked site needs a login, the command opens it in the Playwright browser and waits for you to log in. It never asks for a password.
- **Comments.** New requests go into one comment per addressee on the epic. A point that answers an existing comment is posted as a reply in that comment's thread, in the epic or in the story where the comment is.
- **Language.** Comments are posted in English. Each draft is shown with a translation, which is not posted.
- **A repeated run** on the same epic reads what changed since the last one (new comments, replies, a new contract version), updates the verdict and drafts follow-ups in the existing threads.

What it writes outside your machine: only the comments you approved. No story is moved or edited.

The model is pinned in the command's frontmatter (`model`, `effort`). The override lasts until your next message, so the command asks its questions and runs the approval gate through question dialogs, within the same turn.

Artifacts live in `.tasks/epic-<id>/readiness/` inside the directory where the session was started, next to the `/implement` files of the same epic and separate from them. `/implement` reads this directory and never changes it.

Requirements: the setup script has been run for the project, the session is not in plan mode, and `SHORTCUT_API_TOKEN` is set for reading attachments (see [Shortcut MCP setup](#shortcut-mcp-setup)).

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
