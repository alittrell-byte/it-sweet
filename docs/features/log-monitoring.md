# Log Monitoring (Module 3)

Centralized log aggregation, search, live tail, and pattern-based alerting - the "is something
breaking right now" module.

## Getting logs in

Two ingestion paths, see `docs/connecting-servers-to-logs.md` for the full how-to:

- **HTTP ingestion API** (`POST /api/logs/ingest`, per-source API key) - for anything that can
  run a script or an existing shipper (Fluent Bit, a cron job).
- **Syslog UDP** (`LOG_SYSLOG_ENABLED=true`) - for network gear/firewalls that only know how to
  "send syslog to a server." Off by default.

Anything that shows up without a matching registered source lands in an auto-created
"Unregistered" source rather than being dropped.

## Automatic parsing/normalization

Ingested messages are best-effort parsed for common shapes and the results stored as searchable
metadata, without you having to configure anything:

- Generic `key=value` pairs (common in firewall/app logs)
- A source IP, from an explicit `src=`/`ip=`-style field or a bare IPv4 pattern in the message
- Well-known Windows Security event IDs (failed logon, account locked out, etc.) with a
  human-readable label
- nginx/Apache combined log format (client IP, method, path, status)

Search by a specific parsed field via the **Metadata field/value** filter on the search page.

## Search

**Logs → Search** - filter by source, severity, date range, free text, and/or a specific metadata
field/value. Save a search (**Save this search**) to reapply later - personal to each user.

## Live tail

**Logs → Live Tail** - a real-time stream (Server-Sent Events) of new entries as they arrive,
filterable by source/severity, plus a client-side regex **grep** box to narrow what's shown
without touching the backend.

## Dashboard

**Logs → Dashboard** - severity breakdown, top sources, and error-rate-by-hour for the last 24
hours.

## Alert rules

**Logs → Alert Rules** (gated by `logs.manage_alerts`) - fire when a text pattern matches N times
within a time window, optionally scoped to one source/severity. Two ways to express the
condition:

- **Simple threshold**: "N matches in M minutes" (e.g. 5 "disk space critical" lines in 5
  minutes).
- **Correlated threshold**: add a **Group by metadata field** (e.g. `sourceIp`) and it fires only
  when *one* value of that field crosses the threshold - this is what makes "5 failed logins from
  the *same* IP in 2 minutes" possible, as opposed to 5 failed logins spread across 5 different
  IPs.

On fire, a rule can email specific addresses and/or a **Notification Group**, call a webhook, and/
or auto-create a help desk ticket - any combination.

## Retention and archival

**Logs → Sources & Retention** (gated by `logs.manage_retention`) - a global default retention
period in days, with a per-source override. A background sweep purges expired entries hourly (or
hit **Purge Now**). Turn on **Archive to cold storage before purging** to gzip each expiring
batch to the configured storage backend (local disk in dev, S3/MinIO in production) before it's
deleted, instead of losing it outright.

## Per-source access control

By default anyone with `logs.view` sees every source. Restrict a sensitive source (e.g. a
firewall or auth log) to one **Team** on the source's settings - only members of that team (plus
anyone holding `logs.view_all_sources`) can see its entries in search, dashboard, or live tail.

## Asset correlation

Link a log source to the **Asset** it's running on/monitoring - one click from the source's
settings to jump to that device's asset record.

## Permissions (`logs.*`)

| Key | Grants |
|---|---|
| `logs.view` | Search, tail, and view the dashboard |
| `logs.view_all_sources` | Bypass team-based source restrictions |
| `logs.manage_sources` | Register/edit sources and API keys |
| `logs.manage_alerts` | Manage alert rules |
| `logs.manage_retention` | Edit retention settings and trigger purges |

## Known limitation

No packaged Windows Event Log agent ships today - a Windows host reports via the generic HTTP
ingestion API (e.g. a scheduled task calling `Get-WinEvent`/`wevtutil` and POSTing JSON), same as
any other HTTP-ingesting source.
