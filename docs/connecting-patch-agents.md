# Connecting Devices to Patch Management (Module 5)

This guide walks through reporting a device's patch/update status into the help desk's **Patch
Management** module.

**What this module does and doesn't do:** it's a compliance-tracking and reporting layer, not a
push-deployment system. Nothing here reaches out to a device or installs anything - a lightweight
script on each device reports what's installed/missing, the same way `docs/connecting-servers-to-
logs.md`'s HTTP ingestion works for the Logs module. Approval status and maintenance windows are
governance/informational, tracked for your own process, not enforced by this app.

## 1. Register a patch agent key for an asset

Patch status attaches to an existing **Asset** (Assets module) - there's no separate "device"
concept to register.

1. Log in as a user with the `patches.manage_agents` permission.
2. Open the asset's detail page (**Assets → All Assets → pick one**).
3. In the "Patch Status" section, click **Generate Patch Agent Key**. Copy it now - you can rotate
   it later from the same page, but a rotated key immediately invalidates the old one.

## 2. Report a scan

Send a `POST` to `/api/patches/ingest` with the asset's API key in the `x-api-key` header - a
machine-to-machine endpoint, separate from the app's normal user auth.

```bash
curl -X POST https://your-helpdesk-host/api/patches/ingest \
  -H "x-api-key: <asset-patch-agent-key>" \
  -H "Content-Type: application/json" \
  -d '{
        "scans": [
          {
            "platform": "windows",
            "externalId": "KB5031354",
            "title": "2023-10 Cumulative Update for Windows 11",
            "classification": "security",
            "severity": "critical",
            "status": "missing"
          },
          {
            "platform": "windows",
            "externalId": "KB5030310",
            "title": "2023-09 Cumulative Update for Windows 11",
            "classification": "security",
            "severity": "critical",
            "status": "installed"
          }
        ]
      }'
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `platform` | yes | One of `windows`, `linux`, `macos`, `other` |
| `externalId` | yes | Vendor/package identifier - a Windows KB number, a Linux package+version string, etc. Combined with `platform`, this is how the same patch is recognized across devices. |
| `title` | yes | Human-readable name |
| `status` | yes | One of `missing`, `installed`, `failed`, `pending_reboot` |
| `classification` | no | One of `security`, `critical`, `feature`, `other` - defaults to `other` |
| `severity` | no | One of `critical`, `important`, `moderate`, `low` - defaults to `moderate`. Only `critical` severity feeds the overdue-alert sweep. |
| `cveIds` | no | Array of CVE identifier strings, if known |
| `releaseDate` | no | ISO date the patch was released |
| `failureReason` | no | Free text, relevant when `status` is `failed` |

The first device to report a given `(platform, externalId)` registers it in the catalog as
**pending** - review and approve/decline it under **Patch Management → Catalog** before it counts
toward compliance reporting or overdue alerting.

### Example: Windows (PowerShell, scheduled task)

```powershell
$installed = Get-HotFix | Select-Object -ExpandProperty HotFixID
$scans = $installed | ForEach-Object {
  @{ platform = 'windows'; externalId = $_; title = $_; status = 'installed' }
}
$body = @{ scans = $scans } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri 'https://your-helpdesk-host/api/patches/ingest' `
  -Method Post -Headers @{ 'x-api-key' = 'your-asset-api-key' } `
  -ContentType 'application/json' -Body $body
```

(Reporting "known missing" patches requires cross-referencing against a source of truth for what
*should* be installed, e.g. `Get-WindowsUpdate` from the PSWindowsUpdate module - `Get-HotFix`
alone only tells you what's already there.)

### Example: Linux (bash, cron)

```bash
#!/bin/sh
API_KEY="your-asset-api-key"
SCANS=$(apt list --upgradable 2>/dev/null | tail -n +2 | awk -F'/' '{print $1}' | \
  jq -R '{platform:"linux", externalId:., title:., status:"missing"}' | jq -s '{scans:.}')
curl -s -X POST https://your-helpdesk-host/api/patches/ingest \
  -H "x-api-key: $API_KEY" -H "Content-Type: application/json" -d "$SCANS"
```

## 3. Verify it's working

- **Patch Management → Catalog**: newly-discovered patches show up as `pending` - approve or
  decline them.
- The asset's detail page's "Patch Status" section reflects the latest scan per patch.
- **Patch Management → Compliance Report**: once patches are approved, shows per-asset and
  fleet-wide compliance percentage.

## 4. Overdue alerting (optional)

A background sweep (`PATCH_OVERDUE_DAYS`, default 14) flags any asset still missing an
**approved, critical** patch past that many days since it was first seen missing, and notifies any
`NotificationGroup` with "Patch overdue" alerts turned on (**Settings → Notification Groups**),
optionally auto-creating a help desk ticket.

## 5. Maintenance windows (optional)

**Patch Management → Maintenance Windows** lets you record when patching is planned for a team,
for your own scheduling/reference - this app doesn't gate or trigger anything against it.

## Troubleshooting

- **`401` from the ingest endpoint**: the API key is missing, wrong, or was rotated - re-check the
  asset's current key on its detail page.
- **A patch never shows up in the compliance report**: it's still `pending` in the catalog -
  approve it first (only approved patches count toward compliance math or overdue alerts).
