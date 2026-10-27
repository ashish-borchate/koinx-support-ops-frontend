---
title: workflow
---

## Purpose
Track weekly support performance (speed, SLA, CSAT, QA) in one scorecard for coaching and management conversations.

## When to use it
You are configuring how weeks are scored, auditing Supervisor entry quality, or explaining an Agent’s scorecard — not entering every agent’s row each week unless covering for a Supervisor.

## Who is responsible
| Task | Owner |
| --- | --- |
| Weekly metric entry | Supervisor (primary) |
| Targets & weights | Admin |
| View own scorecard | Agent |

## What happens next
1. After the IST week (Monday boundary), Supervisor enters FRT, ART, resolution, SLA, CSAT, and linked QA for each Agent.
2. Supervisor also enters **one weekly team ART** from Freshdesk (reporting week + support group, **no Agent filter**). Management Overview uses this value for team Average Response Time — it is not calculated from ticket counts.
3. The Hub computes each Agent’s composite scorecard from Admin-configured weights (team ART does not replace per-Agent ART).
4. Agents see their own metrics on the dashboard and KPI module.

## Freshdesk time metrics (ART, FRT, resolution)
- **Average Response Time (ART)** — average time across **agent responses** in the reporting period (not per ticket). Different from **First Response Time (FRT)** and **Resolution Time**.
- For each Agent: in Freshdesk Analytics, select the Agent and reporting week, copy **Average response time** (use the same business-hours view your team uses today), and enter the duration in Support Hub (hours, minutes, seconds, milliseconds).
- For **team ART**: same report, correct week and group, **leave Agent unselected**, enter once under **Weekly team ART** on the KPI page.

## What requires follow-up
- Data is **manual** — there is no automatic Freshdesk sync in the active path.
- Wrong weights or targets — Admin fixes in KPI Settings; past weeks may need Supervisor correction.

## Common mistakes
- Admins entering every agent every week instead of fixing process with Supervisors.
- Comparing QA raw score vs KPI when an appeal changed the effective score.
