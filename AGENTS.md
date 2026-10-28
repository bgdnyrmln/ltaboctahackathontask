# OCTA Telematics Workbench Agent Instructions

## Before work

- Read the shared Notion HQ, concept brief, and your assigned task.
- Do not implement the app until the team approves the MVP, KPI/score/price framing, and platform.
- Confirm your unique agent ID (A, B, C, or D) and assigned scope. Work one task at a time.
- Check `git status --short --branch` before editing and preserve existing work.

## Git setup

Repository: https://github.com/bgdnyrmln/ltaboctahackathontask
Integration branch: `main`
Starter branches: `agent/A/working`, `agent/B/working`, `agent/C/working`, `agent/D/working`

For a fresh checkout:

```sh
git clone https://github.com/bgdnyrmln/ltaboctahackathontask.git
cd ltaboctahackathontask
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch --track origin/agent/<YOUR_ID>/working
```

If the local branch already exists, use `git switch agent/<YOUR_ID>/working` and `git pull --ff-only`. Before coding, verify `git status`, `git branch --show-current`, and that your branch tracks the matching origin branch. Never work on another agent's branch. If your branch is missing, notify Agent A; create it from `origin/main` only after coordinator confirms the name and assignment.

Use task-specific branches if coordinator assigns multiple tasks over time. Put the exact branch in the Notion task's Branch field before coding. Commit and push only scoped task changes. Open a PR to `main`, link the Notion task, list acceptance evidence and checks, and set the task to Review. A different agent reviews. Contributors never merge their own PRs; Agent A owns project PR merges after the gates below pass.

After a different agent approves and the PR is ready for integration, post a comment on the linked Notion task that begins `READY FOR AGENT A MERGE`. Include the PR URL, current head SHA, approving reviewer, passing check names, and confirmation that requested changes, review conversations, and conflicts are clear. Update the task's `Last update` field, leave it in Review, and wait for Agent A. Do not assume that changing Notion wakes an agent.

### PR merge gates (Agent A only)

1. Confirm the linked Notion task is in Review, its acceptance criteria and verification evidence are complete, and the PR targets `main` from the assigned task branch.
2. Require an explicit approval from a different agent. If the PR head changes after approval, request a fresh review.
3. Confirm all applicable GitHub checks pass, there are no unresolved review conversations or requested changes, and the PR has no merge conflicts. Recheck these immediately before merging.
4. Merge through the GitHub PR operation (or `gh pr merge`), never by pushing a local merge to `main`. Prefer squash when the repository permits it; otherwise use its configured merge method. Do not bypass a failing or missing required check.
5. Verify GitHub reports the PR merged and record the PR URL, merge commit, and checks in Notion. Set the task to Done only after confirming the change is on `main`.

If any gate cannot be verified, leave the PR open and the task in Review, then record the blocker. Do not deploy.

## Product constraints

- Aim for safer driving through an explainable score, visual feedback, and actionable advice.
- Select 3–5 KPIs and normalize events by exposure; account for context and data quality.
- Any premium estimate is a labeled prototype simulation, not a real Balcia tariff or quote.
- Minimize setup, battery/resource use, and personal data. Consider GDPR and EU hosting.
- Use synthetic/sample telemetry unless the team approves reliable live collection.

## Coordination

Use Notion as the shared record. Workers B, C, and D check only their saved agent-filtered task view; do not scan or claim other agents' tasks. Agent A coordinates across the full board and uses per-agent views when assigning or reviewing. Record plan, decisions, changed files, checks, blocker, and handoff on the task. Notion updates do not wake inactive agents; use a verified scheduler or manual check. Never put secrets in the repository or Notion.

### Default team roles

- **Agent A — Coordinator and integration:** decomposes requests, assigns/releases tasks, aligns interfaces, coordinates integration/review, and owns the demo narrative. A does not take another agent's task.
- **Agent B — Frontend:** owns Expo/React Native screens, navigation, UI state, accessibility, and visual polish against the agreed data contracts.
- **Agent C — Backend and app data:** owns TypeScript data models, local persistence, and any API/backend adapter the approved MVP needs. Do not add a server if the demo works locally.
- **Agent D — Telematics, KPIs, and QA:** owns sample-trip fixtures, KPI/score calculations, data confidence, and focused domain tests. Live sensor capture stays out until approved and tested.

Roles are default responsibility areas, not task assignments. Agent A records each concrete owner and branch in Notion after the teammate joins and confirms strengths. Keep shared interfaces explicit to prevent overlap between C's storage models and D's scoring logic.
