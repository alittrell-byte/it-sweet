# Reporting & Insights Hub (Module 10, built ahead of schedule)

Ties the other modules together for a manager or auditor: a cross-module overview, CSV export on
every report, a knowledge base feedback rollup, and scheduled email digests. Not a generic BI/
query builder - every report is a purpose-built page reusing each module's own existing
compliance/dashboard logic.

## Overview

**Reporting → Overview** - a card per module (Tickets, Assets, Logs, Patches) summarizing its key
numbers with a link through to that module's own detailed report page. Only shows cards for
modules you actually hold view permission on - a user with only `logs.view` sees just the Logs
card, not a 403 for the whole page.

## Knowledge base feedback

**Reporting → KB Feedback** - every article with recorded helpful/not-helpful votes, sorted
worst-first (the actionable view: which articles need work). This is genuinely new - Knowledge
Base itself has no fleet-wide reporting, only per-article feedback.

## CSV export

Every curated report - Ticket Dashboard, License Compliance, Depreciation, Patch Compliance, Log
Dashboard, KB Feedback - has a **Download CSV** link right on its existing page. Each export
requires that report's own module permission (e.g. license compliance needs `assets.view`), not
a blanket reporting permission - so granting someone access to the Reporting Hub never gives them
data from a module they can't otherwise see.

## Scheduled reports

**Reporting → Scheduled Reports** (gated by `reports.manage_scheduled` for creating/editing;
reads open to `reports.view`) - pick a report type, a cadence (daily/weekly/monthly), and a
**Notification Group**, and that report's full data is emailed to the group's members on that
schedule. Day-based, not calendar-aware (e.g. "weekly" means every 7 days since the last send,
not "every Monday at 9am"). Toggle a schedule inactive to pause it without deleting it.

## Permissions (`reports.*`)

| Key | Grants |
|---|---|
| `reports.view` | View the overview dashboard and KB feedback report, read scheduled reports |
| `reports.manage_scheduled` | Create/edit/delete scheduled report emails |

CSV export endpoints deliberately do **not** use these keys - see above.
