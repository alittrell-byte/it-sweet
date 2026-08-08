# Installing on Linux

This walks through getting the full stack running on a Linux server via Docker - the same
`docker compose` setup used in development, sized up for a real deployment. It assumes a fresh
Ubuntu/Debian or RHEL-family (Rocky, AlmaLinux, Fedora) server with a regular user account that
has `sudo`.

## 1. Prerequisites

- A Linux server (2 vCPU / 4GB RAM is plenty to start; Postgres, the backend, and the frontend
  are all lightweight at small-to-medium scale).
- A domain name pointed at the server, if you want it reachable over the internet rather than
  just on your local network (not required to get started).
- Ports **4200** (app) and **4000** (API) free by default - both are overridable, see step 3.
  If you plan to accept raw syslog from network gear, port **514/udp** as well (off by default).

## 2. Install Docker

**Ubuntu/Debian:**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker   # or log out and back in
```

**RHEL/Rocky/AlmaLinux/Fedora:**

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
```

Confirm it worked:

```bash
docker compose version   # should print a v2.x version, not "command not found"
```

## 3. Get the code and configure it

```bash
git clone <this repo's URL> helpdesk
cd helpdesk
cp .env.example .env
```

Edit `.env`. At minimum, before starting anything:

| Setting | Why it matters |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Required - the app won't start without real values. Generate two with `openssl rand -base64 48` and paste them in; don't reuse one for both. |
| `FRONTEND_URL` | Set to how users will actually reach the app (e.g. `https://helpdesk.yourcompany.com`). This also sets the CORS allow-origin automatically - leaving it as `localhost:4200` will break login from any other address. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The first admin account, created on first boot. Change the password from the example default before exposing this to anyone. |
| `DB_PASSWORD` | Change from the example default for anything beyond a local trial. |

Everything else in `.env.example` has a working default for a self-contained deployment
(local Postgres, local file storage, Mailhog for outbound mail) - come back to the [Production
hardening](#production-hardening) section below once the basic install is confirmed working.

## 4. Start it

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

First boot runs database migrations and seeds the admin account automatically - watch it happen:

```bash
docker compose --env-file .env -f docker/docker-compose.yml logs -f backend
```

Look for `Backend listening on port 4000`. Then:

```bash
curl -s http://localhost:4000/api/health   # {"status":"ok"}
```

Open `http://<server-address>:4200` (or your configured `FRONTEND_PORT`) in a browser and log in
with the seeded admin credentials.

**Change the admin password immediately** (Account → Change Password, top-left of the app) if you
didn't already override `SEED_ADMIN_PASSWORD` before first boot.

## 5. Put a reverse proxy with TLS in front

The bundled nginx (inside the `frontend` container) serves the app and proxies `/api/*` to the
backend, but it does **not** terminate TLS - it's meant to sit behind something that does. For a
real deployment, put a TLS-terminating proxy in front of port 4200 rather than exposing it
directly. [Caddy](https://caddyserver.com/) is the least fuss (automatic Let's Encrypt certs, no
config file needed for a simple case):

```bash
# after installing Caddy from your distro's package manager or caddyserver.com's instructions
sudo tee /etc/caddy/Caddyfile <<'EOF'
helpdesk.yourcompany.com {
    reverse_proxy localhost:4200
}
EOF
sudo systemctl reload caddy
```

nginx + certbot works the same way if you'd rather standardize on nginx everywhere - proxy
`https://` on 443 back to `http://localhost:4200`, same as any other app behind nginx.

Once TLS is in front, update `FRONTEND_URL` in `.env` to the `https://` address and restart the
backend (`docker compose --env-file .env -f docker/docker-compose.yml up -d backend`) so CORS matches.

## 6. Data persistence and backups

Three named Docker volumes hold everything that matters:

| Volume | Contents |
|---|---|
| `db_data` | The Postgres database - tickets, assets, users, everything relational. |
| `file_storage` | Uploaded files (ticket/KB attachments, log archives) when `STORAGE_DRIVER=local` (the default). Not used if you switch to S3 - see below. |
| `minio_data` | Only relevant if you're using the bundled MinIO container as your S3-compatible store, rather than pointing `STORAGE_DRIVER=s3` at real AWS S3/Spaces/etc. |

Back up the database with `pg_dump` rather than copying the volume directly, so you get a
consistent snapshot:

```bash
docker compose --env-file .env -f docker/docker-compose.yml exec db \
  pg_dump -U helpdesk helpdesk > "backup-$(date +%F).sql"
```

Restore into a fresh instance with `psql -U helpdesk helpdesk < backup-2026-08-08.sql`. Back up
the `file_storage` volume (or your S3 bucket, if you switched to it) separately - a database
backup alone won't include attachment contents.

## 7. Updating

```bash
cd helpdesk
git pull
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

Migrations run automatically on every backend container start, including updates - there's no
separate migration step to remember.

## Production hardening

None of this is required to get running, but worth doing before this becomes the system of
record for a real team:

- **Switch to MySQL** instead of the bundled Postgres, if that's your organization's standard:
  `docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.mysql.yml up -d --build`.
- **Switch file storage to S3** (AWS S3, MinIO elsewhere, DigitalOcean Spaces, Backblaze, Wasabi)
  instead of the local Docker volume - set `STORAGE_DRIVER=s3` and the `S3_*` variables in `.env`.
  Leave `S3_ENDPOINT` blank for real AWS S3; set it for anything S3-compatible.
- **Bind against Active Directory/OpenLDAP** instead of local accounts - set `AUTH_PROVIDER=ldap`
  and the `LDAP_*` variables. Existing local accounts keep working; this adds LDAP as an
  additional login path and role-mapping source, it doesn't require migrating existing users.
- **Point outbound email at a real SMTP relay** (not the bundled Mailhog, which only exists for
  local dev - nothing it "sends" ever leaves the container) - set `SMTP_HOST`/`SMTP_PORT`/
  `SMTP_USER`/`SMTP_PASSWORD` and `EMAIL_FROM`.
- **Enable the email-to-ticket gateway**, if wanted: `EMAIL_INBOUND_ENABLED=true` plus the
  `IMAP_*` variables for a mailbox the backend polls.
- **Run it as a systemd-managed service** so the stack survives a host reboot without a login:

  ```ini
  # /etc/systemd/system/helpdesk.service
  [Unit]
  Description=Helpdesk (docker compose)
  Requires=docker.service
  After=docker.service

  [Service]
  Type=oneshot
  RemainAfterExit=yes
  WorkingDirectory=/path/to/helpdesk
  ExecStart=/usr/bin/docker compose --env-file .env -f docker/docker-compose.yml up -d
  ExecStop=/usr/bin/docker compose --env-file .env -f docker/docker-compose.yml down

  [Install]
  WantedBy=multi-user.target
  ```

  ```bash
  sudo systemctl enable --now helpdesk
  ```

  (Docker's own restart policies already bring individual containers back up after a crash;
  this unit is specifically about surviving a full host reboot, since `docker compose up -d`
  doesn't run itself automatically at boot without something like this.)

- **Firewall**: only 4200 (or 443 if you put TLS in front of it) needs to be reachable from
  outside the server. 4000 (the raw API), 5432 (Postgres), 9000/9001 (MinIO) should stay bound to
  localhost or an internal network - don't expose them publicly. If you're not using syslog
  ingestion, leave `LOG_SYSLOG_ENABLED=false` (the default) rather than opening 514/udp.

## Troubleshooting

- **Backend container keeps restarting**: `docker compose --env-file .env -f docker/docker-compose.yml logs
  backend` - almost always either a missing `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (the app
  refuses to start without them) or the database not being ready yet on the very first boot
  (it retries automatically; give it a few seconds).
- **Can't log in / CORS errors in the browser console**: `FRONTEND_URL` in `.env` doesn't match
  the address you're actually using to reach the app. Fix it and restart the backend.
- **Uploads/attachments failing**: if `STORAGE_DRIVER=s3`, double check `S3_ENDPOINT`,
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`, and that the bucket in `S3_BUCKET` actually exists -
  this app doesn't create the bucket for you.
- **A port is already in use on the host**: override it in `.env` rather than editing the compose
  file directly - see the "Host port overrides" section at the bottom of `.env.example`
  (`FRONTEND_PORT`, `BACKEND_PORT`, `DB_HOST_PORT`, etc.).
