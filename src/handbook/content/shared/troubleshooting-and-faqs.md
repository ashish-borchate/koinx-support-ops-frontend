---
title: Troubleshooting & FAQs
description: Login, access, DSAT, appeals, and common errors.
audience: all
---

## I cannot sign in with Google

- Confirm an Admin created your email in **User management**.
- Use the same Google account as your employee email.
- Try **password fallback** if enabled.

## I do not see a module in the sidebar

Your role may lack permission, or the module may not apply to you. Ask your Supervisor.

## I do not see Daily DSAT tasks

Only the **KPI reporting owner** sees them. An **Admin** must set **Reporting owner** and **launch date** under KPI settings. Production assignee is **unverified** in this handbook—ops intends Senior Agent (Harsh) when configured.

## My QA appeal window closed

Default appeal window is **7 days** from review creation (production unverified). Contact your lead for process questions.

## View As will not let me save

View As is **read-only** by design.

## API / connection errors locally

Ensure MongoDB and the API server are running; the client expects the API on port **4179** in development.
