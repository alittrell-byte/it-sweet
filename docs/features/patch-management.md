# Patch Management (Module 5)

Patch/update compliance tracking and reporting. Deliberately **not** a push-deployment system -
there's no remote execution engine anywhere in this platform (no SSH/WinRM, no credential vault).
A lightweight script on each device reports what's installed/missing; this module tracks,
approves, and alerts on that data. See `docs/connecting-patch-agents.md` for the full ingestion
how-to.

## Getting scan data in

Register a **patch agent key** for an asset (its detail page, gated by `patches.manage_agents`),
then have a script on that device `POST` its scan results to `/api/patches/ingest` with that key
- a PowerShell `Get-HotFix` scheduled task, an `apt list --upgradable` cron job, etc.

## The catalog is discovered, not pre-seeded

The first device to report a given patch (identified by platform + vendor/package id, e.g. a
Windows KB number) registers it in the catalog automatically as **pending** - nobody has to
curate a list of every possible patch up front.

## Approval workflow

**Patch Management → Catalog** (gated by `patches.manage_catalog`) - review newly-discovered
patches and **Approve** or **Decline** them. This is a governance/tracking flag only (there's
nothing to push an install), but it matters: only **approved** patches count toward compliance
reporting and overdue alerting, so a patch nobody's reviewed yet doesn't silently ding a device's
compliance score.

## Per-device patch status

Every asset's detail page has a **Patch Status** section showing the latest scan result per
patch (installed/missing/failed/pending reboot), alongside the agent key management action.

## Compliance report

**Patch Management → Compliance Report** - per-asset and fleet-wide compliance percentage among
approved patches (installed vs. missing/failed).

## Overdue alerting

A background sweep flags any asset still missing an **approved, critical**-severity patch more
than `PATCH_OVERDUE_DAYS` (default 14) after it was first seen missing - not after the device's
last check-in, so a device that scans daily but never actually gets the patch still gets flagged.
Notifies any **Notification Group** with "Patch overdue" alerts on and auto-creates a help desk
ticket. Edge-triggered: fires once, clears once the patch is installed (or declined), can re-fire
on a future re-breach.

## Maintenance windows

**Patch Management → Maintenance Windows** (gated by `patches.manage_windows`) - record when
patching is planned for a team, for your own scheduling reference. Informational only; nothing
in this app gates or triggers an install against it.

## Permissions (`patches.*`)

| Key | Grants |
|---|---|
| `patches.view` | View the catalog, compliance report, and maintenance windows |
| `patches.manage_catalog` | Approve or decline patches |
| `patches.manage_agents` | Generate/rotate per-asset agent keys |
| `patches.manage_windows` | Create/edit maintenance windows |
