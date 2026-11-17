---
description: Fix the open bugs of a Shortcut epic in one run (diagnose, fix with a regression test, update the documentation and test cases, retest in the browser, pull request)
argument-hint: <epic ID or URL> [bug story IDs] [extra instructions]
disable-model-invocation: true
---

# Fix bugs

Takes a batch of bug stories from one Shortcut epic through a short pipeline:

choose bugs → context → worktrees → diagnosis → **diagnosis gate** → fix and review, bug by bug → documentation and test cases → browser retest → **PR gate** → review bot → summary

**Usage:** `/fix-bugs <epic ID | epic URL> [bug story IDs] [extra instructions]`

**Arguments:** $ARGUMENTS

You are the orchestrator and you run in the main session. You read Shortcut, talk to the person, create worktrees, commit, push and open pull requests. The work is done by four subagents, each with its own context and a pinned model:

| Agent | Job in this command | Writes |
|---|---|---|
| `task-bugfixer` | one instance per bug: finds the root cause, then, after the approval, writes the regression test and the fix | `bugs/sc-<id>.md`, code in a worktree |
| `task-reviewer` | reviews the diff of one bug, triages bot comments | `bugs/sc-<id>.review.md`, triage in `07-pr.md` |
| `task-docs` | corrects the feature document and the test cases | documentation worktree, `05-docs.md` |
| `task-qa` | retests the fixed bugs in the running application | `06-qa.md` |

A bug is small, so this command is built to read little: the epic is not read in full, the feature's existing documentation is the reference for what the behaviour should be, the agent that diagnoses a bug is the one that fixes it, and every stage touches only what a bug affects.

---

## Rules that hold in every step

1. **Launching agents.** Call the Agent tool with `subagent_type` set to one of the four names above. Do not pass `model` or `isolation`. Pass `effort` only where a step says so; everywhere else the effort pinned in the agent's file applies. Do not use any other agent type or a fork, and do not do an agent's job yourself. If an agent cannot be launched, stop and tell the person.
2. **State travels through files.** Give agents absolute paths. Never paste or paraphrase one agent's result into another agent's prompt: point to the file.
3. **Agents run in the background.** After you launch or resume agents, end your turn with one line saying what is running. Where a step launches several agents, launch them in one message so they run at the same time, and continue when the notification of each has arrived. Never predict or act on a result you have not received.
4. **Short-lived agents.** An agent reads its whole history again on every turn, so a long history makes every later turn expensive.
   - A `task-bugfixer` lives for one bug: it is resumed for the approval, for answers to its questions and for findings on its fix.
   - A `task-reviewer` lives for one bug, or for one review bot round.
   - `task-docs` and `task-qa` are never resumed for a new round: a `sync` or a `retest` is a new instance that reads the earlier report.
   - An agent that returns `status: partial` has handed its work over: launch a new instance of the same type with the same paths and the line "Continue from the report: `<path>`". It is not resumed.
   - An agent that stops at its turn limit has not written its report yet. Resume it once with: "Do not continue the work. Write your report now with `Status: partial` and what remains, then stop." Then launch a new instance as above. A `task-reviewer` has no hand-over: resume it with "Continue from where you stopped."

   Record every agent ID in `state.md`. If a resume fails, launch a new instance and point it to the files with the earlier work.
5. **Open questions belong to the person.** When an agent returns `status: open-questions`, ask with AskUserQuestion: at most four questions per call, the agent's recommended option first and labelled as the agent's recommendation. Never answer one yourself. Append question and answer to `01-context.md` under `## Clarifications`, then resume the same agent.
6. **Nothing is fixed before the diagnosis is approved.** Until the person writes `approve` no project file is edited and nothing is committed. The worktrees exist earlier, but only to be read.
7. **Git.** Only you commit, only inside task worktrees, only after the approval. Push and open pull requests only after `yes` at the PR gate. Never merge, never force-push, never rewrite history, never change a main checkout.
8. **Shortcut.** Read freely (MCP tools, REST API with GET). Writes allowed: moving a bug story to In Development when its fix starts (automatic), and the comments the person approved in Step 12. Nothing else.
9. **Credentials.** Local and staging applications are entered with the test users from local settings. External systems are entered by the person. Production is never entered or tested. Credential values never go into any file.
10. **Language.** Files, prompts and artifacts are in English. Talk to the person in the language they use.
11. **A blocked agent.** If an agent returns `status: blocked`, resolve what it needs with the person and resume it. A blocked `task-qa` usually names an environment problem: fix the environment (see Step 8), update `Environment` in the context file, and launch a new instance.
12. **Other commands' files.** `.tasks/epic-<id>/readiness/` belongs to `/epic-readiness` and the numbered files directly in `.tasks/epic-<id>/` belong to `/implement`. Never write, move or delete them.
13. **Keep your own context small.** Each of your turns reads this whole conversation again. Do not read bug files, reports or source files in full: use the agents' final messages, `state.md`, or a targeted search for one section or table. Keep command output short, and never let a raw API response into the conversation: filter it first.

---

## Step 0. Parse the arguments

- The first token is the epic: a URL containing `/epic/<id>` or a bare number (check with `get_epic`). If it is a story, say that this command works on an epic, name the story's epic and ask whether to run on it.
- Further numeric tokens, `sc-<id>` tokens or story URLs are the bugs to fix. Everything after them is the person's extra instructions.
- Nothing → ask for the epic and wait.

The run directory is `.tasks/epic-<id>/bugfix-<n>/` inside the directory this session was started in, where `<n>` is the next free number. Resolve it to an absolute path once. All paths below are inside it.

## Step 1. Preflight

Stop at the first failure that blocks the run.

1. **Tools.** Load the deferred tools this run needs in one ToolSearch call: the Shortcut tools you will use (`get_epic`, `get_story`, `list_story_comments`, `update_story`, `create_story_comment`), `SendMessage` and `TaskStop`. If the `mcp__shortcut__*` tools are not available, tell the person to run the setup script, restart Claude Code, check `/mcp`, complete the OAuth login, and stop.
2. **Not plan mode.** Subagents would be forced into plan mode and could not write. Ask the person to leave plan mode and run the command again.
3. **A fresh session.** Because of rule 13, this command has to start in a session with little history. If this conversation already holds substantial earlier work, stop and ask the person to start a new session, or to run `/clear`, and start the command again. Everything the command needs is in files.
4. **Agents installed.** The four agent types of the table are available. If not, tell the person to run the setup script and restart Claude Code, and stop.
5. **GitHub CLI.** Run `gh auth status`. If it fails, warn that Step 11 will be skipped and the pull requests will have to be opened by hand, then continue.
6. **Unfinished run.** If an earlier `bugfix-<n>/state.md` of this epic has a stage other than `done` or `cancelled`, ask with AskUserQuestion whether to continue that run or start a new one. On continue, use that directory and jump to its stage; agents of the earlier session are launched anew (rule 4). A run directory that holds `02-plan.md` was started by an older version of this command and cannot be continued by this one: say so, and offer a new run.

## Step 2. Choose the bugs

List the epic's stories through the REST API and filter the response before it reaches the conversation, because the unfiltered list of a large epic is tens of thousands of characters:

```bash
curl -s -H "Shortcut-Token: $SHORTCUT_API_TOKEN" "https://api.app.shortcut.com/api/v3/epics/<id>/stories"
```

Pipe it through `jq` or a short script that keeps the stories of type `bug` that are neither completed nor archived, and prints one line per story: `id`, `name`, `started`, `workflow_state_id`. On Windows use `$env:SHORTCUT_API_TOKEN`. Never print the token. If the token is not set, use `list_epic_stories` with only the fields `id`, `name`, `story_type`, `completed`.

For each bug, make a first guess of its layer from the title: frontend (and which project), backend, or unclear. Do not trust a label or a team alone.

- **Bugs were given in the arguments** → use exactly those. If one of them is completed, is not in this epic or looks like a backend bug, say so and ask whether to keep it.
- **Otherwise** → print a numbered list (number, ID, title, layer), frontend bugs first, then the ones left out as backend, and ask the person which to fix. Accept numbers, IDs or `all` as a plain message. An option dialog cannot hold the list, so this one question is asked in text.

Backend bugs are not fixed by this command unless the extra instructions say so. They are named in the summary.

## Step 3. Collect the context

You do this yourself, in the main session, and you keep it light.

**The bugs.** Read every chosen bug in full: `get_story` and `list_story_comments` for the description, the steps to reproduce, expected and actual behaviour, environment details, comments. Attached files come from the REST API:

```bash
curl -s -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/<id>
```

Take `.files[]` with a filter, download each with the same header into `attachments/` and read it. For a recorded video, look for a transcript first; otherwise open the video page through Playwright and read the transcript there. If a site asks for a login, ask the person to log in in the Playwright browser and wait. If something cannot be read, say so and ask for the content.

**The epic** is not read in full. Take its title and link, nothing more.

**The feature documentation** is the reference for how the feature should behave.

1. Find the workspace project map (a `CLAUDE.md` in the session directory or its parent) and take the documentation repository from it.
2. Run `git -C <docs repo> fetch origin` and search the repository for the feature document and the test case file of this epic: by the epic ID, the IDs of its stories, and the feature name. Test case files usually name their epic and stories in the header.
3. Record the paths of the feature document, the test case file and their other language versions. Do not read them: the agents do.
4. Nothing found, or several candidates → ask the person which documents apply, or whether the feature is undocumented. Without documentation the run still works: the bug stories are then the only reference, and Step 9 writes test cases for the fixed bugs only if the person wants a new document.

**Ambiguity.** If a bug's expected behaviour is unclear, or two bugs contradict each other, ask with AskUserQuestion now.

**Repositories and the application.** Decide from the project map and the bugs' layers which repositories will change: the frontend projects of the chosen bugs, and the documentation repository. Run `git -C <repo> fetch origin --prune` for each. Then ask everything the rest of the run needs in one AskUserQuestion call, so that nothing stops the run between the diagnosis gate and the PR gate:

- the base branch of every repository, offering the integration branches found in `git -C <repo> branch -r`;
- how each changed application will be available for the retest: you start it from the worktree; the person runs it from the worktree (name the directory, `<main checkout>-<epic id>-bugs`, and ask for the URL); or there is no application (the retest is skipped and the documentation gets no new screenshots; both facts go into the summary). A server started from another checkout, and a staging deployment, do not contain the fixes and cannot be used for the retest: say so when the person offers one.

The rules path of a repository is its main checkout: `<repo>/CLAUDE.md` and `<repo>/.claude/rules/`.

**The environment.** The retest is cheap only when the agent does not have to discover its environment. Write down what is already known, from the project map, the projects' `CLAUDE.md` files and your memory notes:

- for each application: its URL and port, which API it talks to (local, staging), and known constraints such as a port the staging API accepts requests from;
- the paths of notes or documents that describe test data for this feature (companies, users, records in the state the bugs need), without copying credentials;
- the settings file with the test users: the `test_users` key of `.claude/settings.local.json` in the session directory, or in the target project if the session directory has none. If none are configured, ask the person for credentials and keep them in the conversation only.

**Write the files.** Create `01-context.md` and `state.md` from the templates at the end of this file.

## Step 4. Create the worktrees

The worktrees are created now, so the agents read the code with ordinary tools. Nothing in them is edited before the approval (rule 6). For every repository that will change:

```bash
git -C <main checkout> fetch origin <base>
git -C <main checkout> worktree add --no-track -b <branch> <worktree directory> origin/<base>
```

- The worktree directory is `<main checkout>-<epic id>-bugs` and the branch `epic-<epic id>/bugfix-<n>`. Reuse an existing directory only when it is on that branch; otherwise ask.
- Install dependencies in the background when the repository has a lockfile: `npm ci` for `package-lock.json`, `yarn install --frozen-lockfile` for `yarn.lock`. The diagnosis does not wait for the install; Step 7 does.
- Copy untracked environment files (`.env`, `.env.*`) from the root of the main checkout. Do not print their contents.
- If an install fails, show the error and ask the person how to proceed.

Record the worktrees in `state.md` and in the `Repositories` table of the context file.

## Step 5. Diagnose

Launch one `task-bugfixer` per bug, all in one message:

```text
Stage: diagnose
Bug: sc-<id> <title>
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md
Bug file to write: <run dir>/bugs/sc-<id>.md
Worktree: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
Documentation worktree (read only): <worktree directory>
Test users: <settings file path>, key test_users
```

Record the agent IDs. As each one finishes:

- `open-questions` → rule 5, then resume that agent.
- `not-fixable-here` → mark the bug in `state.md` with the reason from the final message; it gets no fix.
- `done` → keep the final message for the gate.
- Two agents name the same root cause → treat the two bugs as one fix: the first agent fixes it and the second bug is recorded in `state.md` as covered by the first. The covered bug gets no `Implementation` section and no commit of its own; its bug file stays as the source of its documentation impact and its retest steps, and every later prompt that lists bug files names it as "sc-`<id>`: covered by sc-`<first id>`".
- `not-fixable-here` with the reason "other repository: `<name>`" → the first guess of the layer was wrong. Create that repository's worktree as in Step 4, asking for its base branch, and launch a new `task-bugfixer` for the bug there. When the cause spans two repositories, launch it with both worktrees.

Before the gate, run `git -C <worktree> status --short` in every worktree. The diagnosis is read-only (rule 6), and the worktree is shared by the agents of several bugs. If anything changed, do not discard it yourself: resume the agents that worked in that worktree with "Revert the edits you made during the diagnosis", and check again.

## Step 6. Diagnosis gate (mandatory)

Show the person, built from the agents' final messages without reading the bug files:

- for every diagnosed bug: its ID and title, then the agent's final summary as it is (root cause, fix, regression test, documentation and test cases affected);
- bugs that will not be fixed here (backend, not a bug, cannot be traced), each with the reason;
- the absolute path of the `bugs/` directory;
- the worktrees and branches;
- this notice: writing `approve` also allows code edits and local commits in the task worktrees; nothing is pushed until the PR gate.

Then stop and wait.

- **`approve`** (also `approved`) → record the approval in `state.md`, continue to Step 7.
- **`skip <ID>`** → drop that bug from the run, record it in `state.md`, show the gate again.
- **A bare "ok", "yes", "так" or similar** → ask the person to write `approve`.
- **`cancel`** → record the stage as cancelled, ask whether to remove the worktrees and branches created in Step 4, and stop.
- **Anything else** is feedback. Resume the agent of each bug the feedback concerns: "Stage: diagnose. Feedback on your diagnosis, verbatim: `<message>`. Update the bug file." Then return to the start of this step.

## Step 7. Fix and review, bug by bug

Wait for the dependency installs of Step 4. Bugs in different repositories are worked on at the same time. Bugs in the same repository go one after another, each committed before the next starts, because a review looks at everything not yet committed in the worktree.

For each bug:

**a. In Development.** Move the bug story, and every story this fix covers, to In Development: find the state with that name in the story's own workflow and call `update_story`. Do not move a story that is already in that state or a later one, and never move one backwards. If the write is refused, say so and continue.

**b. Fix.** Resume the bug's `task-bugfixer`: "Stage: fix. The diagnosis is approved." Add what applies: the person's remarks on this bug, verbatim; "Your fix also covers sc-`<other id>`" when two bugs were merged in Step 5; and, when other fixes were committed in this worktree after the diagnosis, "Committed here since your diagnosis: `<commit subjects>`; files changed: `<paths>`" (from `git -C <worktree> log --name-only --format=%s origin/<base>..HEAD`), because the diagnosis was made against the base branch. If the resume fails, launch a new `task-bugfixer` with the prompt of Step 5 and `Stage: fix`.

**c. Review.** Launch a new `task-reviewer`:

```text
Mode: change-review, round 1
Context file: <run dir>/01-context.md
Bug file (the plan and the implementation report of this bug): <run dir>/bugs/sc-<id>.md
Review file to write: <run dir>/bugs/sc-<id>.review.md
Worktree with the changes (this bug is everything not yet committed):
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

**d. Fix loop.** On `CHANGES REQUESTED`, resume the bug's `task-bugfixer` with the path of the review file, then this bug's reviewer in `fix-verification` mode. If the fixer declined a finding and the reviewer kept it, put both positions to the person. After two fix rounds that still end in `CHANGES REQUESTED`, ask the person: another round, accept as it is (the findings go into the open items), or stop.

**e. Commit.** On `APPROVED`:

1. Stage exactly the files in the `Changes` table of the bug file: `git -C <worktree> add -- <paths>`. Take the table with a targeted read.
2. Run `git -C <worktree> status --short`. If other changes remain, resume the bug's fixer to account for them. Never stage `.env` files, credentials or anything from the run directory.
3. Commit in the format of `commit.md`: `<bug story ID>: <description>`, imperative, in English, at most 200 characters, no trailing period, no trailer lines. For a fix that covers several bugs use the first ID as the task number and name the others in the description without the `sc-` prefix.
4. Record the commit hash in `state.md`.

## Step 8. The application for the retest

Skip this step when the person chose "no application" in Step 3.

- **Started by you.** Read the project's `CLAUDE.md` for the development command and start it from the worktree in the background, on the port the project documents. If that port is taken, ask the person instead of choosing another one: a staging API may refuse requests from an unlisted port. You stop the server again in Step 12.
- **Run by the person.** Use the URL the person gave. It must be a local address of a server started from the task worktree. Check it without asking: the working directory of the process listening on that port (`lsof -a -d cwd -p $(lsof -ti tcp:<port> | head -1)`) has to be the worktree. If it is not, or you cannot tell, show the worktree path and ask the person to start the server from it.

Check that each URL answers (`curl`, status code only) and write the final addresses into the `Environment` section of the context file. An environment that does not work is cheaper to find here than inside the retest.

## Step 9. Documentation, then the retest

The two run one after the other, each launched with `effort: high`. The order matters: the retest executes the test cases as the documentation writer left them, including the new regression cases, so a wrongly worded case is caught here and not by a person later.

**a. Documentation.** Skip it, and say so in the summary, when the workspace has no documentation repository or the person said in Step 3 that the feature stays undocumented. Launch `task-docs`:

```text
Mode: bugfix
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md
Bug files of the fixed bugs: <run dir>/bugs/sc-<id>.md, …
Covered bugs: sc-<id>: covered by sc-<first id>, or "none"
Documentation worktree: <worktree directory>
Code worktrees (read only):
- <repo>: <worktree directory>
Report to write: <run dir>/05-docs.md
Application URL (only for retaking a screenshot the fix made wrong): <url, or "not available">
UI tool: shared-browser | mobile-device <device ID> | none
Test users: <settings file path>, key test_users
```

When it finishes, commit in the documentation worktree exactly the files listed in the `Documents` table of `05-docs.md`, with the epic ID as the task number. Then run `git -C <worktree> status --short`: a change that is left over is checked against the `Documents` tables of every round with a targeted search and staged when it is listed there; anything still unexplained is shown to the person, not committed.

**b. Retest.** Skip it, and say so in the summary, when there is no application. Launch `task-qa`:

```text
Mode: bugfix
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md (its Environment section is current)
Bug files of the fixed bugs: <run dir>/bugs/sc-<id>.md, …
Covered bugs: sc-<id>: covered by sc-<first id>, or "none"
Documentation report: <run dir>/05-docs.md, or "none" (its Bugs table lists the cases to rerun for each bug)
Documentation worktree: <worktree directory>
UI tool: shared-browser | mobile-device <device ID>
Test users: <settings file path>, key test_users
Report to write: <run dir>/06-qa.md
Screenshots directory: <run dir>/qa/
```

## Step 10. Findings of the retest

Take the findings from the final message of `task-qa`. If the verdict is `PASS`, continue to Step 11.

1. **`BUG` findings** (the fix is wrong or broke something next to it). Resume the `task-bugfixer` of that bug: "Fix finding `<ID>` in `<run dir>/06-qa.md`." Then a new `task-reviewer` in `fix-verification` mode, appending to the bug's review file, with the fix loop of Step 7d. Commit as in Step 7e.
2. **`DOC` findings** (a test case or a statement of the feature document is wrong). For these, and when a fix of point 1 changed documented behaviour, launch a new `task-docs` with `Mode: sync`, `effort: high`, the paths of Step 9a, the path of `06-qa.md` and the finding IDs. Commit its changes.
3. **`OUT` findings** (a defect that existed before the fix, or a cause in the backend). They do not start a fix round. Record them as open items and show them at the PR gate; the person decides whether each becomes a new story.
4. **Retest.** After points 1 and 2, launch a new `task-qa` with `Mode: retest`, `effort: high`, the same paths, and the items to rerun: the ones that failed, the cases the documentation writer just corrected, and the cases of a bug whose fix changed.

After two fix rounds that still end in `FAIL`, ask the person: another round, accept with the remaining findings as open items, or stop. `BLOCKED` items do not start a fix round; they are reported at the PR gate.

## Step 11. PR gate and review bot

Skip this step when `gh` is not available, and list the manual steps in the summary.

**Gate.** State plainly anything that is not clean: a bug accepted with open review findings, a retest skipped or accepted with findings, `OUT` findings, `BLOCKED` items, pending screenshots. For every worktree with commits show the commits (`git -C <worktree> log --oneline origin/<base>..HEAD`), the size (`git -C <worktree> diff --stat origin/<base>..HEAD | tail -1`, with a warning above 150 changed files, which the review bot does not review), the pull request title and description, and the target branch.

- The title names the epic's feature and that these are bug fixes. The description lists every fixed bug as `sc-<id>` with one line on the fix, how it was tested, and a link to the documentation pull request.
- Mention with the `sc-<id>` form only the bugs fixed in this run. The Shortcut integration links a pull request to every story mentioned that way and moves its state, so any other story is named without the prefix and without a link.

Ask: `yes / no / edit`.

- **`yes`** → for each worktree, documentation first:

  ```bash
  git -C <worktree> push -u origin <branch>
  cd <worktree> && gh pr create --base <base> --head <branch> --title "<title>" --body-file <file>
  ```

  Record the pull request URLs in `state.md` and at the top of `07-pr.md`.
- **`edit`** → change the title or description and show the gate again.
- **`no`** → skip to Step 12 and list the manual steps there.
- Anything else is a comment on the gate, not consent.

**Review bot (CodeRabbit).** For each pull request:

1. **Wait.** Start a background shell loop that checks the pull request once a minute for up to 15 minutes (`gh pr view <number> --json reviews,comments`) and exits when the bot has submitted a review newer than your last push, or has commented that it found nothing or hit a rate limit. Do not poll from the conversation. No bot activity: post one comment `@coderabbitai review` and wait once more; still nothing: note it and move on. A rate limit notice: tell the person and wait for their decision.
2. **Collect.** Fetch the unresolved review threads (GraphQL `reviewThreads` with `isResolved`, path, line, bodies) and the actionable remarks of the review body. Write them verbatim into `07-pr.md` under `## Round <n>`, each with an ID `C<n>.<k>`. Nothing actionable: this pull request is done.
3. **Triage.** Launch a new `task-reviewer` with `Mode: pr-triage, round <n>`, the path of `07-pr.md`, the context file, the `bugs/` directory and the worktrees.
4. **Act.** `ask-user` items go to the person. `fix` items in a code repository are handled bug by bug, one after another as in Step 7: resume the `task-bugfixer` of the bug whose commit the comment is about ("Fix the comments marked `fix` for your bug in the triage of round `<n>` in `<run dir>/07-pr.md`", with the commits made since its last turn, as in Step 7b), or launch a new one with `Stage: fix` and that line when the resume fails; then resume this round's reviewer in `fix-verification` mode, appending the round to `<run dir>/bugs/sc-<id>.review.md`; then commit that bug's changes as in Step 7e, without pushing. `fix` items in the documentation pull request go to a new `task-docs` with `Mode: sync`, `effort: high`, the paths of Step 9a and the triage section. If a code fix changed behaviour, rerun the affected items with a new `task-qa` in `retest` mode and update the documentation the same way.
5. **Push once.** One commit per bug, and one push per repository for the whole round: every push starts another bot review and uses its quota. Reply in every thread with `gh api`: "Fixed in `<short sha>`: <what changed>" for fixed comments, the reviewer's drafted reply for the others. Resolve the threads you fixed (GraphQL `resolveReviewThread`); leave declined ones open. Answer remarks of the review body in one comment that mentions `@coderabbitai`. Record everything in `07-pr.md`, then wait for the next pass.

After three rounds on one pull request, ask the person whether to continue, stop with the remaining comments as open items, or handle them personally.

## Step 12. Summary and Shortcut comments

Stop any development server you started. Set the stage in `state.md` to `done`. Report, in the person's language:

- every bug: fixed, skipped or not fixable here, with the reason and the commit;
- the pull requests, with links;
- the documentation and test cases that changed, and the retest result per bug;
- open items: findings accepted or deferred, `OUT` findings, `BLOCKED` retest items, backend bugs left out, pending screenshots;
- the worktree directories and branches.

**Comments.** Draft one comment per fixed bug, two to four lines in English: what was wrong, that it is fixed, the pull request, and the test case that now covers it. Number the drafts, show them all, and ask: `yes / no / edit <N>`.

- **`yes`** → post each draft with `create_story_comment` on its bug story.
- **`edit <N>`** → change that draft as asked, show it again, ask again.
- **`no`**, or anything that is not an explicit yes → post nothing.

---

## Templates

### `state.md`

Update it after every stage change, every agent launch and every commit.

```markdown
# State: epic-<id> bugfix-<n>

- Epic: <title>, <URL>
- Stage: bugs | context | worktrees | diagnosis | gate | fix | docs | qa | findings | pr-gate | pr-review | done | cancelled
- Diagnosis: approved <date and time> | not approved

## Bugs
| Story | Title | Repository | Fixer agent ID | In Development | Status (diagnosing | diagnosed | skipped | not fixable here | covered by sc-<id> | fixing | fixed) | Review rounds | Commit |

## Other agents
<one row per instance of the reviewer, the documentation writer and QA>
| Role | Agent ID | Used for |

## Repositories
| Repository | Main checkout | Base | Worktree | Branch | Pull request |

## Applications
| Application | URL | Started by the orchestrator (yes | no) |

## Rounds
Retest fix rounds: 0 · Bot rounds per pull request: 0

## Log
- <date and time> <event>
```

### `01-context.md`

```markdown
# Bug-fix context: epic-<id> bugfix-<n>

- Epic: <id>, <title>, <URL> (not read in full; the feature documentation below is the reference)
- Collected: <date and time>

## User instructions
<the extra instructions from the command line, verbatim, or "None">

## Bugs
<one section per chosen bug>
### sc-<id>: <title>
- Story: <URL> · state: <state> · layer and project: <first guess>
- Environment: <where it was found: build, company, user role, browser>

#### Steps to reproduce
<verbatim>

#### Actual and expected behaviour
<verbatim>

#### Comments
<decisions and details from comments, with author and date, or "None">

## Bugs left out
| Story | Title | Why (backend, completed, not chosen) |

## Feature documentation
- Documentation repository: <main checkout> · worktree: <worktree directory>
- Feature document: <path relative to the repository, and its other language versions>
- Test cases: <path relative to the repository, and its other language versions>

## Attachments and links
| Bug | Item | Local path or URL | What it contains |

## Repositories
| Repository | Role | Main checkout | Base ref | Worktree | Rules path |

## Environment
- Test users: <settings file path>, key `test_users` (values are never copied here)

| Application | URL | API it talks to | Known constraints |

- Test data notes: <paths of notes and documents that describe test data for this feature, or "None">
- Read-only data access: <a script or connector for looking at staging data, or "None">

## Clarifications
<questions asked during the run and the person's answers, appended as they happen>
```
