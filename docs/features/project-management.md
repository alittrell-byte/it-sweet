# Project Management

A home for initiatives too large and multi-step to live as a single ticket - server migrations,
office moves, platform rollouts, hardware refresh cycles - while staying genuinely wired into the
same tickets, assets, and technicians the rest of the suite already tracks. This is deliberately
**not** a standalone PM tool bolted onto the platform: a project's linked-ticket count, task
completion, and involved assets are live queries against those modules, not static text.

## Projects

**Projects → All Projects** (gated by `projects.view`) - name, description, owner, status
(Planning → Active → On Hold → Completed → Cancelled), priority, start/target end dates. The list
shows each project's percent-complete, task count, linked ticket count (with how many are still
open), and linked asset count - computed from live data on every load, not a cached snapshot.

## Tasks and the board

**Project detail → View Board** - a 3-column Kanban (To Do / In Progress / Done), drag-and-drop to
move a task between columns or reorder within one. Click a card to edit title, description,
assignee, due date, and percent-complete, manage its dependencies, and spawn or link a ticket.

**Percent-complete rollup**: the project's overall percent-complete is the average of its tasks'
individual percentages, computed on read - not a stored value that can drift out of sync. A task
moved to Done always shows 100%, regardless of what was last typed in, so a "done" task can't drag
the rollup down looking like a bug.

**Dependencies** ("basic" by design): a task can depend on other tasks in the same project - it
can't move out of To Do until every task it depends on is Done. Self-dependencies, duplicates,
cross-project dependencies, and anything that would create a cycle are rejected. Known simplification:
moving a *prerequisite* task backward from Done after a dependent has already progressed isn't
blocked - this is an accepted P0 gap, not an oversight.

## Team

Each project has its own member list, independent of who's assigned to individual tasks - add
staff with a role (**lead**, **contributor**, **reviewer**). This is organizational metadata for
visibility, not an access-control gate: it doesn't restrict who can view or edit the project
beyond the normal `projects.*` permissions.

## Sub-projects

A project can have a parent - useful for large, multi-phase initiatives that are really several
related projects (e.g. a company move split into "Office Fit-out," "Network Cutover," "Furniture
Delivery"). Set **Parent Project** on the child, or use **+ Add Sub-project** from the parent's
detail page to pre-fill it. Cycle prevention rejects a project becoming its own ancestor at any
depth. Deliberately **no automatic rollup** - a parent's percent-complete and task counts are based
on its own tasks only; sub-projects show their own independent progress in a dedicated list. This
avoids drifting into portfolio-rollup territory that belongs to a future dashboard, not this basic
hierarchy link.

## Milestones

Checkpoint markers independent of individual tasks - useful for stakeholder-facing status updates
("Phase 1 complete," "Go-live") that don't map to one specific task. Add a name and optional due
date on the project detail page; check it off when reached (and back off, if needed) or delete it.

## Templates

**Projects → Project Templates** (gated by `projects.manage_templates`, separate from
`projects.manage` - managing the shared template library is a different responsibility than
managing one project) - build a reusable task checklist for a recurring initiative type ("New
Office Setup," "OS Migration," "Vendor Onboarding"). Each template task can carry a
**relative due date** (days after the new project's start date) since a template has no absolute
dates of its own. Pick a template from the **Start from template** dropdown when creating a new
project (top-level projects only, not sub-projects) and its tasks are copied in immediately, due
dates computed from whatever start date you set.

## Attachments

Project detail has an Attachments section for supporting files - specs, floor plans, vendor
quotes. Uses the same storage backend as ticket and knowledge base attachments
(`STORAGE_DRIVER=local` or `s3`), gated by `projects.view` to browse/download and `projects.manage`
to upload/delete.

## Linking tickets and assets

**Project detail** has its own Linked Tickets and Linked Assets sections - pull an existing ticket
or asset in directly, or spawn a brand-new ticket from a task (**Spawn New Ticket** in the task
edit panel). A spawned ticket reuses the same creation path as the Ticketing module (so SLA due
dates compute normally) and, if the task has an assignee, is assigned to them immediately. Either
way, the ticket shows up in the project's linked list - task-spawned tickets aren't a separate,
harder-to-find bucket.

## Permissions (`projects.*`)

| Key | Grants |
|---|---|
| `projects.view` | View projects, tasks, the board, milestones, and attachments |
| `projects.create` | Create projects |
| `projects.manage` | Edit/delete projects, change status, manage team membership, milestones, and attachments, set/change parent project |
| `projects.manage_tasks` | Create/edit tasks, dependencies, board moves, ticket/asset linking |
| `projects.delete_tasks` | Delete tasks - separate from `manage_tasks` so task cleanup can be restricted independently |
| `projects.manage_templates` | Create/edit/delete project templates and their task lists |

## Not built yet (roadmap)

P0 and part of P1 (attachments, sub-projects, templates, milestones) ship now. Tracked for later:

**Should-have (P1)**
- Gantt/timeline view with dependency lines
- Time tracking on tasks, rolled up to total project hours
- Budget field (planned vs. actual) linked to the procurement/contract module
- A project notes/wiki section (linking to the Knowledge Base rather than duplicating it)
- Change Request linkage - blocked on the Change Management module not existing yet
- Notifications on task assignment, due-date approaching, and status changes
- A dedicated project dashboard (burndown, overdue items, cross-project team workload)

**Future (P2)**
- Resource capacity planning across projects (avoid double-booking a technician against the
  helpdesk queue)
- A lightweight risk register per project
- A portfolio view rolling up every active project's health for leadership
- Recurring/program-level projects (e.g. an annual hardware refresh spanning yearly instances)
- Automated status reports generated from task/ticket data on a schedule
- Automation-engine hooks: auto-create a standard task list from a template, auto-update project
  status from linked ticket/change completion
