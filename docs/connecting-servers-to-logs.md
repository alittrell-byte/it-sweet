# Connecting Servers to Log Monitoring (Module 3)

This guide walks through getting logs from a real server, network device, or application
flowing into the help desk's **Logs** module - search, live tail, dashboard, and alerting.

There are two ways to ship logs in:

| Method | Best for | Auth |
|---|---|---|
| **HTTP ingestion API** | Anything that can run a script or an existing log shipper (Fluent Bit, Filebeat, a cron job) | Per-source API key |
| **Syslog (UDP)** | Network gear, appliances, anything with built-in "send logs to a syslog server" support and nothing else | None (opt-in, off by default) |

Both land in the same place and are searchable/alertable the same way. You can use either, both, or mix per-device.

## 1. Register a log source

Every log entry belongs to a **source** - this is what you filter/search by and what carries the
API key for HTTP ingestion.

1. Log in as a user with the `logs.manage_sources` permission (the seeded admin has it by default).
2. Go to **Logs → Sources & Retention** in the left sidebar.
3. Under "Register", give it a name (e.g. `web-server-1`, `firewall-core`, `app-backend`) and a type:
   - `http` - for anything pushing to the HTTP ingestion API
   - `syslog` - for anything sending raw syslog over UDP
   - `internal` - reserved for logs the app generates about itself, if you wire that up later
4. Click **Register**. You'll get back an **API key** - copy it now (you can view/rotate it later
   from the same page, but a rotated key immediately invalidates the old one).

You don't have to pre-register a source for syslog UDP sends specifically - anything that shows up
without a matching source lands in an auto-created "Unregistered" source so nothing is lost, but
registering it properly gets you a real name in search/dashboards and its own retention setting.

## 2. Option A - HTTP ingestion

Send a `POST` to `/api/logs/ingest` with your source's API key in the `x-api-key` header. No user
login is involved - this is a machine-to-machine endpoint, separate from the app's normal auth.

### Single entry

```bash
curl -X POST https://your-helpdesk-host/api/logs/ingest \
  -H "x-api-key: <your-source-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
        "severity": "error",
        "message": "disk usage at 95% on /var",
        "host": "web-server-1.internal",
        "metadata": { "mountpoint": "/var", "percentUsed": 95 }
      }'
```

### Batch (up to 1000 entries per request)

```bash
curl -X POST https://your-helpdesk-host/api/logs/ingest \
  -H "x-api-key: <your-source-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
        "entries": [
          { "severity": "info", "message": "request handled in 42ms" },
          { "severity": "warning", "message": "slow query: 1.2s" }
        ]
      }'
```

### Field reference

| Field | Required | Notes |
|---|---|---|
| `message` | yes | The log line/text |
| `severity` | no | One of `emergency`, `alert`, `critical`, `error`, `warning`, `notice`, `info`, `debug` - defaults to `info` |
| `host` | no | Sender hostname/IP, shown in search results |
| `timestamp` | no | ISO 8601; defaults to server receive time if omitted |
| `metadata` | no | Any JSON object - stored as-is, not currently searchable, useful for context when you open an entry |

A successful response looks like `{"ingested": 1}` (or the batch count). A missing/invalid API key
returns `401`; a malformed body returns `400` with details on which field failed validation.

### Wiring up common tools

**A simple script tailing a file (cron or a systemd timer):**

```bash
#!/bin/sh
# ships new lines from an app log every minute - crude but works everywhere
API_KEY="your-source-api-key"
tail -n 200 -F /var/log/myapp/app.log | while read -r line; do
  curl -s -X POST https://your-helpdesk-host/api/logs/ingest \
    -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
    -d "{\"message\": $(printf '%s' "$line" | node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0,"utf8")))')}"
done
```
(For anything beyond trivial volume, use a real log shipper - see below - rather than a loop like this.)

**Fluent Bit** (`fluent-bit.conf`):

```ini
[OUTPUT]
    Name        http
    Match       *
    Host        your-helpdesk-host
    Port        443
    URI         /api/logs/ingest
    Format      json
    tls         on
    Header      x-api-key your-source-api-key
```

**Filebeat** (`filebeat.yml`, using the HTTP output plugin or a small intermediary): Filebeat's
built-in outputs don't include a generic custom-header HTTP output, so the common pattern is
Filebeat → Logstash (or Fluent Bit) → this API. If you only have one or two hosts, the cron+curl
script above or Fluent Bit directly is simpler.

Any tool that can do an HTTP POST with a custom header and a JSON body works the same way - the
endpoint doesn't care what shipped it.

## 3. Option B - Syslog (UDP)

For network gear, firewalls, or anything that only knows how to "send syslog to a server," enable
the built-in syslog receiver instead.

1. In `.env`, set `LOG_SYSLOG_ENABLED=true`.
2. Optionally set `SYSLOG_UDP_PORT` (defaults to the standard `514`) if you need it mapped to a
   different host port.
3. Restart the backend: `docker compose -f docker/docker-compose.yml up -d --build backend`.
4. Point the device at `your-helpdesk-host:514` (UDP) as its syslog server.

The receiver parses standard BSD/RFC3164-style lines (`<PRI>Mon DD HH:MM:SS HOSTNAME message`),
extracting severity from the PRI value and hostname when present. Anything that doesn't match that
shape still comes through - as the raw line, in the "Unregistered" source, with `info` severity.

Example `rsyslog.conf` snippet to forward a Linux server's logs here in addition to local logging:

```
*.* @your-helpdesk-host:514
```

(Use a single `@` for UDP, not `@@` - the built-in receiver is UDP-only today.)

## 4. Verify it's working

- **Logs → Search**: filter by your source name, or search the message text you just sent.
- **Logs → Live Tail**: open this *before* sending a test entry from the device/script - you should
  see it appear within a second or two, no page refresh needed.
- **Logs → Dashboard**: shows severity breakdown, top sources, and error-rate-by-hour for the last
  24 hours once you have some real volume flowing.

## 5. Set retention

By default, entries are kept 30 days (the global default, editable on **Logs → Sources &
Retention**). Give any individual source its own override (e.g. keep firewall logs 90 days, keep a
noisy debug source for only 3) in the same place. A background sweep enforces this hourly, or hit
**Purge Now** to run it immediately.

## 6. Set up an alert (optional)

**Logs → Alert Rules** lets you fire on a text pattern crossing a count threshold within a time
window (optionally scoped to one source and/or severity), and route that to an email, a webhook, an
auto-created help desk ticket, or any combination. See the in-app form for the full field list -
there's nothing here you need external documentation for.

## Troubleshooting

- **`401` from the ingest endpoint**: the API key is missing, wrong, or was rotated - re-check the
  `x-api-key` header against the current key shown on the source's page.
- **Entries not showing up from a syslog device**: confirm `LOG_SYSLOG_ENABLED=true` was set
  *before* the container last started, and that UDP/514 (or your override) actually reaches the
  host - firewalls silently dropping UDP is the most common cause here, and there's no error to see
  on either end since UDP doesn't ack.
  Check `docker logs` on the backend container for `Syslog UDP receiver listening on port ...` to
  confirm it started.
- **Live Tail never updates**: it's a Server-Sent Events stream - if you're running behind a proxy
  other than the bundled nginx config, make sure it doesn't buffer `/api/logs/tail` (the shipped
  `docker/nginx.conf` already disables buffering for that path; a custom reverse proxy in front of
  this stack needs the same treatment, or the tail view will appear to hang).
