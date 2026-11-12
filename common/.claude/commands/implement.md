---
description: Run a Shortcut story or epic through the task pipeline (plan, implement, review, document, QA, pull request)
argument-hint: <story or epic ID or URL> [extra instructions]
disable-model-invocation: true
---

# Implement

Takes a Shortcut story or epic through a multi-agent pipeline:

context → plan → **plan gate** → worktrees → implement → review → documentation → QA → **PR gate** → review bot → summary

**Usage:** `/implement <story ID | epic ID | story URL | epic URL> [extra instructions]`

**Arguments:** $ARGUMENTS

You are the orchestrator and you run in the main session. You read Shortcut, talk to the person, create worktrees, commit, push and open pull requests. The thinking and the editing are done by five subagents, each with its own context and a pinned model:

| Agent | Job | Writes |
|---|---|---|
| `task-planner` | researches the code, writes the plan | `02-plan.md` |
| `task-implementer` | implements a phase, fixes findings | code in worktrees, `03-implementation.md` |
| `task-reviewer` | reviews changes, verifies fixes, triages bot comments | `04-review.md`, triage in `07-pr.md` |
| `task-docs` | documents the feature, writes test cases | documentation worktree, `05-docs.md` |
| `task-qa` | tests the running application | `06-qa.md` |

---

## Rules that hold in every step

1. **Launching agents.** Call the Agent tool with `subagent_type` set to one of the five names above. Do not pass `model`, `effort` or `isolation`: the model and effort are pinned in each agent's file and a parameter would override them. Do not use any other agent type or a fork, and do not do an agent's job yourself. If an agent cannot be launched, stop and tell the person.
2. **State travels through files.** Every agent reads and writes files in the task directory. Give agents absolute paths. Never paste or paraphrase one agent's result into another agent's prompt: point to the file.
3. **Agents run in the background.** After you launch or resume one, end your turn with one line saying what is running. Continue when its completion notification arrives. Never predict, summarise or act on a result you have not received.
4. **Resume, do not respawn.** Record every agent ID in `state.md` as soon as you get it. To continue an agent's work (feedback, answers, the next phase, a fix round) use SendMessage with that ID, so it keeps its history. Launch a new instance only when a step says so or when the resume fails; then record the new ID and tell the new agent which files hold the earlier work.
5. **Open questions belong to the person.** When an agent returns `status: open-questions`, ask the person with AskUserQuestion: at most four questions per call, the agent's options as choices, the agent's recommended option first and labelled as the agent's recommendation. Never answer such a question yourself, and never pick an approach on the person's behalf. Append each question and answer to `01-context.md` under `## Clarifications`, then resume the same agent with the answers.
6. **Nothing is built before the plan is approved.** Until the person writes `approve` at the plan gate there are no worktrees, no code edits and no commits.
7. **Git.** Only you commit, only inside task worktrees, only after the plan is approved. Push and open pull requests only after `yes` at the PR gate. Never merge, never force-push, never rewrite history, never change a main checkout.
8. **Shortcut.** Read freely through the Shortcut MCP tools and the REST API (GET only). Exactly two writes are allowed: moving a story to In Development (automatic, Steps 2 and 6) and one final comment after an explicit `yes` (Step 13). Nothing else, ever.
9. **Credentials.** Local and staging applications are entered with the test users from local settings. External systems are entered by the person, never by you or an agent. Production is never entered or tested. Credential values never go into any file.
10. **Language.** Files, prompts and artifacts are in English. Talk to the person in the language they use.
11. **A stopped agent.** If an agent ends because it reached its turn limit, resume it with "Continue from where you stopped." If it returns `status: blocked`, show the person what it needs, resolve it with them, and resume the same agent.

---

## Step 0. Parse the arguments

The first token of the arguments identifies the task; everything after it is the person's extra instructions.

- URL containing `/story/<id>` → story. URL containing `/epic/<id>` → epic.
- `sc-<id>` → story.
- A bare number → call `get_story`; if no story has that ID, call `get_epic`.
- Nothing → ask for the ID or URL and wait.

The task key is `sc-<id>` for a story and `epic-<id>` for an epic. The task directory is `.tasks/<key>/` inside the directory this session was started in; resolve it to an absolute path once and use that path everywhere.

## Step 1. Preflight

Check, in this order, and stop at the first failure that blocks the run:

1. **Shortcut MCP.** The `mcp__shortcut__*` tools are available. If not, tell the person to run the setup script for this project, restart Claude Code, check `/mcp`, complete the OAuth login, and stop.
2. **Not plan mode.** In plan mode every subagent is forced into plan mode too and the implementer cannot write. Ask the person to leave plan mode and run the command again.
3. **Agents installed.** The five `task-*` agent types are available. If not, tell the person to run the setup script and restart Claude Code (a newly created `agents` directory is picked up only after a restart), and stop.
4. **GitHub CLI.** Run `gh auth status`. If it fails, warn now that Steps 10 and 11 will be skipped and the pull requests will have to be opened by hand, then continue.
5. **Existing run.** If the task directory already exists, read `state.md` and ask with AskUserQuestion whether to continue from the recorded stage or start over. On continue, jump to that stage; agent IDs from an earlier session may no longer resume, which rule 4 covers. On start over, keep nothing from the old directory except `attachments/`.

## Step 2. Collect the context

You do this yourself, in the main session.

**Sources.** Use the Shortcut MCP tools and the Shortcut REST API together. The REST API returns what MCP does not, such as attached files:

```bash
curl -s -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/<id>
curl -s -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/epics/<id>
```

Take `.files[]` (`name`, `content_type`, `url`), download each file with the same header into `<task dir>/attachments/`, and read it. On Windows use `$env:SHORTCUT_API_TOKEN`. The token is written to `.claude/settings.local.json` by the setup script. Never print it.

**A story.** Collect the title, description, acceptance criteria, checklists and tasks, comments, story relationships, external links, labels, team and workflow state.

**The parent epic of a story.** When the story belongs to an epic, read that epic as thoroughly as in an epic run. The epic usually holds the specification, and the story names only a slice of it.

- Read the epic's description, comments, linked documents, links, attachments and videos.
- Links in it to backend code and backend documentation go under `Backend references`.
- List the epic's other stories with title, workflow state and whether each is frontend or backend. Do not read them in full.
- Record all of this under `Parent epic` in the context file.

The epic is reference material. The scope of the run stays the story you were given: one phase, and the sibling stories are never implemented, moved to another state or commented on. A disagreement between the story and its epic is an ambiguity to ask about, as described below.

**An epic.** Collect the epic's description, comments, linked documents and links, and the list of its stories. The epic is the specification: links in it to backend code and backend documentation are references for the planner, to be read and not changed.

- Phases are the **frontend** stories of the epic: title prefix `[Frontend]`, a frontend team, or a frontend label. Leave out stories that are already completed.
- Backend stories are left out unless the extra instructions explicitly ask for backend work.
- If any story cannot be classified, ask with AskUserQuestion (multiSelect) which of the unclear ones to include.
- Read every included story in full, as for a single story.
- Show the person the resulting list: included stories in order, and excluded ones with the reason.

**Linked material.**

- External links: open them with WebFetch, or with the Playwright MCP server when the page needs a browser.
- Videos (Loom, Fathom and similar): look for a transcript in the description and comments first. If there is none, open the video page through Playwright and read the transcript from the page.
- If an external system asks for a login, ask the person to log in in the browser window that Playwright opened and wait for them to confirm. Never type credentials into an external system.
- If something still cannot be read, do not skip it silently: tell the person what and why, and ask for the content as text or a screenshot.

**In Development (story run).** As soon as the story is read, move it to In Development: find the state named "In Development" in the story's own workflow and call `update_story` with that state. Do not move a story that is already in In Development or in any later state, and never move a story backwards. If the state cannot be found or the write is refused, say so and continue; this never blocks the run. For an epic, stories are moved one by one in Step 6.

**Ambiguity.** If the requirements are unclear, incomplete or contradict each other (description against comments, story against epic), ask with AskUserQuestion now. Do not carry a guess into the plan.

**Repositories.**

1. Find the workspace project map: a `CLAUDE.md` in the session directory or its parent that lists the projects and their roles. If the session directory is itself a single project, that project is the target.
2. Decide which repositories the task changes (frontend projects, and the documentation repository when the workspace has one) and which are read-only references (backend).
3. For every repository that will change, run `git -C <repo> fetch origin --prune` and ask the person for the base branch with AskUserQuestion, offering the integration branches found in `git -C <repo> branch -r` (for example `stage`, `beta-stage`, a current sprint branch, `main`). Ask for all repositories in one call.
4. Find the code read path for the planner: a checkout of that repository whose `HEAD` equals `origin/<base>` (check the main checkout and `git -C <repo> worktree list --porcelain`). If there is none, the read path is the ref `origin/<base>` itself.
5. The rules path is the main checkout: `<repo>/CLAUDE.md` and `<repo>/.claude/rules/`.

**Write the files.** Create `01-context.md` and `state.md` from the templates at the end of this file.

## Step 3. Plan

Launch `task-planner`:

```text
Task key: <key>
Context file: <task dir>/01-context.md
Plan file to write: <task dir>/02-plan.md

Research the repositories listed in the context file and write the plan.
```

Record the agent ID. When it finishes:

- `open-questions` → rule 5, then resume the same planner.
- `done` → check that the plan file exists and contains `## Repositories and worktrees`, `## Phases` and `## Tests`, then go to the gate.

## Step 4. Plan gate (mandatory)

Show the person:

- a summary of the plan in at most ten lines;
- the absolute path of `02-plan.md`;
- the repositories and worktrees table from the plan;
- the list of phases;
- from the plan's `Tests` section: the coverage criterion and everything listed under `Not covered`, with the reasons;
- this notice: writing `approve` also allows local commits in the task worktrees; nothing is pushed until the PR gate.

Tell them they can answer `approve`, write feedback in free text, edit the plan file by hand and then answer `approve`, or answer `cancel`. Then stop and wait.

- **`approve`** (also `approved`) → read the plan file again from disk, because it may have been edited by hand. Record the revision and approval time in `state.md`. Continue to Step 5.
- **A bare "ok", "yes", "так" or similar** → this gate needs the exact word. Ask the person to write `approve`.
- **`cancel`** → record the stage as cancelled and stop.
- **Anything else** is feedback. Resume the same planner with SendMessage:

  ```text
  Reviewer feedback on the plan, verbatim:
  <the person's message>

  Read the plan file from disk first (it may have been edited by hand), update it in place, bump the revision and add a revision log entry.
  ```

  If the resume fails, launch a new `task-planner` with the context path, the existing plan path and the feedback. When it finishes, return to the start of this step.

Repeat until `approve`. There is no limit on the number of rounds.

## Step 5. Create the worktrees

For every row of the approved plan's `Repositories and worktrees` table:

```bash
git -C <main checkout> fetch origin <base>
git -C <main checkout> worktree add --no-track -b <branch> <worktree directory> origin/<base>
```

- If the worktree directory already exists, reuse it only when it is on the planned branch; otherwise ask the person.
- Install dependencies when the repository has a lockfile: `npm ci` for `package-lock.json`, `yarn install --frozen-lockfile` for `yarn.lock`. Run long installs in the background.
- Copy untracked environment files (`.env`, `.env.*`) from the root of the main checkout into the worktree. Do not print their contents.
- If an install fails, show the error and ask the person how to proceed.

Record the worktrees in `state.md`.

## Step 6. Implement and review, phase by phase

The phases come from the approved plan. Normally a story is one phase and an epic has one phase per story; a refactoring or a library replacement starts with a separate phase of characterization tests, which is implemented, reviewed and committed like any other. For each phase, in the order of the plan:

**a. In Development (epic run).** Move this phase's story to In Development, with the same rules as in Step 2.

**b. Implement.** For the first phase launch `task-implementer`; for later phases resume the same agent.

```text
Task key: <key>
Phase to implement: <n> <title>
Context file: <task dir>/01-context.md
Approved plan: <task dir>/02-plan.md
Implementation report to write: <task dir>/03-implementation.md
Worktrees you may edit:
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
Test users: <settings file path>, key test_users
```

**c. Review.** For the first review launch `task-reviewer`; afterwards resume the same agent.

```text
Mode: phase-review, phase <n>, round 1
Context file: <task dir>/01-context.md
Approved plan: <task dir>/02-plan.md
Implementation report: <task dir>/03-implementation.md
Review file to write: <task dir>/04-review.md
Worktrees with the changes (uncommitted since the last phase commit):
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

**d. Fix loop.** On `CHANGES REQUESTED`:

1. Resume the implementer: "Fix the blocking findings of phase `<n>`, round `<r>` in `<task dir>/04-review.md` and record the fix round in your report."
2. Resume the reviewer in `fix-verification` mode for the next round.
3. If the implementer declined a finding and the reviewer kept it, put both positions to the person with AskUserQuestion.
4. After two fix rounds that still end in `CHANGES REQUESTED`, ask the person with AskUserQuestion: run another round, accept the phase as it is (the remaining findings go into the open items of the summary), or stop.

**e. Commit.** On `APPROVED`, commit the phase in every worktree it changed:

1. Stage exactly the files listed for this phase in the `Changes` table of the implementation report: `git -C <worktree> add -- <paths>`.
2. Run `git -C <worktree> status --short`. If other changes remain, do not stage them blindly: resume the implementer to account for them. Never stage `.env` files, credentials or anything from the task directory.
3. Commit with the message format of `commit.md`: `<task number>: <description>`, imperative, in English, at most 200 characters, no trailing period, no trailer lines. The task number is the story ID; for an epic it is the ID of the story this phase implements.
4. Record the commit hash in `state.md`.

## Step 7. The application for documentation and QA

Ask with AskUserQuestion how the application will be available, for each application the task changed:

- **Start it from the worktree.** Read the project's `CLAUDE.md` for the development command, start it from the worktree in the background on a free port, and wait until the URL responds. You stop it again in Step 12.
- **It is already running.** The person gives the URL.
- **No application.** Documentation is written without screenshots and QA is skipped; both facts go into the summary.

The URL must be a local or staging address. If you cannot tell whether an address is production, ask.

Test users come from the `test_users` key of `.claude/settings.local.json` in the session directory, or in the target project if the session directory has none. Do not ask the person for them. These environments hold test data only, so agents may create, change and delete whatever they need with these users. Give agents the path of the settings file, never the values. If no test users are configured, ask the person for credentials and keep them in the conversation only.

## Step 8. Documentation

Skip this step, and say so in the summary, when the workspace has no documentation repository.

Launch `task-docs`:

```text
Mode: write
Task key: <key>
Context file: <task dir>/01-context.md
Approved plan: <task dir>/02-plan.md
Implementation report: <task dir>/03-implementation.md
Review: <task dir>/04-review.md
Documentation worktree: <worktree directory>
Code worktrees (read only):
- <repo>: <worktree directory>
Report to write: <task dir>/05-docs.md
Application URL: <url, or "not available">
Test users: <settings file path>, key test_users
```

When it finishes, commit in the documentation worktree exactly the files listed in the `Documents` table of `05-docs.md`, with the same message format. The task number is the story ID, or the epic ID for an epic.

## Step 9. QA

Skip this step when no application is available.

Launch `task-qa`:

```text
Mode: full
Task key: <key>
Context file: <task dir>/01-context.md
Approved plan: <task dir>/02-plan.md
Implementation report: <task dir>/03-implementation.md
Documentation report: <task dir>/05-docs.md
Documentation worktree: <worktree directory>
Application URL: <url>
Test users: <settings file path>, key test_users
Report to write: <task dir>/06-qa.md
Screenshots directory: <task dir>/qa/
```

If the verdict is `PASS`, continue to Step 10. If there are findings, run a fix round:

1. **`BUG` findings.** Resume the implementer: "Fix the `BUG` findings of round `<r>` in `<task dir>/06-qa.md` and record the fix round in your report." Then resume the reviewer in `fix-verification` mode on those fixes, with the usual fix loop from Step 6d. Commit the approved fixes as in Step 6e.
2. **Documentation.** If there are `DOC` findings, or a fix changed behaviour that the documentation describes, resume `task-docs` in `sync` mode, pointing it to `06-qa.md` and the fix round in the implementation report. Commit its changes.
3. **Retest.** Resume the same `task-qa` in `retest` mode with the failed items and the items next to the changed code.

After two fix rounds that still end in `FAIL`, ask the person with AskUserQuestion: run another round, accept with the remaining findings as open items, or stop. `BLOCKED` items do not start a fix round; they are reported at the PR gate.

## Step 10. PR gate

Skip Steps 10 and 11 when `gh` is not available, and list the manual steps in the summary.

Before the gate, state plainly anything that is not clean: a phase accepted with open review findings, QA skipped or accepted with findings, `BLOCKED` QA items, pending documentation.

For every worktree with commits, show:

- the commits: `git -C <worktree> log --oneline origin/<base>..HEAD`
- the size: `git -C <worktree> diff --stat origin/<base>..HEAD`, with a warning when more than 150 files changed, because the review bot does not review a pull request of that size
- the pull request title: `<task number>: <short description>`
- the pull request description: a summary of the change, the stories it implements, how it was tested, and a link to the documentation pull request
- the target branch: the base branch of that worktree

Mention only the stories of this run with the `sc-<id>` form, in the branch name, title and description. The Shortcut integration links a pull request to every story mentioned that way and moves its state, so a related story from outside this run is named without the prefix and without a link.

Ask: `yes / no / edit`.

- **`yes`** → for each worktree, documentation first so the code pull requests can link to it:

  ```bash
  git -C <worktree> push -u origin <branch>
  cd <worktree> && gh pr create --base <base> --head <branch> --title "<title>" --body-file <file>
  ```

  Record the pull request URLs in `state.md` and at the top of `07-pr.md`.
- **`edit`** → change the title or description as asked and show the gate again.
- **`no`** → skip to Step 12 and list the manual steps there.
- Anything else is a comment on the gate, not consent. Answer it and ask again.

## Step 11. Review bot

The repositories use an automated reviewer (CodeRabbit). Handle each pull request the same way.

**Wait for the review.** Start a background shell loop that checks the pull request once a minute for up to 15 minutes and exits as soon as the bot has submitted a review newer than your last push, or has commented that it found nothing or hit a rate limit. Use `gh pr view <number> --json reviews,comments` for the check. Do not poll from the conversation; wait for the loop to finish.

- No bot activity after the wait: post one comment `@coderabbitai review` with `gh pr comment`, and wait once more. If there is still nothing, note it for the summary and move on.
- A rate limit notice: tell the person, including the time the bot gives, and wait for their decision.

**Collect.** Fetch the unresolved review threads (GraphQL `reviewThreads` with `isResolved`, path, line and comment bodies) and the actionable remarks in the review body. Write them verbatim into `07-pr.md` under `## Round <n>`, each with an ID `C<n>.<k>`, the pull request, the file and the line. If there is nothing actionable, this pull request is done.

**Triage.** Resume the reviewer:

```text
Mode: pr-triage, round <n>
Bot comments to triage: <task dir>/07-pr.md, section "Round <n>"
Worktrees:
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

**Act on the triage.**

1. `ask-user` items → AskUserQuestion; the answer turns each into `fix` or `reply`.
2. `fix` items → resume the implementer: "Fix the comments marked `fix` in the triage of round `<n>` in `<task dir>/07-pr.md` and record the fix round in your report." Then resume the reviewer in `fix-verification` mode.
3. If a fix changed behaviour, rerun the affected cases with `task-qa` in `retest` mode and update the documentation with `task-docs` in `sync` mode.
4. Make **one** commit per repository for the whole round and push once. Every push starts another bot review and uses its quota, so never push fixes one at a time.
5. Reply in every thread with `gh api`: "Fixed in `<short sha>`: <what changed>" for fixed comments, the reviewer's drafted reply for the others. Resolve the threads you fixed (GraphQL `resolveReviewThread`). Leave declined threads open for the bot or the person to close. Answer remarks from the review body in one pull request comment that mentions `@coderabbitai`.
6. Record the replies and the commit in `07-pr.md`, then wait for the bot's next pass.

After three rounds on one pull request, ask the person with AskUserQuestion whether to continue, stop with the remaining comments as open items, or handle them personally.

## Step 12. Summary

Stop any development server you started. Set the stage in `state.md` to `done`. Then report, in the person's language:

- what changed, per repository and per phase;
- the pull requests, with links;
- the review outcome, the documentation written, the QA result, the bot rounds;
- what to check by hand;
- open items: backend dependencies, findings accepted or deferred, skipped steps, pending screenshots, test data left behind;
- the worktree directories and branches.

## Step 13. Shortcut comment

Draft a comment of two to four lines in English: the task is implemented, the pull requests, and links to the feature document and the test cases. No list of changes.

Show the draft and ask: `yes / no / edit`.

- **`yes`** → post it with `create_story_comment` for a story or `create_epic_comment` for an epic.
- **`edit`** → apply the change, show the draft again, ask again.
- **`no`**, or anything that is not an explicit yes → post nothing.

---

## Templates

### `state.md`

Update it after every stage change, every agent launch and every commit.

```markdown
# State: <key>

- Source: <URL>
- Type: story | epic
- Stage: context | planning | plan-gate | worktrees | phase <n> implement | phase <n> review | docs | qa | pr-gate | pr-review | done | cancelled
- Plan: revision <n>, approved <date and time> | not approved
- Application: <URL> (started by the orchestrator: yes | no) | not available

## Agents
| Role | Agent ID | Last used for |

## Repositories
| Repository | Main checkout | Base | Worktree | Branch | Pull request |

## Phases
| # | Story | Title | In Development | Review rounds | Commit |

## Rounds
QA fix rounds: 0 · Bot rounds per pull request: 0

## Log
- <date and time> <event>
```

### `01-context.md`

```markdown
# Task context: <key>

- Source: <story | epic> <id>, <URL>
- Title: <title>
- Collected: <date and time>

## User instructions
<the extra instructions from the command line, verbatim, or "None">

## Requirements
<the description, verbatim; for an epic the epic description first, then each included story under its own heading>

## Acceptance criteria
<numbered AC-1, AC-2, …; for an epic grouped by story>

## Parent epic
<story run only; "None" when the story has no epic>
- Epic: <id>, <title>, <URL>

### Epic description
<verbatim>

### Decisions from epic comments
<with author and date>

### Epic documents and links
<what each contains; downloaded files are listed under "Attachments and links">

### Sibling stories
<reference only, not part of this run>
| Story | Title | State | Frontend or backend | How it relates to this task |

## Stories and phases
<epic run only>
| Phase | Story | Title | State | Included | Reason |

## Comments and decisions
<decisions and clarifications from comments, with author and date; not the whole thread>

## Attachments and links
| Item | Type | Local path or URL | What it contains |

## Backend references
<backend code paths, API documentation and contracts named in the task or in its parent epic, read only>

## Repositories
| Repository | Role | Main checkout | Base ref | Code read path | Rules path |

## Environment
- Test users: <settings file path>, key `test_users` (values are never copied here)
- Known application URLs: <local and staging addresses from the project documentation>

## Out of scope
<what was excluded and why, for example backend stories of the epic>

## Clarifications
<questions asked during the run and the person's answers, appended as they happen>
```
