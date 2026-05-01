# Git Commit

Create a git commit for the current changes.

**Task number (optional):** $ARGUMENTS

---

## Step 1 — Analyze changes

Run `git diff --staged` to see what is staged for commit.

If nothing is staged, run `git diff` to see all unstaged changes, then inform the user:
> "No staged changes found. Showing all unstaged changes instead. Stage the files you want to commit with `git add` before proceeding."

Read the diff carefully — the commit message must reflect the actual changes.

---

## Step 2 — Evaluate commit cohesion

Determine if all changes belong to one logical unit of work.

If changes span unrelated concerns (e.g., a bug fix + a new feature + a refactor), stop and suggest splitting:

> "These changes seem to cover multiple concerns:
> - Commit 1: ...
> - Commit 2: ...
> Would you like to split them, or commit everything together?"

Wait for the user's decision before continuing.

---

## Step 3 — Ask for task number

Check if `$ARGUMENTS` starts with digits (e.g., `39463` or `39463 some hint`).

- If found — extract the number and use it.
- If not found — ask:

> "What is the task number for this commit?"

Wait for the user's response before continuing.

---

## Step 4 — Generate commit message

Write a short, imperative English description based on the actual diff:
- Max 60 characters
- Imperative mood ("add", "fix", "update", "remove" — not "added", "fixes")
- Focus on WHAT changed, not HOW
- No period at the end

Combine with the task number:

```
{task_number}: {description}
```

Examples:
- `39463: show Indeed job source name`
- `41022: fix pagination reset on filter change`
- `38800: add bulk archive action to candidate list`

---

## Step 5 — Confirm before committing

Show the final commit message and ask for approval:

> Commit message:
> `{task_number}: {description}`
>
> Confirm? (yes / edit)

**IMPORTANT: Do not run `git commit` until the user explicitly confirms** with "yes", "y", "ok", or similar positive response. If the user requests edits — update the message and show it again before asking for confirmation once more.

Only after explicit confirmation, run:

```
git commit -m "{task_number}: {description}"
```

**IMPORTANT: Never append `Co-Authored-By` or any other trailer lines to the commit message.**
