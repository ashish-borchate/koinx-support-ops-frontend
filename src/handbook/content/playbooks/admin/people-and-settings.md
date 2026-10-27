---
title: People, KPI settings & QA config
audience: admin
---

## User management

Open **User management** from the account menu → create users, assign roles, resend invites, deactivate accounts.

Employees should sign in with **Google** when configured; password remains fallback.

## KPI reporting owner (Daily DSAT)

1. **KPI Performance** → **KPI settings** → **Reporting** tab.
2. Set **Reporting owner** to the active employee (ops: Senior Agent for DSAT, e.g. Harsh).
3. Set **launch date (IST)** so Daily DSAT tasks activate.

Requires `kpi.manage_goals` (Admin only).

## QA appeal windows

Defaults in code: **7** appeal days, **3** escalation days. Stored in Mongo `qa_workflow_config` when changed via Admin API (`GET/PUT /api/qa/workflow-config`). **Production values unverified** in handbook.

## Audit

There is no global audit UI; use module history and database tools when investigating.
