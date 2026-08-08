# Asset Management (Module 2)

Tracks hardware, peripherals, and software licenses through their lifecycle: procurement,
assignment, depreciation, vendor/contract relationships, and audit history.

## Asset types and statuses

Three types: `hardware`, `peripheral`, `software_license` - each behaves a little differently
(see Assignment below). Status: `available`, `in_use`, `retired`, `lost`, `under_repair`,
`ordered`.

## Custom fields

**Settings → Custom Fields** (gated by `assets.manage_custom_fields`) lets you define extra
fields (text/number/date/boolean) beyond the built-in columns - e.g. "Cost Center". A field can
be scoped to one asset type or apply to all of them, and shows up automatically on the create and
detail forms with no code changes.

## Procurement: ordered → received

Create an asset with status `ordered` before it physically arrives (**Assets → + Quick Add**,
check "This has been ordered but not received yet"). Once it shows up, hit **Mark Received** on
the asset detail page - flips status to `available`, stamps the purchase date if it wasn't set
already, and logs the event.

## Assignment and checkout

- **Hardware/peripheral**: one asset = one holder at a time. **Check Out** to a person (with an
  optional due-back date) or to a location/department label; **Check In** to free it up.
- **Software licenses**: a real seat pool - **Assign Seat** any number of times up to (or
  intentionally past, to surface over-allocation) the purchased seat count, and **Check In** a
  specific seat by id without affecting the others still deployed.
- Full assignment history is kept per asset.

## License compliance

**Assets → License Compliance** - purchased vs. currently-deployed seat counts and a
utilization percentage per license, computed live from actual active assignments (not a
manually-maintained number).

## Depreciation

Set a purchase cost, depreciation method (`none` or `straight_line`), and useful life in months
on an asset (edit form on the asset detail page) and **Assets → Depreciation Report** shows
current book value and accumulated depreciation per asset, computed server-side.

## Vendors and contracts

**Settings → Vendors & Contracts** (gated by `assets.manage_vendors` for writes; reads open to
anyone with `assets.view`):
- **Vendors**: name + contact info, linkable to any number of assets.
- **Contracts**: support/maintenance/license/other agreements tied to a vendor and optionally one
  specific asset, with a cost, start/end date, and auto-renew flag. A background sweep emails a
  reminder (and optionally to a **Notification Group** with "Contract renewal" alerts on) once a
  contract's end date is within 30 days - fires once per contract, not every sweep.
- Deleting a vendor with contracts still attached is blocked with a clear error rather than
  silently cascading or orphaning the contracts.

## CSV import/export

**Assets → export.csv** / **import** (gated by `assets.import_export`) - bulk load or export
assets. Vendor is matched/created by name on import so you don't need to know vendor UUIDs.

## Bulk actions

Select multiple assets in the list view to bulk-change status, bulk-set vendor, or bulk-delete in
one action - each item succeeds/fails independently.

## Change history (audit trail)

Every create/update/delete/receive on an asset is logged with a diff of exactly which fields
changed (**asset detail page → Change History**) - the log survives deletion of the asset itself,
so you can still see what happened to something that's been removed.

## Linking to tickets and log sources

An asset can be linked to any number of tickets (see Ticketing docs) and, if the Log Monitoring
module is in use, to the log source that reports on it - one click from the log source's page
jumps to the asset it's monitoring.

## Alerting

License over-allocation and contract renewal both notify any **Notification Group**
(**Settings → Notification Groups**) with the matching alert type turned on - edge-triggered
(fires once when the condition is first crossed, quiet until it clears, can re-fire on a future
re-breach).

## Permissions (`assets.*`)

| Key | Grants |
|---|---|
| `assets.view` | View assets |
| `assets.create` | Create assets |
| `assets.edit` | Edit assets, bulk status/vendor changes, mark received |
| `assets.delete` | Delete assets, bulk delete |
| `assets.assign` | Assign, check out, and check in assets |
| `assets.manage_custom_fields` | Manage custom field definitions |
| `assets.import_export` | Bulk import/export via CSV |
| `assets.manage_vendors` | Manage vendors and contracts |
