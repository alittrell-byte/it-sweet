# Ticketing (Module 1)

The core help desk: customers submit tickets, staff work them through a lifecycle with SLA
tracking, approvals, escalation, and time tracking, and everyone gets a satisfaction survey at
the end.

## Creating and viewing tickets

- **Customers** create tickets from **Tickets → New Ticket** (subject, description, priority).
  They only ever see their own tickets under **Tickets → My Tickets**.
- **Staff** see every ticket under **Tickets → All Tickets**, with filters for status, priority,
  assignee, team, and tags (persisted in the URL query string, so a filtered view is bookmarkable
  and shareable).
- Tickets can also come in **by email** - an IMAP watcher (`IMAP_*` env vars) polls a mailbox and
  turns new messages into tickets, replies into comments. Off by default until `IMAP_HOST` is
  configured.

## SLA and priority

Every ticket gets a `responseDueAt`/`resolutionDueAt` computed automatically from its priority
when created. There's no business-hours/calendar concept (deliberately out of scope) - due dates
are wall-clock from creation time.

## Status workflow, assignment, and teams

- Status: `new → in_progress → waiting → resolved → closed` (plus `pending_approval`, see below).
- **Assign** a ticket to a staff member and/or a **Team** (a support queue/tier -
  **Settings → Teams / Queues**, gated by `tickets.manage_teams`). Teams have a `tier` number and
  an optional `escalatesToTeamId` - the ticket detail page's **Escalate** button one-click-bumps
  a ticket to that team's designated next tier, logging the move.
- **Watchers**: any user can add themselves (or be added) as a watcher on a ticket to get status
  update emails without being the requester or assignee.

## Approval workflow

Mark a ticket `requiresApproval: true` on creation (or via a ticket template - see below) and it
enters `pending_approval` instead of `new`, blocking normal status changes until a user with
`tickets.approve` calls **Approve** (routes it to `new`) or **Reject** (closes it with a reason
and still fires the satisfaction survey).

## Tags

Tickets can carry multiple tags (a real indexed join table, not a JSON blob - built specifically
so tag search stays fast at volume). Set tags from the ticket detail page or via **bulk actions**
on the list view.

## Bulk actions

Select multiple tickets in the list view (checkbox column) to bulk-change status, bulk-assign,
bulk-set tags, or bulk-set team in one action. Each ticket in the batch succeeds/fails
independently - a bad id in the batch doesn't fail the whole operation.

## Saved views

Save your current filter combination as a named view (**Tickets → All Tickets → Save this
view**) and reapply it later from a dropdown - personal to each user.

## Ticket templates

**Settings → Ticket Templates** (gated by `tickets.manage_templates`) lets you pre-fill subject,
description, priority, category, and the approval-required flag for common request types (e.g.
"New Hire Setup"). Selecting a template on ticket creation pre-populates the form.

## Recurring tickets

**Settings → Recurring Tickets** (gated by `tickets.manage_recurring`) defines a template that
auto-creates a new ticket on a schedule (e.g. a weekly server check) - a background sweep creates
due tickets automatically.

## Canned responses

**Settings → Canned Responses** (gated by `tickets.manage_canned_responses`) - reusable reply
snippets staff can insert into a ticket comment instead of retyping common answers.

## Time tracking

Staff can log time entries against a ticket (`tickets.manage` implied by ticket access) - used
for internal reporting on effort spent, visible on the ticket detail page.

## Attachments

Both customers and staff can attach files to a ticket or a comment; download requires access to
that ticket.

## Linking assets and knowledge base articles

A ticket can link to one or more **Assets** (e.g. "this ticket is about that specific laptop")
and one or more **Knowledge Base articles** (e.g. "resolved via this runbook") - both show on the
ticket detail page and are reachable from the linked asset's/article's own page too.

## Customer satisfaction survey

Once a ticket is resolved or closed, the requester can submit a 1-5 rating plus a comment via
**Ticket → Survey** - one submission per ticket.

## Dashboard

**Tickets → Dashboard** (gated by `tickets.view_dashboard`) - open/overdue counts, volume trends,
and per-team/per-assignee breakdowns.

## Permissions (`tickets.*`)

| Key | Grants |
|---|---|
| `tickets.view_dashboard` | View the ticket dashboard |
| `tickets.manage_canned_responses` | Manage canned responses |
| `tickets.approve` | Approve/reject tickets pending approval |
| `tickets.manage_templates` | Manage ticket templates |
| `tickets.manage_teams` | Manage teams/queues and membership |
| `tickets.manage_recurring` | Manage recurring ticket templates |

Everything else (assign, status change, tags, team, escalate, bulk actions, time entries, linking
assets/articles) requires being staff (`admin`/`technician` role) - there's no finer-grained
permission for day-to-day ticket handling itself, only for the admin-configuration surfaces above.
