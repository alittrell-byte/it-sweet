# Helpdesk Suite

An open-source IT help desk, asset tracking, and ITSM platform. Node/Express + Sequelize backend,
Angular + Tailwind frontend, Postgres or MySQL, dockerized with independent volumes for the
database and for uploaded files.

This repo is being built module by module. **Help Desk/Ticketing, Asset Management, Log
Aggregation & Monitoring, Knowledge Base, Patch Management, Reporting & Insights Hub, and Project
Management** are implemented now, on top of a shared foundation (auth, storage, email, granular
permissions) that every later module reuses. See the [Roadmap](#roadmap) below for what's next,
and [`docs/features/`](docs/features/) for what each module does and how to use it.

## Stack

- **Backend**: Node.js, Express, TypeScript, Sequelize
- **Frontend**: Angular (standalone components), Tailwind CSS
- **Database**: Postgres (default) or MySQL - switch via `DB_DIALECT`, no code changes
- **File storage**: local disk (docker volume) or S3-compatible object storage (AWS S3, MinIO,
  DigitalOcean Spaces, Backblaze, Wasabi, ...) - switch via `STORAGE_DRIVER`
- **Auth**: built-in local accounts by default, or bind against Active Directory / OpenLDAP -
  switch via `AUTH_PROVIDER`
- **Email**: outbound SMTP (any relay/provider) always available; an optional IMAP-based
  email-to-ticket gateway can be turned on separately

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env - at minimum set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to random strings

docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:4000/api
- Mailhog (view outgoing mail in dev): http://localhost:8025
- MinIO console (S3-compatible storage in dev): http://localhost:9001

On first boot the backend runs migrations and seeds an admin account (`SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` in `.env`, defaults to `admin@example.com` / `ChangeMe123!` - **change this**
before exposing the app).

If a default port is already in use on your machine, override it in `.env` (see the "Host port
overrides" section at the bottom of `.env.example`) rather than editing the compose file.

### Switching to MySQL

```bash
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.mysql.yml up -d --build
```

### Switching file storage to S3

Set in `.env`:

```
STORAGE_DRIVER=s3
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ENDPOINT=          # leave blank for real AWS S3; set for MinIO/Spaces/Backblaze/Wasabi
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true   # usually required for MinIO/S3-compatible endpoints
```

### Enabling Active Directory / LDAP login

Set in `.env`:

```
AUTH_PROVIDER=ldap
LDAP_URL=ldaps://ad.example.com
LDAP_BIND_DN=CN=svc-helpdesk,OU=Service Accounts,DC=corp,DC=local
LDAP_BIND_PASSWORD=...
LDAP_SEARCH_BASE=OU=Users,DC=corp,DC=local
LDAP_GROUP_ROLE_MAP={"CN=Helpdesk Admins,...":"admin","CN=IT Techs,...":"technician"}
```

The first successful LDAP bind for a user just-in-time provisions their local account and maps
their directory group membership to an app role (falling back to `LDAP_DEFAULT_ROLE`). Switching
back to `AUTH_PROVIDER=local` at any time re-enables the built-in username/password login using the
local `users` table - the two are not mutually exclusive at the data level, only at the login flow.

### Enabling the email-to-ticket gateway

Off by default (`EMAIL_INBOUND_ENABLED=false`) - outbound SMTP notifications work independently of
this. To turn it on, set `EMAIL_INBOUND_ENABLED=true` and the `IMAP_*` variables for the mailbox to
poll. Replies are matched to existing tickets via a `[Ticket #123]` token in the subject line.

## Local development (without Docker)

```bash
npm install                     # installs both workspaces

cp .env.example .env            # required even though only db/mailhog/minio run here - Compose
                                 # validates every service's env block up front, backend's
                                 # JWT_ACCESS_SECRET/JWT_REFRESH_SECRET included, even for
                                 # services you're not starting
docker compose --env-file .env -f docker/docker-compose.yml up -d db mailhog minio   # just the dependencies

cp .env.example backend/.env    # backend reads its own .env in dev
npm run backend:dev             # http://localhost:4000

npm run frontend:dev            # http://localhost:4200, proxies /api to :4000 (see frontend/proxy.conf.json)
```

Run backend migrations/seed manually in this mode:

```bash
npm run migrate --workspace backend
npm run seed --workspace backend
```

## Tests

```bash
npm run backend:test            # Jest unit + integration tests (needs a reachable Postgres/MySQL;
                                 # set DB_* env vars to point at it, database name gets `_test` appended)
npm run --workspace frontend test   # Angular/Karma unit tests
```

GitHub Actions runs the same checks on every pull request and on pushes to `main`
(`.github/workflows/ci.yml`): the backend build and Jest suite against a throwaway Postgres 16
service, and the frontend production build plus Karma tests in headless Chrome.

## Repository layout

```
backend/    Node/Express/TypeScript API (see backend/src/modules for each feature module)
frontend/   Angular + Tailwind SPA
docker/     Dockerfiles and compose files (Postgres by default, docker-compose.mysql.yml to swap)
docs/       Module-specific how-to guides
```

## Guides

**What each module does and how to use it:**

- [Ticketing](docs/features/ticketing.md)
- [Asset Management](docs/features/asset-management.md)
- [Log Monitoring](docs/features/log-monitoring.md)
- [Knowledge Base](docs/features/knowledge-base.md)
- [Patch Management](docs/features/patch-management.md)
- [Reporting & Insights Hub](docs/features/reporting.md)
- [Project Management](docs/features/project-management.md)

**Integration/setup how-tos:**

- [Installing on Linux](docs/installation-linux.md) - Docker install, configuration, TLS, backups, systemd, production hardening
- [Connecting servers to log monitoring](docs/connecting-servers-to-logs.md) - HTTP ingestion API, syslog UDP, retention, alerting
- [Connecting devices to patch management](docs/connecting-patch-agents.md) - agent key setup, scan reporting

## Roadmap

1. ✅ Help Desk / Ticketing
2. ✅ Asset Management & Tracking
3. ✅ Log Aggregation & Monitoring
4. ✅ IT Documentation / Knowledge Base
5. ✅ Update / Patch Tracking & Management
6. Onboarding / Offboarding Workflows
7. ~~Vendor & Contract Management~~ - folded into Asset Management (vendors, contracts, and
   renewal reminders) rather than a standalone module
8. Change Management (Lightweight)
9. ISP / Connectivity Issue Tracker
10. ✅ Reporting & Insights Hub - pulled forward ahead of Onboarding/Offboarding, Change
    Management, and ISP Tracking, since it ties every existing module together rather than adding
    a new bucket of tickets
11. ✅ Project Management (P0) - not in the original ten; added for IT initiatives (migrations,
    rollouts, hardware refreshes) too large for a single ticket but still built on the same
    tickets/assets data rather than a disconnected PM tool. P1/P2 (Gantt, milestones, templates,
    time tracking, budget, Change Request linkage, portfolio view, ...) tracked in
    [`docs/features/project-management.md`](docs/features/project-management.md), not built yet.

Each module builds on the same shared foundation and lands incrementally.
