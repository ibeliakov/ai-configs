---
description: Run a Shortcut story or epic through the task pipeline (plan, implement in parallel parts, review, document, QA, pull request)
argument-hint: <story or epic ID or URL> [extra instructions]
disable-model-invocation: true
---

# Implement

Takes a Shortcut story or epic through a multi-agent pipeline:

context → plan in plan mode → **plan approval** → worktrees and application → parts built in waves (implement, check, commit, review) → documentation and QA → **PR gate** → review bot → summary

**Usage:** `/implement <story ID | epic ID | story URL | epic URL> [extra instructions]`

**Arguments:** $ARGUMENTS

You are the planner and the orchestrator, and you run in the main session. You read Shortcut, plan the work, talk to the person, create worktrees, schedule the agents, commit, push and open pull requests. You know the plan because you wrote it. The code is read and written by agents, each with its own context:

| Agent | Job | Writes |
|---|---|---|
| `Explore`, `Plan` (built in, read only) | research the code while you plan | nothing: their findings come back in their final message |
| `task-implementer` | builds one part and proves it works (tests, UI check), fixes findings | code in worktrees, `03-implementation/part-<n>.md` |
| `task-reviewer` | reviews the commit of a part, verifies fixes, reviews a wave across its parts, triages bot comments | `04-review/part-<n>.md`, `04-review/wave-<w>.md`, triage in `07-pr.md` |
| `task-docs` | documents the feature, writes test cases | documentation worktree, `05-docs.md` |
| `task-qa` | tests the running application | `06-qa.md` |

Models: `task-reviewer` runs on Fable at `high` effort, pinned in its file. Everything else runs on Opus at `xhigh`: the three other `task-*` agents by their files, you and the research agents by the session (Step 1).

---

## Rules that hold in every step

1. **Launching agents.** Call the Agent tool with `subagent_type` set to one of the four `task-*` names above, or, while you plan, to `Explore` or `Plan`. Do not pass `model`, `effort` or `isolation` to a `task-*` agent: the model and effort are pinned in each agent's file and a parameter would override them. Launch `Explore` with `model: "opus"`; `Plan` inherits the session. Do not use any other agent type or a fork, and do not do an agent's job yourself. If an agent cannot be launched, stop and tell the person.
2. **State travels through files.** Every `task-*` agent reads and writes files in the task directory. Give agents absolute paths. Never paste or paraphrase one agent's result into another agent's prompt: point to the file. The only text of your own in a prompt is the live notes of rule 14.
3. **Agents run in the background.** After you launch or resume one, end your turn with one line saying what is running. Continue when a completion notification arrives, and do everything that has become possible in that one turn: commit, launch the reviewer, launch the parts that can start, update `state.md`. Never predict, summarise or act on a result you have not received.
4. **One agent, one unit of work.** An agent reads its whole history again on every turn it takes, so a long-lived agent gets more expensive with every step. Keep histories short:
   - the implementer and the reviewer are launched anew for every part, and resumed only inside that part (answers to their questions, the fix loop, the turn with the UI tool). A wave fix, a QA fix round and a review bot round also get new instances;
   - `task-docs` and `task-qa` are resumed only for answers to their questions. A `sync`, a `cases` run or a `retest` is a new instance that reads the earlier report;
   - never run two instances of `task-docs`, or two of `task-qa`, at the same time;
   - an agent that returns `status: partial` has handed its work over on purpose: launch a new instance of the same type with the same prompt and the added line "Continue from the report: `<path>`". It is not resumed;
   - an agent that stopped at its turn limit has not written its report yet. Resume it once with: "Do not continue the work. Write your report now with `Status: partial` and what remains, then stop." Then launch a new instance as above. The reviewer has no hand-over: resume it with "Continue from where you stopped."

   Record every agent ID in `state.md` as soon as you get it, and resume with SendMessage and that ID. An agent of an earlier session cannot be resumed: launch a new instance and point it to the files that hold the earlier work.
5. **Questions.** While you plan, you ask the person yourself. When an agent returns `status: open-questions`:
   - a question the approved plan already answers, you answer from the plan: find the card or the decision with a targeted search and quote it when you resume the agent;
   - anything that needs a new decision (behaviour, scope, cost, risk, a choice between approaches) goes to the person with AskUserQuestion: at most four questions per call, the options as choices, the recommended option first and labelled as a recommendation. Never decide such a question yourself.

   Append each question and answer to `01-context.md` under `## Clarifications`, then resume the same agent with the answers.
6. **Nothing is built before the plan is approved.** Until the person approves the plan there are no worktrees, no code edits and no commits. Plan mode enforces this while you plan.
7. **Git.** Only you commit, only inside task worktrees, only after the plan is approved, and always by the project's commit command (Step 7, "Commits"). Agents never run a git command that writes. Push and open pull requests only after `yes` at the PR gate. Never merge, never force-push, never rewrite history, never change a main checkout.
8. **Shortcut.** Read freely through the Shortcut MCP tools and the REST API (GET only). Exactly two writes are allowed: moving a story to In Development (automatic, Steps 2 and 7) and one final comment after an explicit `yes` (Step 13). Nothing else, ever.
9. **Credentials.** Local and staging applications are entered with the test users from local settings. External systems are entered by the person, never by you or an agent. Production is never entered or tested. Credential values never go into any file.
10. **Language.** Files, prompts and artifacts are in English, with one exception: the part of the plan that is written for the person (Step 3) is in the language the person uses. Talk to the person in that language too.
11. **A blocked agent.** If an agent returns `status: blocked`, show the person what it needs, resolve it with them, and resume the same agent. A block that names an environment problem is yours: fix the environment (Step 6), update `Environment` in the context file, and resume the agent, or launch a new instance when it is `task-qa`. An agent that reached its turn limit is handled as rule 4 says.
12. **The epic analysis is not yours.** `.tasks/epic-<id>/readiness/` is written by `/epic-readiness`. Read it and give its paths to agents. Never write, move or delete anything inside it.
13. **Keep your own context small.** You take a hundred or more turns in a run and each one reads this whole conversation again, so your context is the most expensive one in the pipeline.
    - While you plan: the requirements you read yourself; the code is read by research agents, and you open only the ranges a decision depends on.
    - While you build: do not read reports, reviews or source files in full. Take what you need from an agent's final message and from `state.md`, or fetch one section or one table with a targeted search. Do not reread the plan either: open a card only to answer a question about it.
    - Keep the output of your commands short, and filter an API response before it reaches the conversation. Load the deferred tools you will need (the Shortcut tools, `SendMessage`, `TaskStop`, `EnterPlanMode`, `ExitPlanMode`) in one ToolSearch call at the start, not one by one.
    - Measure instead of guessing: `node "$AI_CONFIGS_DIR/scripts/session-context.mjs"` prints the size of your context. Run it after the plan is approved and at the end of every wave. Above about 150K tokens after the approval, or about 200K at the end of a wave, tell the person that the run is cheaper to continue in a new session (`/clear`, then `/implement` with the same ID: everything it needs is in files) and ask with AskUserQuestion whether to continue here or stop for that. Offer it only while no agent is running. When the script prints `unknown`, judge by how much you have read.
14. **Live notes.** You may add up to five lines of your own to an agent's prompt, under `Notes from the orchestrator`: what an earlier part exported and where, a decision the person made after the plan was approved, a pitfall another agent reported. Facts with paths only, and nothing that contradicts the card.
15. **The UI tool has one user at a time.** The browser of the session (the `playwright` server) and the mobile device (the `mobile-mcp` server) are shared by every agent, and two agents using one of them at the same moment break each other's pages. Record the holder in `state.md` and give the tool to the next agent only after the holder has returned. A turn ends when its holder returns, with whatever status: every later message to that agent, and the prompt of an instance that continues its work, says again whether it has the tool. The one agent with a browser of its own is `task-docs` (Step 8).

---

## Step 0. Parse the arguments

The first token of the arguments identifies the task; everything after it is the person's extra instructions.

- URL containing `/story/<id>` → story. URL containing `/epic/<id>` → epic.
- `sc-<id>` → story.
- A bare number → call `get_story`; if no story has that ID, call `get_epic`.
- Nothing → ask for the ID or URL and wait.

The task key is `sc-<id>` for a story and `epic-<id>` for an epic. The task directory is `.tasks/<key>/` inside the directory this session was started in; resolve it to an absolute path once and use that path everywhere.

An epic's task directory can already hold `readiness/`, the output of `/epic-readiness`. That directory is not part of this command's run (rule 12).

## Step 1. Preflight

Check, in this order, and stop at the first failure that blocks the run:

1. **Shortcut MCP.** The `mcp__shortcut__*` tools are available. If not, tell the person to run the setup script for this project, restart Claude Code, check `/mcp`, complete the OAuth login, and stop.
2. **Not in plan mode yet.** This command writes files before it plans, and enters plan mode itself in Step 3. If the session is already in plan mode, ask the person to leave it and run the command again.
3. **A fresh session.** This command has to start in a session with little history, because of rule 13. If this conversation already holds substantial earlier work (a run of another command such as `/epic-readiness`, a long analysis, many files read), stop: ask the person to start a new session, or to run `/clear`, and start the command again. Nothing is lost, since everything this command needs is in files.
4. **Model.** You plan and orchestrate on the session's model, and the research agents inherit it: it should be Opus at `xhigh` effort. Check the model you are running on and the effort (`echo "$CLAUDE_EFFORT"`). If either differs, say so and ask with AskUserQuestion: the person switches and answers, or the run continues as it is.
5. **Agents and scripts installed.** The four `task-*` agent types are available, and `ls "$AI_CONFIGS_DIR/scripts/split-plan.mjs"` finds the script. If not, tell the person to run the setup script and restart Claude Code (a newly created `agents` directory is picked up only after a restart), and stop.
6. **GitHub CLI.** Run `gh auth status`. If it fails, warn now that Steps 10 and 11 will be skipped and the pull requests will have to be opened by hand, then continue.
7. **Existing run.** A run of this command exists only when `<task dir>/state.md` exists. A task directory that holds nothing but `readiness/` is an epic analysis, not a run: go on to Step 2. When `state.md` exists, read it and ask with AskUserQuestion whether to continue from the recorded stage or start over.
   - On continue, jump to that stage. Agents of the earlier session are not resumed (rule 4). A part that was being implemented or fixed is continued by a new implementer with "Continue from the report" when its report exists, and from its card otherwise, with a note that files of the part may already exist.
   - Stage `planning`: the plan was not approved. A draft may exist in the plans directory: `grep -l "implement-run: <key>" ~/.claude/plans/*.md`. Take what it holds and plan from Step 3.
   - A run in the older phase layout (`state.md` has a `Phases` table, `02-plan/` holds `phase-<n>.md` files or nothing) is not planned again. Run `node "$AI_CONFIGS_DIR/scripts/split-plan.mjs" --legacy <task dir>` once: it writes `02-plan/common.md` from the old overview. Each phase that remains is built as a part in a wave of its own, in the order of the old plan: its card is `02-plan/phase-<n>.md` (or its section of `02-plan.md`), and its report and review keep the `phase-<n>` names. Documentation and QA run one after the other (Step 8), with `02-plan.md` given wherever a prompt asks for a section file of the plan.
   - On start over, delete only this command's own files (`state.md`, `01-context.md`, `02-plan.md`, `02-plan/`, `03-implementation/`, `04-review/`, `05-docs.md`, `06-qa.md`, `07-pr.md`, `checks/`, `ui/`, `qa/`, and the single-file reports of an older run), keep `attachments/`, and leave `readiness/` untouched.

## Step 2. Collect the context

You do this yourself, in the main session. Look for an epic analysis first: it decides how much you have to collect.

### 2a. Look for the epic analysis

`/epic-readiness` leaves its results in `.tasks/epic-<epic id>/readiness/` in the session directory: the collected sources, code maps, a report with a verdict, and the person's decisions. The epic in question is the epic itself in an epic run, and the story's parent epic in a story run (read the story first to learn its epic). An analysis exists when `readiness/state.md` exists.

- **A story without an epic** → 2c.
- **An analysis exists** → 2b.
- **No analysis** → ask with AskUserQuestion:
  - *Run `/epic-readiness <epic id>` first* (recommended). Stop here and tell the person to run it and then start `/implement` again. Nothing has been written or moved yet.
  - *Collect the context here.* Continue with 2c.

### 2b. Use the epic analysis

Keep this step light. Read the small files now; the report in full, the specification and the contract are read in Step 3b, and the code maps go to the research agents by path.

**Read.** `readiness/state.md`, `readiness/clarifications.md`, `readiness/sources/index.md`, and from `readiness/README.md` the verdict, the state of the epic, the requirements matrix and the section on what can start now and what waits. List the directory and note the real file names, because they differ between runs (one frontend code map, or one per project). Do not read the specification, the code maps or the raw sources in this step.

**Bring it up to date.** The analysis is a snapshot. Read what changed since and record it under `Changes since the epic analysis` in the context file:

- Epic comments and replies newer than the last comment recorded in `state.md`, including replies in the threads of the comments the analysis posted. Copy each new comment verbatim with its ID, author and time.
- For the stories in scope, comments newer than the analysis. For every story of the epic, the current workflow state and owner. Stories added to the epic since.
- The API contract: after `git -C <docs repo> fetch origin`, compare its current version, date and last commit with `state.md`. If it changed, read the difference and summarise it; the contract review in the report predates the change.
- Repositories: the current commit of each analysed branch against the commit in `state.md`. The code maps describe the older commit.
- A source the analysis lists as not read or partly read: try it again only when it matters for the scope of this run.

If a new comment or a contract change contradicts the report or a decision in `clarifications.md`, treat it as an ambiguity (2d).

**Scope.** Take the scope from the verdict without asking:

- `yes` → everything the task covers.
- `partly` → only the areas the report lists as able to start now. Every area that waits goes under `Out of scope` with what it waits for and who owes the answer. The person sees this when approving the plan and can change it there.
- The person's decisions in `clarifications.md` apply on top, for example "start on mocks of the proposed contract" or "wait until the contract is agreed".
- An area that waited at the time of the analysis and has since been unblocked (an answer arrived, the contract was updated) is in scope again. Say so explicitly.
- If nothing in the task can start (verdict `no`, a decision to wait, or a story whose whole area waits), do not plan around it. Tell the person what blocks the start and ask whether to go ahead on fallbacks and mocks, narrow the task, or stop.

**Decisions and open questions.**

- Copy the rows of `clarifications.md` into `Clarifications` in the context file, marked as coming from the epic analysis. They are settled: do not ask them again.
- Questions the analysis already sent to the backend developer or the product manager (the `Posted comments` table in `state.md` and the drafts in `readiness/comments/`) go under `Questions already asked`, each with its status after the update: answered, with where, or still open. Nobody asks them again; you plan around the open ones.
- When `clarifications.md` or `state.md` records the branches the person chose for the analysis, use them as base branches in 2d without asking, and state them in the plan.

**What the analysis does not hold.**

- Story run: read the story itself from Shortcut as in 2c ("A story"); it is small and has to be current. Do not read the parent epic again. Take the sibling stories from the report, with their current states, and name the rows of the requirements matrix that this story covers.
- Epic run: choose the stories in scope by the rules of 2c ("An epic") from the story list of the analysis with current states. Do not read the stories again.
- Do not download a file that is already in `readiness/attachments/`.

**Context file.** Fill the `Epic analysis` section of the template. Under `Requirements` give the paths of the specification and the report instead of copying them. Under `Acceptance criteria` list the requirements in scope by their IDs from the matrix, each with its one-line statement.

### 2c. Full collection

Used when there is no epic analysis, or the person chose to collect here.

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

The epic is reference material. The scope of the run stays the story you were given: the sibling stories are never implemented, moved to another state or commented on. A disagreement between the story and its epic is an ambiguity to ask about, as described below.

**An epic.** Collect the epic's description, comments, linked documents and links, and the list of its stories. The epic is the specification: links in it to backend code and backend documentation are references for planning, to be read and not changed.

- The stories in scope are the **frontend** stories of the epic: title prefix `[Frontend]`, a frontend team, or a frontend label. Leave out stories that are already completed.
- Backend stories are left out unless the extra instructions explicitly ask for backend work.
- If any story cannot be classified, ask with AskUserQuestion (multiSelect) which of the unclear ones to include.
- Read every included story in full, as for a single story.
- Show the person the resulting list: included stories in order, and excluded ones with the reason.

**Linked material.**

- External links: open them with WebFetch, or with the Playwright MCP server when the page needs a browser.
- Videos (Loom, Fathom and similar): look for a transcript in the description and comments first. If there is none, open the video page through Playwright and read the transcript from the page.
- If an external system asks for a login, ask the person to log in in the browser window that Playwright opened and wait for them to confirm. Never type credentials into an external system.
- If something still cannot be read, do not skip it silently: tell the person what and why, and ask for the content as text or a screenshot.

### 2d. In every run

**In Development (story run).** Once 2a is settled and the run continues, move the story to In Development: find the state named "In Development" in the story's own workflow and call `update_story` with that state. Do not move a story that is already in In Development or in any later state, and never move a story backwards. If the state cannot be found or the write is refused, say so and continue; this never blocks the run. For an epic, each story is moved when its first part starts, in Step 7.

**Ambiguity.** If the requirements are unclear, incomplete or contradict each other (description against comments, story against epic, a newer comment against the epic analysis), ask with AskUserQuestion now. Do not carry a guess into the plan. Do not ask what the epic analysis already settled or already sent to someone else.

**Repositories.**

1. Find the workspace project map: a `CLAUDE.md` in the session directory or its parent that lists the projects and their roles. If the session directory is itself a single project, that project is the target.
2. Decide which repositories the task changes (frontend projects, and the documentation repository when the workspace has one) and which are read-only references (backend).
3. For every repository that will change, run `git -C <repo> fetch origin --prune` and ask the person for the base branch with AskUserQuestion, offering the integration branches found in `git -C <repo> branch -r` (for example `stage`, `beta-stage`, a current sprint branch, `main`). Ask for all repositories in one call. Skip the question for a repository whose branch the person already chose during the epic analysis (2b).

   In the same call ask how each application the task changes will be available for UI checks, documentation and QA, so that nothing stops the run between the plan approval and the PR gate: you start it from the worktree; the person runs it from the worktree (name the directory, `<main checkout>-<id>`, and ask for the URL, or for the mobile application the simulator or emulator it will be open on); or there is no application (UI checks and QA are skipped and documentation is written without screenshots; these facts go into the summary).
4. Find the code read path for planning: a checkout of that repository whose `HEAD` equals `origin/<base>` (check the main checkout and `git -C <repo> worktree list --porcelain`). If there is none, the read path is the ref `origin/<base>` itself.
5. The rules path is the main checkout: `<repo>/CLAUDE.md` and `<repo>/.claude/rules/`.

**The environment.** An agent that uses the application is cheap only when it does not have to discover its environment. Write down what is already known, from the project map, the projects' `CLAUDE.md` files and your memory notes: for each application its URL and port, which API it talks to (local, staging) and known constraints such as a port the staging API accepts requests from; and the paths of notes or documents that describe test data for this feature, without copying credentials.

**Write the files.** Create `01-context.md` and `state.md` from the templates at the end of this file.

## Step 3. Plan

You plan in plan mode: the harness then blocks every write except the plan file, and the person approves the plan in its own dialog.

**3a. Enter plan mode.** Set the stage in `state.md` to `planning`, then call `EnterPlanMode`. From here until the approval you can write one file only, the plan file whose path the harness gives you; `state.md` and the context file are updated in Step 4b. If the person declines plan mode, or the tool is not available, plan by the same rules without it: write the plan to `<task dir>/02-plan.md` and use the fallback gate of Step 4a.

**3b. The requirements are yours to read.** The context file is already in your conversation. When there is an epic analysis, read now what Step 2 left for this step: the report in full, the specification, the contract and the person's decisions, from the paths in the `Epic analysis` section. The report may be in the person's language.

- The analysis is a snapshot. `Changes since the epic analysis` is newer than anything in the report and wins where they differ. If the contract changed, check every point of the report that depends on it against the current contract.
- Plan only what `Scope from the verdict` lists as in scope now. An area that waits goes out of scope with what it waits for.
- `Questions already asked` are with the backend developer or the product manager. Do not ask them again: plan around each one that is still open, with the fallback the person's decisions allow, and record it as a backend dependency or a risk.
- With a `Parent epic` section, read it with the same care: the epic usually holds the specification the story only refers to. Plan only the story you were given; work that belongs to a sibling story is out of scope.

**3c. The code is read by research agents.** Launch up to three at a time, each with one area of questions (rule 1):

- `Explore` to locate and describe: where the feature lives; which components, helpers, slices, API clients and types exist to reuse; how the project writes its tests; what is already implemented.
- `Plan` when a question needs reasoning over the code: a flow traced end to end, what a change would break, which of two designs fits the existing code.

Give each agent the question, the code read path of the repository, the rules path with the instruction to read `CLAUDE.md` before any code, and the form of the answer: paths, symbols, what each gives, pitfalls, in at most about six hundred words and without file dumps.

- When the code read path is a git ref (for example `origin/stage`), the main checkout is on another branch and its files are the wrong revision. Tell the agent to read with `git -C <main checkout> show <ref>:<path>` and to search with `git -C <main checkout> grep -n <pattern> <ref> -- <pathspec>`.
- The code maps of an epic analysis are leads, not facts: they were made at an earlier commit. Give them to the agent by path and ask it to confirm every file and line it relies on.
- Backend code and backend documentation are read-only references for API contracts.

Read code yourself only where a decision depends on the exact text: the few ranges an agent points to. Read each project's `CLAUDE.md`, and from `.claude/rules/` the files for the kinds of code the task changes; a catalogue file (a long list of helpers or components) is searched for the names you need, not read from top to bottom. A plan that ignores the project's conventions is rejected in review.

**3d. Decide, and ask.**

- When the task is ambiguous, or two or more viable approaches differ in behaviour, scope, cost or risk, ask the person with AskUserQuestion before you write that part of the plan (rule 5). A detail with one sensible answer that follows from the project's conventions is not a question.
- Do not plan backend changes unless the user instructions ask for them. If the frontend needs an endpoint or a field that does not exist or is unclear, record it as a backend dependency with the endpoint and the JSON shape you expect, and plan the frontend so it degrades safely until the backend ships.
- If a repository has no test runner, do not skip its tests silently and do not plan a test setup on your own. Ask: set up testing as the first part, proceed without automated tests in that repository as a recorded exception, or stop.
- No placeholders: what you cannot decide from the context and the code is a question, not a "TBD" in the plan.

**3e. Cut the work into parts and waves.** A part is what one implementer builds, checks and hands over in one commit. A wave is a set of parts built at the same time in one worktree.

- **Size.** An implementer's cost grows faster than its work, so a part is sized to about forty tool calls: usually 3 to 10 changed files, tests included. Small neighbouring components go together, two or three to a part. Do not cut below what can be built, tested and reviewed on its own: a slice with its tests is a part, a single trivial file is not.
- **Ownership.** Every file that is created, changed or deleted belongs to exactly one part of its wave. Parts of one wave do not depend on each other and share no file. A file that several parts would touch (a registry, a barrel file, the routes, the locale strings) is given to one part, placed in an earlier or later wave.
- **Order.** A part goes into the first wave after the parts it depends on. When a part changes files of an earlier part, or builds on a contract that the review of that part may still change (a new public API, non-trivial logic), mark it `Starts after review of` that part; otherwise the next wave starts while the reviews of the previous one are still running.
- **Skeleton first.** Every part with a user interface has to be visible in the running application the moment it is built. If the page or screen does not exist yet, the first wave builds the skeleton: the types and the contract, the API client, and the page wired to its route with fixture data and placeholders. Later parts fill it in.
- **Contracts.** Parts of one wave are written at the same time by agents that do not see each other's code, so they never import from each other: what two of them need (a type, a shared helper, the slot a component is rendered into) belongs to an earlier wave, usually the skeleton. Whatever a part provides to later parts or takes from earlier ones (a type, the props of a component, a payload, a selector) is written down in the cards on both sides, with a snippet where the shape matters.
- **Tests.** All new and changed code is covered by automated tests, written with the project's own test runner and conventions. The coverage criterion: in a new file every line and every branch is covered; in a changed file every changed line is covered. Code that cannot reasonably be unit-tested (styles, static configuration, type-only files, generated code) goes under `Not covered` with the reason; keep that list honest and short.
- **Characterization first.** A refactoring or a library replacement starts with a part of its own, alone in the first wave: tests that pin down the current behaviour and pass on the code as it is today, with no production code changed. The later parts must keep those tests passing without changing their scenarios.
- **UI check.** A part that changes what the user sees gets a `UI check` in its card: the tool (browser for a web application, mobile for the mobile application), the route or screen and how to reach it, the role, the data (the live API, or mocks from a named fixture), and the states to look at. The implementer has about fifteen tool calls for it, so name the few things that matter. A part with nothing to look at says `none`.
- **Stories.** In an epic every part belongs to one story; several small stories may share a part, the first one giving the task number of the commit.
- **Detail.** Name real files, symbols and behaviours that the research confirmed. The implementer reads only the common section and its own card, so the card has to be enough: it should not have to repeat your research or make design choices. Include a snippet only where a shape matters; do not paste whole implementations.

**3f. Write the plan file** in the format of the `Plan` template at the end of this file: first the part for the person, in the person's language, then the sections for the agents, in English. Worktree directories are `<main checkout>-<id>` next to the main checkout; branches are `sc-<id>/<short-slug>` for a story and `epic-<id>/<short-slug>` for an epic.

## Step 4. Plan approval (mandatory)

**4a. The gate.** Call `ExitPlanMode`. The person reads the plan file and answers in the dialog.

- **Approved** → Step 4b.
- **The person keeps planning**, with or without comments → treat every comment as feedback: change the plan file in place, bump the revision, add a line to the revision log, and call `ExitPlanMode` again. There is no limit on the number of rounds.
- **Cancelled** → once out of plan mode, set the stage in `state.md` to `cancelled` and stop.

Without plan mode (Step 3a): show a summary of the plan in at most ten lines, the path of `02-plan.md`, the parts table and everything listed under `Not covered`, and say that the exact word `approve` also allows local commits in the task worktrees. Anything else than `approve` or `cancel` is feedback; a bare "ok" or "yes" is not approval.

**4b. After approval.** This step is safe to repeat. It is also where a session starts that holds the approved plan but not this conversation: the first line of the plan points here. A plan whose first line names a revision is not a first approval: follow "Changing the plan later" below instead.

1. Cut the plan into files: `node "$AI_CONFIGS_DIR/scripts/split-plan.mjs" <plan file> <task dir>`. It copies the plan to `<task dir>/02-plan.md` and writes `02-plan/common.md`, one `02-plan/part-<n>.md` per card, `documentation.md`, `acceptance.md` and `qa-scenarios.md`. Compare the number of parts it prints with the parts table. If it reports an error or a missing section, correct the headings in the plan file and run it again. Never retype a section by hand.
2. Append the questions and answers of the planning stage to `## Clarifications` of `01-context.md`, in English: the documentation and QA agents read them there.
3. Update `state.md`: the revision and the time of the approval, the repositories table, the parts table with every part `pending`, the stage `worktrees`.
4. Measure your context (rule 13).

**Changing the plan later.** A correction that changes neither scope nor behaviour (a path, a missing import, a step made clearer) you make directly in the card under `02-plan/` and note in the log of `state.md`. A change of scope or behaviour goes through the gate again, at a moment when no agent is running and everything is committed (the end of a wave): in plan mode you can neither commit nor update `state.md`.

1. Enter plan mode and write a plan that holds the reason and the changed and new cards only, with new part numbers continuing the old ones. Its first line is the marker of the run with the revision added: `> implement-run: <key> · revision <n> · task directory: <absolute path> · session directory: <absolute path>. If you hold this plan without the /implement instructions, read <session directory>/.claude/commands/implement.md and carry out "Changing the plan later" of Step 4 from point 2.`
2. After the approval, cut it with `node "$AI_CONFIGS_DIR/scripts/split-plan.mjs" <plan file> <task dir> --revision <n>`, which writes the cards of the revision and leaves every other file as it is.
3. In `state.md` record the revision, add the new parts as `pending`, and set a changed part that was already built back to `pending`. Leave every other part as it is.

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

## Step 6. The application and the baseline

**The application.** The implementers check their parts in the running application, so it is needed from the first wave on. The person chose in Step 2 how each changed application will be available. If that answer is missing (a run continued from an older version), ask now with AskUserQuestion.

- **Started by you.** Read the project's `CLAUDE.md` for the development command and start it from the worktree in the background, on the port the project documents. If that port is taken, ask the person instead of choosing another one: a staging API may refuse requests from an unlisted port. You stop the server again in Step 12.
- **Run by the person.** Use the URL the person gave. It must be a local address of a server started from the task worktree: a server from another checkout, and a staging deployment, do not contain the change. Check it without asking: the working directory of the process listening on that port (`lsof -a -d cwd -p $(lsof -ti tcp:<port> | head -1)`) has to be the worktree. If it is not, or you cannot tell, show the worktree path and ask the person to start the server from it.
- **The mobile application.** It is tested on a simulator or an emulator through the `mobile-mcp` server, never through the browser. The development server (`npx expo start`, or what the project's `CLAUDE.md` says) has to run from the worktree, not from the main checkout, and the application has to be open on the device. List the devices with `mobile-mcp`, and write the device ID, the platform and the application ID into `Environment`. With no device running, or more than one candidate, ask the person.
- **No application.** UI checks are skipped, documentation is written without screenshots and QA is skipped; all three facts go into the summary.

A web URL must be a local or staging address. If you cannot tell whether an address is production, ask. Check that each URL answers (`curl`, status code only) and write the final addresses into the `Environment` section of the context file: an environment that does not work is cheaper to find here than inside an agent.

Test users come from the `test_users` key of `.claude/settings.local.json` in the session directory, or in the target project if the session directory has none. Do not ask the person for them. These environments hold test data only, so agents may create, change and delete whatever they need with these users. Give agents the path of the settings file, never the values. If no test users are configured, ask the person for credentials and keep them in the conversation only.

**The baseline.** Before the first part is built, run the full check of `common.md` (type check, lint, all tests) once in every code worktree, with the output sent to `<task dir>/checks/baseline.log` and only the summary shown. A failure that is there before the run is not this task's: note it in `state.md`, and leave it out of every later check.

## Step 7. Build the parts, wave by wave

The parts and their waves come from the approved plan. All parts of a repository are built in its one task worktree. For each wave, in order:

**a. In Development (epic run).** Move every story that has a part in this wave to In Development, with the same rules as in Step 2.

**b. Launch the implementers** of the wave together, with at most three running at a time; launch the rest as the first ones return. A new `task-implementer` for each part:

```text
Mode: part
Task key: <key>
Part: <n> <title>
Common file: <task dir>/02-plan/common.md
Card: <task dir>/02-plan/part-<n>.md
Report to write: <task dir>/03-implementation/part-<n>.md
Worktree: <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
Other parts are being built in this worktree at the same time: yes | no
UI tool: shared-browser | mobile-device <device ID> | none
UI turn: now | wait
Application: <URL, or how the mobile application is opened> | not available
Environment: the `Environment` section of <task dir>/01-context.md
Test users: <settings file path>, key test_users
Screenshots directory: <task dir>/ui/part-<n>/
Notes from the orchestrator: <up to five lines, or "none">
```

`UI tool` is `none` when the card has no UI check or no application is available. `UI turn` is `now` for one implementer at most, and only while nobody holds the tool (rule 15); every other implementer gets `wait`.

**c. When an implementer returns:**

- `done` → commit the part from the `files` list of its final message (see "Commits" below) and launch its reviewer (d). With `ui-check: waiting`, also put the part into the queue for the UI tool (e).
- `partial` → rule 4.
- `open-questions` → rule 5. `blocked` → rule 11. The other parts and the reviews go on, but the end of the wave waits for this part.
- `needs-file` → the part cannot be finished without changing an existing file that its card does not list. Grant it when no part that is running has that file in its card or was granted it; record the grant in `state.md` and resume the agent with "Granted: `<path>`". Otherwise the request waits until the part that owns the file is committed. A request that changes what the part does is an open question, not a grant.

**d. Review.** A new `task-reviewer` for the part, as soon as its commit exists:

```text
Mode: change-review, part <n>, round 1
Common file: <task dir>/02-plan/common.md
Card: <task dir>/02-plan/part-<n>.md
Implementation report: <task dir>/03-implementation/part-<n>.md
Review file to write: <task dir>/04-review/part-<n>.md
Change to review: commit <hash> in <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
Context file (the wording of an acceptance criterion, by its ID only): <task dir>/01-context.md
```

- `APPROVED` without findings → the part is approved.
- Any finding, blocking or not → a fix round:
  1. Resume the part's implementer: "Settle the findings of round `<r>` in `<review file>`: fix each one, or say in your report why it stays."
  2. Commit what it changed.
  3. Resume the part's reviewer: "Mode: fix-verification, part `<n>`, round `<r+1>`. Fix commit: `<hash>`." When the implementer changed nothing, give no commit and ask it to weigh the reasons.
- After a verification: `APPROVED` → the part is approved, and non-blocking findings that remain go to the open items of the summary without another round. `CHANGES REQUESTED` → one more fix round.
- If the implementer declined a finding and the reviewer kept it, put both positions to the person with AskUserQuestion.
- After two fix rounds that still end in `CHANGES REQUESTED`, ask the person with AskUserQuestion: run another round, accept the part as it is (the remaining findings go into the open items of the summary), or stop.

A fix round runs at once while its own wave is still being built. Once the next wave has started, the fix rounds of earlier waves wait for the end of the running wave (f): a fix must not change code under a part that is being built on top of it.

**e. The UI check.** An implementer launched with `UI turn: now` does its UI check before it returns. One that returned `ui-check: waiting` gets its turn as soon as the tool is free: resume it with "The UI tool is yours: run the UI check of your card now." Give one turn at a time (rule 15). It answers with:

- `ui-check: passed` → nothing more to do.
- `ui-check: fixed` → commit the files it lists. That commit is verified by the part's reviewer with a `fix-verification`, together with a review fix when one is pending.
- `ui-check: blocked` → the application could not show the part. An environment problem is yours to fix (Step 6), and then the agent gets its turn again. When the cause is code that is still being written by another part, the check is repeated at the end of the wave (f).

A part that needs a new native build of the mobile application cannot be checked on the device: record it as an open item for the summary.

**f. The end of a wave.** When every part of the wave is committed and no implementer is running:

1. Run the fix rounds that waited for this moment (d, g), in parallel where they belong to different parts.
2. `git -C <worktree> status --short` has to be empty. A file that is left belongs to some part: find the part by its card, and resume its implementer to account for it. Never stage a file blindly, and never stage `.env` files, credentials or anything from the task directory.
3. **The wave check.** Run the full check of `common.md` (type check, lint, all tests) in every changed worktree, with the output sent to `<task dir>/checks/wave-<w>.log` and only the summary shown. While it runs, launch and resume nothing that edits. A failure that the baseline already had does not count.
4. A red check goes to a wave fixer, a new `task-implementer`:

   ```text
   Mode: fix
   Task key: <key>
   What to fix: the failures in <task dir>/checks/wave-<w>.log (the baseline is <task dir>/checks/baseline.log)
   Common file: <task dir>/02-plan/common.md
   Cards of the parts involved: <paths>
   Report to write: <task dir>/03-implementation/wave-<w>-fix-<k>.md
   Worktree: <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
   Other parts are being built in this worktree at the same time: no
   UI tool: none
   ```

   Commit its change, have it reviewed by a new `task-reviewer` (`Mode: change-review, wave <w> fix <k>`, with the wave fixer's report in place of a card and the review written to `04-review/wave-<w>-fix-<k>.md`), and run the check again. After two attempts that leave it red, ask the person.
5. With the check green, run the UI checks that are still open, one at a time: the application is in its best state now. An implementer that cannot be resumed is replaced by a new `task-implementer` with `Mode: ui-check` and the prompt of (b). If one of them changed code, commit it and run the check again.
6. Measure your context (rule 13) and update `state.md`. Above the threshold of rule 13, let the running reviews and their fix rounds finish first, and then ask.
7. Before the next wave starts, every part that one of its parts names under `Starts after review of` has to be approved. Wait for those reviews and run their fix rounds now, while nothing is being built: left to wait for the end of the wave that needs them, they would never run. Then start the next wave. The other reviews of this wave go on in the background.

**g. Review across the parts of a wave.** Parts of one wave were written without seeing each other. For a wave of two or more parts, once all of them are approved, launch a new `task-reviewer`:

```text
Mode: wave-review, wave <w>
Common file: <task dir>/02-plan/common.md
Cards of the wave: <paths>
Implementation reports of the wave: <paths>
Review file to write: <task dir>/04-review/wave-<w>.md
Change to review: commits <hashes> in <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

Its findings wait for the next end of a wave (f.1) and go to a wave fixer as in f.4, with "What to fix: the findings of `<task dir>/04-review/wave-<w>.md`".

**h. After the last wave** everything has to be settled before documentation and QA: every part approved or accepted by the person, every review across parts done, no fix round waiting, the tree clean and the check green. If anything was changed after the last check, go through the end of a wave once more.

### Commits

Before the first commit of the run, read the project's commit command once: `.claude/commands/commit.md` of the target project, or of the session directory when the project has none. Its rules for the message are the rules here. Do not restate them from memory, and do not copy the style of earlier commits in the branch. How its steps apply in this pipeline:

- **Format.** Exactly what the command prescribes. The task number is the story ID with the part as the subtask: `<story ID>/<part number>`. A commit that covers several parts (a wave fix) lists them: `<story ID>/<n>,<m>`. Documentation, and a fix round for QA or review bot findings, are committed under the story ID alone, or the epic ID for the documentation of an epic. For a part that covers several stories, use the first story's ID and name the others in the description without the `sc-` prefix.
- **Description.** What changed, as the command prescribes. A fix commit also says what changed ("align the rank badge with the ElementsBox rule"), never that a review was addressed.
- **One logical change.** A commit holds the files of one part, or of one fix round.
- **No trailer lines**, as the command says, whatever a default of the session suggests.
- **Task number and confirmation.** The command asks the person for the task number and for a `yes` before every commit. Here the number comes from the plan, and the person's approval of the plan is the confirmation for every local commit of the run: do not ask again.

To commit, stage exactly the paths of the agent's `files` list, including a deleted file and the old path of a renamed one, and commit by path, so that files other parts have in progress stay out of the commit:

```bash
git -C <worktree> add -- <paths>
git -C <worktree> commit -m "<message>" -- <paths>
```

Record the hash in `state.md`.

## Step 8. Documentation and the first QA pass

Skip documentation, and say so in the summary, when the workspace has no documentation repository. QA then runs its `acceptance` pass alone: its findings are handled as Step 9c says, and Steps 9a.3 and 9b are skipped. Skip QA when no application is available.

**Which scheme.** Documentation and QA run at the same time only when each has a browser for itself: the application is a web application, `task-docs` uses the browser of its own, and `task-qa` holds the shared one (rule 15). When the task changes the mobile application, there is one device for both, so they run one after the other: `task-docs` in `write` mode with the device, then `task-qa` in `full` mode, and its findings are handled as Step 9 says for the run of the test cases.

Launch both in one message. `task-docs`:

```text
Mode: write
Task key: <key>
Context file: <task dir>/01-context.md
Plan, documentation: <task dir>/02-plan/documentation.md
Common file: <task dir>/02-plan/common.md
Implementation reports, one per part or fix: <task dir>/03-implementation/
Reviews: <task dir>/04-review/
Documentation worktree: <worktree directory>
Code worktrees (read only):
- <repo>: <worktree directory>
Report to write: <task dir>/05-docs.md
UI tool: own-browser | shared-browser | mobile-device <device ID> | none
Application: <URL, or how the mobile application is opened> | not available
Test users: <settings file path>, key test_users
```

`task-qa`:

```text
Mode: acceptance
Task key: <key>
Context file: <task dir>/01-context.md
Plan, acceptance criteria: <task dir>/02-plan/acceptance.md
Plan, QA scenarios: <task dir>/02-plan/qa-scenarios.md
Implementation reports, one per part or fix: <task dir>/03-implementation/
Documentation report: not written yet
Documentation worktree: not written yet
UI tool: shared-browser | mobile-device <device ID>
Application: <URL, or how the mobile application is opened>
Test users: <settings file path>, key test_users
Report to write: <task dir>/06-qa.md
Screenshots directory: <task dir>/qa/
```

In `full` mode the two documentation lines give `<task dir>/05-docs.md` and the documentation worktree.

If `task-docs` returns `blocked` because its own browser did not start, launch it again with `UI tool: shared-browser` once `task-qa` has returned the tool, and run the two one after the other from then on.

When `task-docs` finishes, commit in the documentation worktree exactly the files listed in the `Documents` table of `05-docs.md` ("Commits" in Step 7). Then run `git -C <worktree> status --short`: a change that is left over is checked against the `Documents` tables of every round with a targeted search and staged when it is listed there; anything still unexplained is shown to the person, not committed.

## Step 9. Fix rounds and the run of the test cases

**a. Findings of the first pass.** `BUG` findings of the `acceptance` pass start fix round 1, but only after `task-docs`, when it runs, has finished writing: it describes the code as it is, and a fix made under it leaves the document describing something else.

1. Launch a new `task-implementer` with `Mode: fix`, "What to fix: the `BUG` findings of round `<r>` in `<task dir>/06-qa.md`", the report `<task dir>/03-implementation/qa-round-<r>.md` and the other lines of the wave fixer's prompt (Step 7f). The fix is checked in the application by the next QA run, not by the fixer.
2. Commit, and have the commit reviewed by a new `task-reviewer` in `change-review` mode, writing `<task dir>/04-review/qa-round-<r>.md`, with the fix loop of Step 7d.
3. Always launch a new `task-docs` with `Mode: sync`, the paths of Step 8, the finding IDs in `06-qa.md` and the report of the fix round: the document and the test cases were written from the code before the fix and may describe the defect as the behaviour. Commit its changes.

**b. The run of the test cases.** When the documentation is committed, launch a new `task-qa` with `Mode: cases`, the prompt of Step 8 with the documentation report and worktree filled in, and "Items to rerun: `<the BUG findings fixed in a>`". It executes the written cases as they are written, so a wrongly worded case comes back as a `DOC` finding.

**c. Findings of that run.** A verdict of `PASS` leads to Step 10. Otherwise:

1. **`BUG` findings.** A fix round as in (a.1) and (a.2).
2. **Documentation.** If there are `DOC` findings, or a fix changed behaviour that the documentation describes, launch a new `task-docs` with `Mode: sync`, the paths of Step 8, the finding IDs and the report of the fix round. Commit its changes.
3. **Retest.** Launch a new `task-qa` with `Mode: retest`, the same paths, and the items to rerun: the failed ones and the ones next to the changed code.

`OUT` findings (a defect that exists without this task's change, or a cause in the backend) do not start a fix round: record them as open items and show them at the PR gate. A `task-qa` that returns `status: partial` has items left: launch a new one with the same prompt and "Continue from the report" (rule 4).

After two fix rounds that still end in `FAIL`, ask the person with AskUserQuestion: run another round, accept with the remaining findings as open items, or stop. `BLOCKED` items do not start a fix round; they are reported at the PR gate.

## Step 10. PR gate

Skip Steps 10 and 11 when `gh` is not available, and list the manual steps in the summary.

Before the gate, state plainly anything that is not clean: a part accepted with open review findings, a UI check that could not run, QA skipped or accepted with findings, `OUT` findings, `BLOCKED` QA items, pending documentation.

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

**Triage.** Launch a new `task-reviewer` for the round:

```text
Mode: pr-triage, round <n>
Bot comments to triage: <task dir>/07-pr.md, section "Round <n>"
Context file: <task dir>/01-context.md
Common file: <task dir>/02-plan/common.md
Cards (open only the card of the part a comment touches): <task dir>/02-plan/
Worktrees:
- <repo>: <worktree directory> (rules: <main checkout>/CLAUDE.md and <main checkout>/.claude/rules/)
```

**Act on the triage.**

1. `ask-user` items → AskUserQuestion; the answer turns each into `fix` or `reply`.
2. `fix` items → launch a new `task-implementer` with `Mode: fix`, "What to fix: the comments marked `fix` in the triage of round `<n>` in `<task dir>/07-pr.md`", the report `<task dir>/03-implementation/pr-round-<n>.md` and the other lines of the wave fixer's prompt (Step 7f). Commit its change locally, then resume this round's reviewer in `fix-verification` mode with that commit, writing `<task dir>/04-review/pr-round-<n>.md`.
3. If a fix changed behaviour, rerun the affected cases with a new `task-qa` in `retest` mode and update the documentation with a new `task-docs` in `sync` mode.
4. Push **once** per repository for the whole round, when its fixes are committed and verified. Every push starts another bot review and uses its quota, so never push fixes one at a time.
5. Reply in every thread with `gh api`: "Fixed in `<short sha>`: <what changed>" for fixed comments, the reviewer's drafted reply for the others. Resolve the threads you fixed (GraphQL `resolveReviewThread`). Leave declined threads open for the bot or the person to close. Answer remarks from the review body in one pull request comment that mentions `@coderabbitai`.
6. Record the replies and the commit in `07-pr.md`, then wait for the bot's next pass.

After three rounds on one pull request, ask the person with AskUserQuestion whether to continue, stop with the remaining comments as open items, or handle them personally.

## Step 12. Summary

Stop any development server you started. Set the stage in `state.md` to `done`. Then report, in the person's language:

- what changed, per repository and per part;
- the pull requests, with links;
- the review outcome, the UI checks, the documentation written, the QA result, the bot rounds;
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
- Stage: context | planning | worktrees | wave <w> | docs-qa | pr-gate | pr-review | done | cancelled
- Plan: revision <n>, approved <date and time> | not approved
- Epic analysis: <readiness directory>, run <date>, brought up to date <date and time> | none
- Application: <URL, or device and application ID> (started by the orchestrator: yes | no) | not available
- UI tool: <shared-browser | mobile-device <ID>>, held by <agent and part> | free
- Context: <last measurement, date and time>

## Repositories
| Repository | Main checkout | Base | Worktree | Branch | Baseline check | Pull request |

## Parts
<Status: pending | implementing | committed | fixing | approved | accepted with open findings | waiting for the person>
| # | Wave | Story | Title | Status | Implementer ID | Reviewer ID | Review rounds | UI check | Commits |

## Waves
| Wave | Parts | Check | Review across parts | Fix attempts |

## Waiting
<fix rounds that wait for the end of the running wave; parts in the queue for the UI tool; `needs-file` requests and grants>

## Other agents
<documentation, QA, wave fixers, fix rounds, bot rounds: one row per instance>
| Role | Agent ID | Used for |

## Rounds
QA fix rounds: 0 · Bot rounds per pull request: 0

## Log
- <date and time> <event>
```

### Plan

The plan is one file. Its first line is the marker of the run, exactly as below. Then comes the part for the person, in the person's language, and then the sections for the agents, in English.

- The headings of the agents' sections are fixed: `## Common`, `## Part <n>: <title>`, `## Documentation`, `## Acceptance criteria mapping`, `## QA scenarios`. The script of Step 4b cuts the plan by them, so they are level-two headings spelled exactly so, and everything inside a section uses level three or deeper.
- No heading of the person's part may be one of those five. Translate the headings of the person's part; keep that part short enough to read in a few minutes.

```markdown
> implement-run: <key> · task directory: <absolute path> · session directory: <absolute path>. If you hold this plan without the `/implement` instructions, read `<session directory>/.claude/commands/implement.md` and carry out its Step 4b with this file as the approved plan.

# <Implementation plan>: <key> <title>

Revision: <n> · <date>

## <Summary>
What will be built and the approach, in a few sentences.

## <Scope>
In scope / out of scope, as two short lists.

## <Decisions and findings>
What the research found, what was decided and why, and the person's answers. This is the memory of the planning stage: write down everything a later session would need to understand the cards.

## <Repositories and worktrees>
| Repository | Main checkout | Base ref | Worktree directory | Branch | Why it is touched |

## <Parts>
| # | Wave | Story | Title | Goal in one line | Depends on | UI check | Files |

## <Tests>
The coverage criterion, and each changed file deliberately left without tests, with the reason, or "None".

## <Backend dependencies>
Endpoints or fields the frontend relies on, their status, and the fallback.

## <Risks and assumptions>

## <What the approval allows>
Approving this plan allows worktrees, code changes and local commits in the task worktrees, made by the project's commit rules. Nothing is pushed before the PR gate.

## <Revision log>
- r<n> (<date>): what changed and why

## Common
Task: <key> <title>

| Repository | Worktree | Branch | Rules (`CLAUDE.md` and `.claude/rules/`) |

| Repository | Type check | Lint, own files | Tests, own files | Full check (type check, lint, all tests) | Coverage |

Coverage criterion: <as stated in Step 3e>
Not covered: <files, or "None">
Conventions every part follows: <the few project rules that apply to all parts, each with the rule file that states it>

## Part <n>: <title>
Story: <ID> · Wave: <w> · Repository: <repository>
Goal: <what this part builds and what it is for, in one to three sentences>
Depends on: <parts and what is used from them (files, symbols), or "nothing">
Starts after review of: <parts, or "none">

### Files
| Path (relative to the repository) | Create, modify or delete | What changes |

### Existing code to reuse
Path, symbol and what it gives.

### Contracts
What this part provides to other parts and what it takes from them: types, props, payloads, selectors.

### Steps
Numbered. Each step names the files and the concrete change.

### Tests
| Test file | Scenarios | Code it covers |

### Verification
Commands beyond the ones in `Common`, or "Common only".

### UI check
Tool: browser | mobile | none
<the route or screen and how to reach it; the role; the data (live API, or mocks from a named fixture); the states to look at>

### Acceptance criteria
<IDs from the context file>

## Documentation
Which pages the documentation agent should create or update, and the facts they must cover.

## Acceptance criteria mapping
| Criterion | Part | How it is verified |

## QA scenarios
Scenarios for the whole task, including unusual user actions worth probing, and what cannot be tested in this environment.
```

### `01-context.md`

```markdown
# Task context: <key>

- Source: <story | epic> <id>, <URL>
- Title: <title>
- Collected: <date and time>

## User instructions
<the extra instructions from the command line, verbatim, or "None">

## Epic analysis
<"None" when the epic has no `/epic-readiness` run>
- Directory: <absolute path of readiness/>
- Run: <date> · frontend can start: <yes | partly | no> · contract: <sufficient | needs changes | none>
- Contract: <path>, <status>, <version>

| File | What it contains |
<one row per file the agents should read: the report, the specification, the contract, the person's decisions, each code map, the source inventory, prototype screenshots>

### Scope from the verdict
In scope now: <areas, with their requirement IDs>
Waiting: <area · what it waits for · who owes it>

### Changes since the epic analysis
<new comments verbatim with ID, author and time; contract changes; story state changes; repository commits; or "None">

### Questions already asked
| Question | Addressee | Where it was asked | Status |

## Requirements
<the description, verbatim; for an epic the epic description first, then each included story under its own heading. With an epic analysis: the story description verbatim (story run), then the paths of the specification and the report instead of a copy>

## Acceptance criteria
<numbered AC-1, AC-2, …; for an epic grouped by story. With an epic analysis: the requirement IDs in scope from the matrix, each with its one-line statement>

## Parent epic
<story run only; "None" when the story has no epic; "See Epic analysis" when the epic was analysed, followed only by the sibling stories table>
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

## Stories in scope
<epic run only; the parts are in the plan>
| Story | Title | State | Included | Reason |

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

| Application | URL, or device and application ID | API it talks to | Known constraints |

- Test data notes: <paths of notes and documents that describe test data for this feature, or "None">
- Read-only data access: <a script or connector for looking at staging data, or "None">

## Out of scope
<what was excluded and why, for example backend stories of the epic>

## Clarifications
<questions asked during the run and the person's answers, appended as they happen>
```
