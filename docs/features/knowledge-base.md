# Knowledge Base (Module 4)

Internal runbooks and customer-facing help articles, with categories, templates, a draft/review/
publish workflow, and reader feedback.

## Internal vs. external articles

Every article is either **internal** (staff-only, gated by `kb.view_internal`/
`kb.manage_internal`) or **external** (customer-facing, gated by `kb.manage_external`) - separate
permissions so, for example, a support-tier team can write internal runbooks without also being
trusted to publish customer-facing content.

## Draft → review → publish workflow

Articles move through `draft → pending_review → published` (with a `needs_changes` bounce-back).
A writer submits for review; someone with `kb.review_internal`/`kb.review_external` (separate
review permission from the manage/write permission, so writer and reviewer can be different
people) approves it to publish or requests changes with a comment.

## Categories

**Knowledge Base → Categories** (gated by `kb.manage_categories`) - a hierarchical tree (parent/
child), with:
- Delete protection: a category with articles or child categories attached can't be deleted until
  they're reassigned or removed - no silent cascade or orphaning.
- Sorted hierarchically first, alphabetically second, with breadcrumb-style display instead of
  indentation so deep nesting doesn't run out of horizontal space.
- Searching/filtering by a parent category includes its descendant categories' articles too.

## Article templates

**Settings → KB Templates** (gated by `kb.manage_templates`) - pre-built structures for common
article types (e.g. a runbook skeleton) to start a new article from instead of a blank page.

## Runbook checklists

The article editor supports Quill's checklist format - a runbook can have actual checkable
steps, not just a numbered list.

## Article feedback

Readers can mark a published article "Helpful" or "Not helpful" (**bottom of any article view**)
- aggregate counts show on the article for writers to gauge what's actually useful.

## Revisions

Every save creates a revision; **restore** any prior revision from the article's revision history
if a change needs to be undone.

## Attachments

Articles can carry file attachments (diagrams, screenshots, downloadable templates).

## Linking to tickets

An article can be linked from a ticket (see Ticketing docs) to record "this is what resolved it,"
and the article page shows which tickets have referenced it.

## Search

**Knowledge Base → Browse** - full-text search across articles, filterable by space
(internal/external/all) and category, with a "My Drafts" filter for writers checking their own
in-progress work.

## Permissions (`kb.*`)

| Key | Grants |
|---|---|
| `kb.view_internal` | View internal (staff-only) articles |
| `kb.manage_internal` | Create/edit/delete internal articles |
| `kb.manage_external` | Create/edit/delete external (customer-facing) articles |
| `kb.manage_categories` | Manage categories |
| `kb.manage_templates` | Manage article templates |
| `kb.review_internal` | Approve/request-changes on internal articles pending review |
| `kb.review_external` | Approve/request-changes on external articles pending review |

External, published articles are viewable by anyone authenticated (including customers) with no
permission required - only the management/review actions are gated.
