# ai-configs

Centralized storage for Claude Code configs across machines.  
Rules live here; projects get symlinks (Mac) or hardlinks (Windows) — no config duplication across repos.

## Structure

```
ai-configs/
├── scripts/
│   ├── setup-mac.sh          # symlinks for macOS
│   ├── setup-windows.ps1     # hardlinks for Windows
│   ├── split-plan.mjs        # /implement: cuts the approved plan into files
│   ├── session-context.mjs   # /implement: prints the context size of the session
│   └── codex-run.mjs         # /implement: second review and QA through Codex
│
├── automation/               # Node.js scripts for AI-powered tooling
│   └── src/
│       └── pr-reviewer/
│           └── index.ts
│
├── common/                   # shared, linked into every project
│   ├── .mcp.windows.json     # shared MCP servers, Windows (e.g. shortcut)
│   ├── .mcp.mac.json         # shared MCP servers, macOS
│   ├── codex/                # instructions and answer shapes for the Codex runs of /implement
│   └── .claude/
│       ├── commands/
│       │   ├── commit.md
│       │   └── implement.md
│       └── agents/
│           ├── task-implementer.md
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
        ├── task-implementer.md -> ai-configs/common/.claude/agents/task-implementer.md
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

`/implement <story or epic ID or URL> [extra instructions]` takes a Shortcut story or epic from requirements to an open pull request. The command (`common/.claude/commands/implement.md`) runs in the main session and is both the planner and the orchestrator: it plans in plan mode, cuts the work into small parts, and schedules four subagents in `common/.claude/agents/` (`task-implementer`, `task-reviewer`, `task-docs`, `task-qa`), each with its own context and a pinned model. The documentation is written by a fork of the main session, and the second review and QA are done by Codex, another model with its own quota.

| Stage | Who | Output |
|---|---|---|
| Context: the `/epic-readiness` analysis of the epic when there is one, otherwise the story or epic, comments, attachments, linked videos and documents | main session | `01-context.md` |
| Plan, in plan mode: the requirements are read by the main session, the code by read-only research agents (`Explore`, `Plan`) | main session | the plan file of plan mode |
| **Plan approval** in the plan mode dialog: approve, or keep planning with comments | you | |
| The approved plan is cut into files, without retyping | `scripts/split-plan.mjs` | `02-plan.md`, `02-plan/common.md`, `02-plan/part-<n>.md`, `02-plan/documentation.md`, `acceptance.md`, `qa-scenarios.md` |
| Worktrees `<repo>-<id>` from the chosen base branch, the application started from the worktree, a baseline run of the checks | main session | `checks/baseline.log` |
| Parts, wave by wave: up to three implementers at a time in one worktree, each building one part with its tests and a UI check | `task-implementer` (opus) | code, `03-implementation/part-<n>.md` |
| Review of each part from its commit, with a fix loop, and a review across the parts of a wave | `task-reviewer` (fable) | `04-review/part-<n>.md`, `04-review/wave-<w>.md` |
| Second review of the whole branch by another model, triaged the way bot comments are | Codex, `task-reviewer` (fable) | `04-review/codex-<repo>.md` and its `.triage.md` |
| Documentation and test cases, at the same time as the first QA pass (acceptance criteria, unusual user actions) | a fork of the main session, Codex | `05-docs.md`, `06-qa.md` |
| Run of the written test cases, and fix rounds | Codex, implementer, reviewer, `task-docs` | `06-qa.md` |
| **PR gate**: `yes / no / edit` | you | |
| Pull requests and the review bot loop (CodeRabbit) | main session, reviewer, implementer | `07-pr.md` |
| Summary and an optional Shortcut comment (`yes / no / edit`) | main session | |

How it behaves:

- **Nothing is built before the plan is approved.** The command collects the context, enters plan mode itself, and plan mode blocks every write until you approve. If you decline plan mode, the plan is written to a file and the gate is the word `approve`.
- **The plan is one file with two halves.** The first is for you, in your language: summary, scope, decisions and research findings, the table of parts, what is not covered by tests, risks. The second is for the agents, in English: a common section and one card per part. An implementer reads only the common section and its own card, so it starts with a few thousand tokens instead of the whole plan.
- **Parts and waves.** A part is 3 to 10 files with their tests, sized to about forty tool calls. Parts of one wave do not depend on each other and share no file, so they are built at the same time; a file several parts would touch is given to one of them. When the page does not exist yet, the first wave builds a skeleton (types, API client, the page with fixture data), so that every later part is visible in the application the moment it is built.
- **Commit, then review.** When an implementer is done, the main session commits the files of the part and the reviewer reads that commit. The next wave starts as soon as the whole wave is committed and the full check (type check, lint, all tests) is green, without waiting for the reviews. Fixes from a review are further commits. Parts of one wave are also reviewed together once, for duplication and mismatched contracts between them.
- **UI check.** A part that changes what the user sees is checked by its own implementer in the running application, in about fifteen tool calls: in the browser for the web applications, on the simulator or emulator through `mobile-mcp` for the mobile application. The browser of the session and the device are shared, so implementers take turns; a check that cannot run while other parts are still being written is repeated when the wave is complete.
- **Second review.** After the last wave the whole branch is read once more by Codex, with the project's rules and the plan at hand and without the history of the run. Its findings are triaged by the reviewer (fix, dismiss with a reason, or ask you), the same way review bot comments are, and the fixes are committed before documentation and QA start.
- **Documentation.** The first pass is written by a fork of the main session: it inherits what the main session knows about the feature, and its prompt cache, so nothing is learned twice. Above about 200K tokens of context a fork would cost too much per turn, and the `task-docs` agent writes instead. Later corrections (`sync`) are always done by `task-docs`.
- **QA runs on Codex,** in a browser of its own, so for a web application the first pass (acceptance criteria, unusual user actions) runs next to the documentation. When the documentation is written, a second run executes the written test cases as they are written, so a wrongly worded case comes back as a finding. Codex follows the same instructions as the `task-qa` agent, can write only into the task directory, and writes its report as it goes, so a run that is cut off continues from the report. For the mobile application there is one device, so documentation is written first and QA runs after it.
- **Without Codex.** When Codex is not installed, not logged in, or out of quota, the command asks you what to do: try again, skip the second review, run QA with the `task-qa` agent, or skip QA. The answer holds for the rest of the run.
- **The epic analysis is reused.** When `/epic-readiness` has been run for the epic (or for a story's parent epic), `/implement` does not collect the sources again. It reads what changed since the analysis (new comments, a new contract version, story states) and takes your decisions and the base branches from it. With the verdict `partly` it plans only the areas that can start now; what waits is shown in the plan. Without an analysis it recommends running `/epic-readiness` first and lets you choose to collect the context itself.
- **A story** is read together with its parent epic: the epic's description, comments, documents and backend links go into the context as reference. Only the story itself is implemented.
- **An epic** is planned as one plan over its frontend stories. Backend stories are included only when the extra instructions ask for them. Each repository gets one branch and one pull request.
- **Tests.** All new and changed code is covered by automated tests: every line and branch of a new file, every changed line of a changed file. Anything the plan leaves uncovered is listed in it. A refactoring or a library replacement starts with a part of characterization tests. The reviewer blocks a part that misses this.
- **Questions.** While planning, the main session asks you directly. A question from an agent that the approved plan already answers is answered from the plan; anything that needs a new decision comes to you.
- **Changing the plan later.** A correction that changes neither scope nor behaviour is made in the card. A change of scope or behaviour goes through plan mode again, with the new and changed cards only.
- **QA findings** go back to an implementer, the fix is reviewed, the documentation is brought in line, and QA reruns the affected items.
- **Review bot comments** are triaged by the reviewer: fixed, or answered with a reason. Fixes are pushed once per round.
- **Token use.** An agent reads its whole history again on every turn, so its cost grows roughly with the square of the number of steps it takes. The pipeline therefore keeps every context small:
  - a part is small, and its implementer and reviewer are new instances that read the common section and one card, not the context file or the whole plan;
  - an agent that runs long hands over: it returns `partial` with a list of what remains, and a fresh instance continues from the report;
  - a documentation `sync`, a QA `cases` run and a `retest` are new instances that read the earlier report;
  - agents get their environment (addresses, which API each application talks to, the device, test data notes) from the context file and stop early with `blocked` when it does not work, instead of working around it;
  - the main session plans and orchestrates, so its context is the largest and it takes the most turns. It leaves the reading of code to research agents, does not reread reports, and measures itself with `scripts/session-context.mjs`: above about 150K tokens after the approval, or 200K at the end of a wave, it offers to continue in a new session.

  For the same reason `/implement` has to be started in a fresh session, and a long run is cheaper to continue in a new one: `/clear`, then `/implement` with the same ID. The state is in files.

Models:

| Who | Model | Effort |
|---|---|---|
| `task-reviewer` (every kind of review, triage of bot comments) | Fable | `high` |
| Main session: planning and orchestration | Opus | `xhigh` |
| `task-implementer`, `task-docs`, `task-qa` | Opus | `xhigh` |
| Research agents in plan mode (`Explore`, `Plan`) and the documentation fork | Opus | as the session |
| Codex: the second review and QA | the default of your Codex configuration | the same |

The agents' models and effort are pinned in their frontmatter; to change them, edit the agent file. The main session is not pinned (a pin in a command's frontmatter lasts only until your next message), so the command checks the session's model and effort at the start and asks when they differ. The one exception among the agents is written into `/fix-bugs`, which launches `task-docs` and `task-qa` with `effort: high` for its bounded bug modes. A session running in `acceptEdits` or auto mode passes that mode to the subagents.

Browsers and devices:

- The browser of the session (`playwright` server) and the mobile device (`mobile-mcp` server) are shared by all agents, one user at a time; the main session keeps track of who holds them.
- A Codex run is a separate process that starts its own MCP servers: Playwright with a fresh, headless profile for a web application, `mobile-mcp` for the mobile one. They are passed on the command line by `scripts/codex-run.mjs`, so nothing is added to your Codex configuration, and a QA run never competes for the browser of the session.
- No agent defines a browser of its own. An MCP server defined inline in an agent file is shared by all running instances of that agent type and closed when any of them finishes, so it cannot give parallel agents a browser each.

What it writes outside your machine:

- **Shortcut:** moves the story to In Development when the command starts (for an epic, each story when its first part starts). This is automatic. The final comment is posted only after `yes`. Nothing else is written.
- **Git:** local commits in the task worktrees are made automatically from the moment the plan is approved: one per part, and one per round of fixes. The message follows the project's `commit.md`, with the part as the subtask of the story (`<story>/<part>: <description>`) and without trailer lines; your approval of the plan stands in for the per-commit confirmation of `/commit`. Push and pull requests happen only after `yes` at the PR gate; after that, fixes for bot comments and replies in threads need no further confirmation. Pull requests are never merged.
- **Codex:** the second review and QA send the code of the branch, the documentation and the test users of the local and staging applications to Codex (OpenAI). The test users are passed in the prompt; Codex is not given the path of the settings file, which also holds tokens, and it is told not to open files with secrets, though the sandbox lets it read any file. The log of a QA run stays in `.tasks/<key>/qa/` with the passwords removed. Production is never involved.

Artifacts live in `.tasks/<key>/` (`sc-<id>` or `epic-<id>`) inside the directory where the session was started, together with `state.md`, downloaded attachments, check logs and screenshots. All state passes between agents through these files, so a run can be continued in a new session. A run started by the previous version of the command (phases instead of parts) is continued as it is: each remaining phase is built as a wave of one part. When you start sessions inside a project repository, keep the directory out of git without touching the project:

```bash
echo '.tasks/' >> ~/.config/git/ignore
```

Requirements:

- the setup script has been run for the project, so the command, the agents, `.mcp.json` and `AI_CONFIGS_DIR` are in place, and `node` is on the path (the command runs the two scripts in `scripts/`);
- the session is not in plan mode when the command starts: it writes the context first and enters plan mode itself;
- the session is new, or was cleared with `/clear`, before the command is started;
- the session runs on Opus at `xhigh` effort, and accepts edits automatically: the documentation fork inherits the session's permission mode and would otherwise ask you about every file it writes;
- `gh` is authenticated, otherwise the pull request stages are skipped;
- the Codex CLI is installed and logged in (`codex login`) for the second review and QA; without it the command asks whether to go on with `task-qa` and no second review;
- `SHORTCUT_API_TOKEN` is set (see [Shortcut MCP setup](#shortcut-mcp-setup)); it is used to read attachments;
- for the mobile application, a simulator or emulator with the application open, served from the task worktree;
- test users for the local and staging applications are listed in the project's `.claude/settings.local.json`, so agents can log in without asking:

  ```json
  {
    "test_users": [
      { "role": "admin", "email": "...", "password": "..." }
    ]
  }
  ```

  These accounts must hold test data only: agents are allowed to create, change and delete data with them. Agents never log in to production, and they ask you to log in to external systems yourself.

## `/fix-bugs` command

`/fix-bugs <epic ID or URL> [bug story IDs] [extra instructions]` fixes a batch of bug stories of one epic in a single run. The command (`common/.claude/commands/fix-bugs.md`) is a lighter sibling of `/implement`. Its own agent, `task-bugfixer`, owns one bug from diagnosis to fix, so the code is studied once; `task-reviewer`, `task-docs` and `task-qa` are shared with `/implement` and run in their bug modes. `task-implementer` takes no part.

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
