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

Use task-specific branches if coordinator assigns multiple tasks over time. Put the exact branch in the Notion task's Branch field before coding. Commit and push only scoped task changes. Open a PR to `main`, link the Notion task, list acceptance evidence and checks, and set the task to Review. A different agent reviews. Do not merge, deploy, or force-push without explicit authorization.

## Product constraints

- Aim for safer driving through an explainable score, visual feedback, and actionable advice.
- Select 3–5 KPIs and normalize events by exposure; account for context and data quality.
- Any premium estimate is a labeled prototype simulation, not a real Balcia tariff or quote.
- Minimize setup, battery/resource use, and personal data. Consider GDPR and EU hosting.
- Use synthetic/sample telemetry unless the team approves reliable live collection.

## Coordination

Use Notion as the shared record. Record plan, decisions, changed files, checks, blocker, and handoff on the task. Notion updates do not wake inactive agents; use a verified scheduler or manual check. Never put secrets in the repository or Notion.
