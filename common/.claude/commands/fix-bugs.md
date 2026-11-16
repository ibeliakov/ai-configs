---
description: Fix the open bugs of a Shortcut epic in one run (diagnose, fix with a regression test, update the documentation and test cases, retest in the browser, pull request)
argument-hint: <epic ID or URL> [bug story IDs] [extra instructions]
disable-model-invocation: true
---

# Fix bugs

Takes a batch of bug stories from one Shortcut epic through a short pipeline:

choose bugs → context → diagnosis → **diagnosis gate** → worktrees → fix and review, bug by bug → documentation and test cases → browser retest → **PR gate** → review bot → summary

**Usage:** `/fix-bugs <epic ID | epic URL> [bug story IDs] [extra instructions]`

**Arguments:** $ARGUMENTS

You are the orchestrator and you run in the main session. You read Shortcut, talk to the person, create worktrees, commit, push and open pull requests. The work is done by the same five subagents `/implement` uses, each with its own context and a pinned model:

| Agent | Job in this command | Writes |
|---|---|---|
| `task-planner` | diagnoses every bug, plans its fix | `02-plan.md`, `02-plan/phase-<n>.md` |
| `task-implementer` | regression test and fix for one bug | code in worktrees, `03-implementation/phase-<n>.md` |
| `task-reviewer` | reviews the diff of one bug, triages bot comments | `04-review/phase-<n>.md`, triage in `07-pr.md` |
| `task-docs` | corrects the feature document and the test cases | documentation worktree, `05-docs.md` |
| `task-qa` | retests the fixed bugs in the running application | `06-qa.md` |

A bug is small, so this command is lighter than `/implement`: the epic is not read in full, the feature's existing documentation is the reference for what the behaviour should be, and each stage touches only what a bug affects.

---

## Rules that hold in every step

1. **Launching agents.** Call the Agent tool with `subagent_type` set to one of the five names above. Do not pass `model`, `effort` or `isolation`: they are pinned in each agent's file. Do not use any other agent type or a fork, and do not do an agent's job yourself. If an agent cannot be launched, stop and tell the person.
2. **State travels through files.** Give agents absolute paths. Never paste or paraphrase one agent's result into another agent's prompt: point to the file.
3. **Agents run in the background.** After you launch or resume one, end your turn with one line saying what is running. Continue when its completion notification arrives. Never predict or act on a result you have not received.
4. **One agent, one unit of work.** An agent reads its whole history again on every turn, so keep histories short. The planner is one instance, resumed through the rounds of the diagnosis gate. The implementer and the reviewer are launched anew for every bug phase and resumed only inside it (answers to their questions, the fix loop); each QA fix round and each review bot round gets new instances. `task-docs` and `task-qa` are one instance each, resumed for `sync` and `retest`. Record every agent ID in `state.md`; if a resume fails, launch a new instance and point it to the files with the earlier work.
5. **Open questions belong to the person.** When an agent returns `status: open-questions`, ask with AskUserQuestion: at most four questions per call, the agent's recommended option first and labelled as the agent's recommendation. Never answer one yourself. Append question and answer to `01-context.md` under `## Clarifications`, then resume the same agent.
6. **Nothing is fixed before the diagnosis is approved.** Until the person writes `approve` there are no worktrees, no code edits and no commits.
7. **Git.** Only you commit, only inside task worktrees, only after the approval. Push and open pull requests only after `yes` at the PR gate. Never merge, never force-push, never rewrite history, never change a main checkout.
8. **Shortcut.** Read freely (MCP tools, REST API with GET). Writes allowed: moving a bug story to In Development when its phase starts (automatic), and the comments the person approved in Step 12. Nothing else.
9. **Credentials.** Local and staging applications are entered with the test users from local settings. External systems are entered by the person. Production is never entered or tested. Credential values never go into any file.
10. **Language.** Files, prompts and artifacts are in English. Talk to the person in the language they use.
11. **A stopped agent.** If an agent reached its turn limit, resume it with "Continue from where you stopped." If it returns `status: blocked`, resolve what it needs with the person and resume it.
12. **Other commands' files.** `.tasks/epic-<id>/readiness/` belongs to `/epic-readiness` and the numbered files directly in `.tasks/epic-<id>/` belong to `/implement`. Never write, move or delete them.
13. **Keep your own context small.** Each of your turns reads this whole conversation again. Do not read plans, phase files, reports or source files in full: use the agents' final messages, `state.md`, or a targeted search for one section or table. Keep command output short.

---

## Step 0. Parse the arguments

- The first token is the epic: a URL containing `/epic/<id>` or a bare number (check with `get_epic`). If it is a story, say that this command works on an epic, name the story's epic and ask whether to run on it.
- Further numeric tokens, `sc-<id>` tokens or story URLs are the bugs to fix. Everything after them is the person's extra instructions.
- Nothing → ask for the epic and wait.

The run directory is `.tasks/epic-<id>/bugfix-<n>/` inside the directory this session was started in, where `<n>` is the next free number. Resolve it to an absolute path once. All paths below are inside it.

## Step 1. Preflight

Stop at the first failure that blocks the run.

1. **Shortcut MCP.** The `mcp__shortcut__*` tools are available. If not, tell the person to run the setup script, restart Claude Code, check `/mcp`, complete the OAuth login, and stop.
2. **Not plan mode.** Subagents would be forced into plan mode and could not write. Ask the person to leave plan mode and run the command again.
3. **A fresh session.** Because of rule 13, this command has to start in a session with little history. If this conversation already holds substantial earlier work, stop and ask the person to start a new session, or to run `/clear`, and start the command again. Everything the command needs is in files.
4. **Agents installed.** The five `task-*` agent types are available. If not, tell the person to run the setup script and restart Claude Code, and stop.
5. **GitHub CLI.** Run `gh auth status`. If it fails, warn that Step 11 will be skipped and the pull requests will have to be opened by hand, then continue.
6. **Unfinished run.** If an earlier `bugfix-<n>/state.md` of this epic has a stage other than `done` or `cancelled`, ask with AskUserQuestion whether to continue that run or start a new one. On continue, use that directory and jump to its stage; agents of the earlier session are launched anew (rule 4).

## Step 2. Choose the bugs

List the epic's stories with `list_epic_stories` (`limit: 100`, follow the cursor; fields: id, name, story type, workflow state, owners, parent story). Keep the stories of type `bug` that are not completed.

For each one, make a first guess of its layer from the title and description: frontend (and which project), backend, or unclear. Do not trust a label or a team alone.

- **Bugs were given in the arguments** → use exactly those. If one of them is completed, is not in this epic or looks like a backend bug, say so and ask whether to keep it.
- **Otherwise** → print a numbered list (number, ID, title, state, owner, layer), frontend bugs first, then the ones left out as backend, and ask the person which to fix. Accept numbers, IDs or `all` as a plain message. An option dialog cannot hold the list, so this one question is asked in text.

Backend bugs are not fixed by this command unless the extra instructions say so. They are named in the summary.

## Step 3. Collect the context

You do this yourself, in the main session, and you keep it light.

**The bugs.** Read every chosen bug in full: `get_story` and `list_story_comments` for the description, the steps to reproduce, expected and actual behaviour, environment details, comments. Attached files come from the REST API:

```bash
curl -s -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/<id>
```

Take `.files[]`, download each with the same header into `attachments/` and read it. On Windows use `$env:SHORTCUT_API_TOKEN`. Never print the token. For a recorded video, look for a transcript first; otherwise open the video page through Playwright and read the transcript there. If a site asks for a login, ask the person to log in in the Playwright browser and wait. If something cannot be read, say so and ask for the content.

**The epic** is not read in full. Take its title and link, nothing more.

**The feature documentation** is the reference for how the feature should behave.

1. Find the workspace project map (a `CLAUDE.md` in the session directory or its parent) and take the documentation repository from it.
2. Run `git -C <docs repo> fetch origin` and search the repository for the feature document and the test case file of this epic: by the epic ID, the IDs of its stories, and the feature name. Test case files usually name their epic and stories in the header.
3. Record the paths of the feature document, the test case file and their other language versions. Do not read them: the agents do.
4. Nothing found, or several candidates → ask the person which documents apply, or whether the feature is undocumented. Without documentation the run still works: the bug stories are then the only reference, and Step 9 writes test cases for the fixed bugs only if the person wants a new document.

If `.tasks/epic-<id>/readiness/` exists, record its path as optional background for the planner.

**Ambiguity.** If a bug's expected behaviour is unclear, or two bugs contradict each other, ask with AskUserQuestion now.

**Repositories.**

1. From the project map and the bugs' layers, decide which repositories will change: the frontend projects of the chosen bugs, and the documentation repository.
2. For every one, run `git -C <repo> fetch origin --prune` and ask the person for the base branch with AskUserQuestion, offering the integration branches found in `git -C <repo> branch -r`. Ask for all repositories in one call.
3. The code read path for the planner is a checkout whose `HEAD` equals `origin/<base>` (the main checkout or one of `git -C <repo> worktree list --porcelain`). If there is none, it is the ref `origin/<base>` itself.
4. The rules path is the main checkout: `<repo>/CLAUDE.md` and `<repo>/.claude/rules/`.

**Write the files.** Create `01-context.md` and `state.md` from the templates at the end of this file.

## Step 4. Diagnose

Launch `task-planner`:

```text
Mode: bug-fix
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md
Plan overview to write: <run dir>/02-plan.md
Phase files to write: <run dir>/02-plan/phase-<n>.md

Diagnose every bug listed in the context file and plan its fix.
```

Record the agent ID. When it finishes:

- `open-questions` → rule 5, then resume the same planner.
- `done` → check that the overview has `## Repositories and worktrees`, `## Phases` and `## Tests`, and that `02-plan/` holds one file for every phase of the table. Then go to the gate.

## Step 5. Diagnosis gate (mandatory)

Show the person, taken from the overview and the planner's final message:

- for every bug: its ID and title, the root cause in one or two sentences, what the fix changes, the regression test, and the documentation and test cases it affects;
- bugs the planner did not plan (backend, not a bug, cannot be diagnosed from the code), each with the reason;
- the absolute paths of `02-plan.md` and `02-plan/`;
- the repositories and worktrees table;
- from the `Tests` section: anything listed under `Not covered`;
- this notice: writing `approve` also allows local commits in the task worktrees; nothing is pushed until the PR gate.

Then stop and wait.

- **`approve`** (also `approved`) → take the repositories table and the phase table again from disk, record the approval in `state.md`, continue to Step 6.
- **`skip <ID>`** → drop that bug from the run, record it in `state.md`, show the gate again.
- **A bare "ok", "yes", "так" or similar** → ask the person to write `approve`.
- **`cancel`** → record the stage as cancelled and stop.
- **Anything else** is feedback. Resume the same planner: "Reviewer feedback on the diagnosis, verbatim: `<message>`. Read the plan files from disk first, update the ones the feedback touches, bump the revision." Then return to the start of this step.

## Step 6. Create the worktrees

For every row of the approved `Repositories and worktrees` table:

```bash
git -C <main checkout> fetch origin <base>
git -C <main checkout> worktree add --no-track -b <branch> <worktree directory> origin/<base>
```

- The worktree directory is `<main checkout>-<epic id>-bugs` and the branch `epic-<epic id>/bugfix-<n>`, unless the plan says otherwise. Reuse an existing directory only when it is on the planned branch; otherwise ask.
- Install dependencies when the repository has a lockfile: `npm ci` for `package-lock.json`, `yarn install --frozen-lockfile` for `yarn.lock`. Run long installs in the background.
- Copy untracked environment files (`.env`, `.env.*`) from the root of the main checkout. Do not print their contents.
- If an install fails, show the error and ask the person how to proceed.

Record the worktrees in `state.md`.

## Step 7. Fix and review, bug by bug

A phase is one bug, or several bugs that share one root cause. For each phase, in the order of the plan:

**a. In Development.** Move every bug story of the phase to In Development: find the state with that name in the story's own workflow and call `update_story`. Do not move a story that is already in that state or a later one, and never move one backwards. If the write is refused, say so and continue.

**b. Fix.** Launch a new `task-implementer`:

```text
Task key: epic-<id> bugfix-<n>
Bug phase to implement: <n> <title> (<bug story IDs>)
Context file: <run dir>/01-context.md
Plan overview: <run dir>/02-plan.md
Phase file: <run dir>/02-plan/phase-<n>.md
Report to write: <run dir>/03-implementation/phase-<n>.md
Worktrees you may edit:
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
Test users: <settings file path>, key test_users
```

**c. Review.** Launch a new `task-reviewer`:

```text
Mode: phase-review, phase <n>, round 1
Context file: <run dir>/01-context.md
Plan overview: <run dir>/02-plan.md
Phase file: <run dir>/02-plan/phase-<n>.md
Implementation report: <run dir>/03-implementation/phase-<n>.md
Review file to write: <run dir>/04-review/phase-<n>.md
Worktrees with the changes (this phase is everything not yet committed; earlier phases are committed):
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

**d. Fix loop.** On `CHANGES REQUESTED`, resume this phase's implementer with the path of the review file, then this phase's reviewer in `fix-verification` mode. If the implementer declined a finding and the reviewer kept it, put both positions to the person. After two fix rounds that still end in `CHANGES REQUESTED`, ask the person: another round, accept as it is (the findings go into the open items), or stop.

**e. Commit.** On `APPROVED`, in every worktree the phase changed:

1. Stage exactly the files in the `Changes` table of this phase's report: `git -C <worktree> add -- <paths>`. Take the table with a targeted read.
2. Run `git -C <worktree> status --short`. If other changes remain, resume this phase's implementer to account for them. Never stage `.env` files, credentials or anything from the run directory.
3. Commit in the format of `commit.md`: `<bug story ID>: <description>`, imperative, in English, at most 200 characters, no trailing period, no trailer lines. For a phase with several bugs use the first ID as the task number and name the others in the description without the `sc-` prefix.
4. Record the commit hash in `state.md`.

## Step 8. The application for the retest

Ask with AskUserQuestion how the application will be available, for each application that was changed:

- **Start it from the worktree.** Read the project's `CLAUDE.md` for the development command, start it from the worktree in the background on a free port and wait until the URL responds. You stop it again in Step 12.
- **It is already running.** The person gives the URL.
- **No application.** The documentation is corrected without new screenshots and the browser retest is skipped; both facts go into the summary.

The URL must be a local or staging address; if you cannot tell, ask. Test users come from the `test_users` key of `.claude/settings.local.json` in the session directory, or in the target project if the session directory has none. Give agents the path of the settings file, never the values. If none are configured, ask the person for credentials and keep them in the conversation only.

## Step 9. Documentation and test cases

Skip this step, and say so in the summary, when the workspace has no documentation repository or the person said in Step 3 that the feature stays undocumented.

Launch `task-docs`:

```text
Mode: bugfix
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md
Plan overview: <run dir>/02-plan.md
Phase files, one per bug: <run dir>/02-plan/
Implementation reports: <run dir>/03-implementation/
Documentation worktree: <worktree directory>
Code worktrees (read only):
- <repo>: <worktree directory>
Report to write: <run dir>/05-docs.md
Application URL: <url, or "not available">
Test users: <settings file path>, key test_users
```

When it finishes, commit in the documentation worktree exactly the files listed in the `Documents` table of `05-docs.md`, with the epic ID as the task number.

## Step 10. Retest in the browser

Skip this step when no application is available.

Launch `task-qa`:

```text
Mode: bugfix
Task key: epic-<id> bugfix-<n>
Context file: <run dir>/01-context.md
Plan overview: <run dir>/02-plan.md
Phase files, one per bug: <run dir>/02-plan/
Implementation reports: <run dir>/03-implementation/
Documentation report: <run dir>/05-docs.md
Documentation worktree: <worktree directory>
Application URL: <url>
Test users: <settings file path>, key test_users
Report to write: <run dir>/06-qa.md
Screenshots directory: <run dir>/qa/
```

If the verdict is `PASS`, continue to Step 11. If there are findings, run a fix round:

1. **`BUG` findings.** Launch a new `task-implementer`: "Fix the `BUG` findings of round `<r>` in `<run dir>/06-qa.md`. Report to write: `<run dir>/03-implementation/qa-round-<r>.md`." Give it the context file, the plan overview and the worktrees. Then launch a new `task-reviewer` in `fix-verification` mode, writing `<run dir>/04-review/qa-round-<r>.md`, with the fix loop of Step 7d. Commit the approved fixes as in Step 7e.
2. **Documentation.** If there are `DOC` findings, or a fix changed documented behaviour, resume `task-docs` in `sync` mode with `06-qa.md` and the report of the fix round. Commit its changes.
3. **Retest.** Resume the same `task-qa` in `retest` mode with the failed items and the items next to the changed code.

After two fix rounds that still end in `FAIL`, ask the person: another round, accept with the remaining findings as open items, or stop. `BLOCKED` items do not start a fix round; they are reported at the PR gate.

## Step 11. PR gate and review bot

Skip this step when `gh` is not available, and list the manual steps in the summary.

**Gate.** State plainly anything that is not clean: a phase accepted with open review findings, a retest skipped or accepted with findings, `BLOCKED` items, pending screenshots. For every worktree with commits show the commits (`git -C <worktree> log --oneline origin/<base>..HEAD`), the size (`git -C <worktree> diff --stat origin/<base>..HEAD`, with a warning above 150 changed files, which the review bot does not review), the pull request title and description, and the target branch.

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
3. **Triage.** Launch a new `task-reviewer` with `Mode: pr-triage, round <n>`, the path of `07-pr.md`, the context file, the plan overview and the worktrees.
4. **Act.** `ask-user` items go to the person. For `fix` items launch a new `task-implementer` (report `03-implementation/pr-round-<n>.md`), then resume this round's reviewer in `fix-verification` mode (`04-review/pr-round-<n>.md`). If a fix changed behaviour, rerun the affected items with `task-qa` in `retest` mode and update the documentation with `task-docs` in `sync` mode.
5. **Push once.** One commit per repository for the whole round, one push. Reply in every thread with `gh api`: "Fixed in `<short sha>`: <what changed>" for fixed comments, the reviewer's drafted reply for the others. Resolve the threads you fixed (GraphQL `resolveReviewThread`); leave declined ones open. Answer remarks of the review body in one comment that mentions `@coderabbitai`. Record everything in `07-pr.md`, then wait for the next pass.

After three rounds on one pull request, ask the person whether to continue, stop with the remaining comments as open items, or handle them personally.

## Step 12. Summary and Shortcut comments

Stop any development server you started. Set the stage in `state.md` to `done`. Report, in the person's language:

- every bug: fixed, skipped or not fixable here, with the reason and the commit;
- the pull requests, with links;
- the documentation and test cases that changed, and the retest result per bug;
- open items: findings accepted or deferred, `BLOCKED` retest items, backend bugs left out, pending screenshots;
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
- Stage: bugs | context | diagnosis | gate | worktrees | phase <n> fix | phase <n> review | docs | qa | pr-gate | pr-review | done | cancelled
- Diagnosis: revision <n>, approved <date and time> | not approved
- Application: <URL> (started by the orchestrator: yes | no) | not available

## Bugs
| Story | Title | Layer and project | Phase | In Development | Status (planned | skipped | not fixable here | fixed) | Commit |

## Agents
<one row per instance>
| Role | Agent ID | Used for |

## Repositories
| Repository | Main checkout | Base | Worktree | Branch | Pull request |

## Rounds
QA fix rounds: 0 · Bot rounds per pull request: 0

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
- Documentation repository: <main checkout>
- Feature document: <path, and its other language versions>
- Test cases: <path, and its other language versions>
- Epic analysis: <path of readiness/, or "none"> (optional background)

## Attachments and links
| Bug | Item | Local path or URL | What it contains |

## Repositories
| Repository | Role | Main checkout | Base ref | Code read path | Rules path |

## Environment
- Test users: <settings file path>, key `test_users` (values are never copied here)
- Known application URLs: <local and staging addresses from the project documentation>

## Clarifications
<questions asked during the run and the person's answers, appended as they happen>
```
