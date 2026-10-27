---
title: Admin — introduction
audience: admin
---

Admins have **full Hub access**, including user lifecycle and system configuration that other roles cannot change.

## Typical Admin duties

- **User management** (invite, roles, deactivate, password reset).
- **KPI settings**: targets, weights, **reporting owner** (Daily DSAT assignee), configuration history.
- **QA workflow config** via API today (appeal/escalation windows)—**no Hub UI** for this yet.
- Support Supervisors on operational issues and View As troubleshooting.

## Guardrails

- Do not recreate deleted users via ad-hoc DB edits—use People UI.
- Production: keep `SEED_ON_BOOT` off unless intentionally seeding an empty environment.
