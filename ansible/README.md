# Ansible: deploying the helpdesk app

Automates what [`docs/installation-linux.md`](../docs/installation-linux.md) walks through by
hand: install Docker, get the app onto the server, configure it, bring it up, and put Caddy in
front with TLS. One server, one playbook run.

You don't need one on the target server. `docker compose up -d --build` builds the app's images
*from source*, so the target needs real repo content present - but rather than have it `git
clone` the private repo itself (which would need its own deploy key or token), this playbook
**pushes** files from a checkout that already exists on your **control node** (wherever you run
`ansible-playbook` from - your laptop, a CI runner). You already have git access there. Point
`helpdesk_repo_src` at that local clone and the playbook rsyncs it to the target over the same SSH
connection Ansible already uses for everything else. The target never touches git.

## One-time control node setup

Ansible's control node needs a POSIX shell - it doesn't run natively on Windows. If you're on
Windows, use WSL.

```bash
pip install --user ansible
sudo apt install -y rsync   # or: sudo dnf install -y rsync
cd ansible
ansible-galaxy collection install -r requirements.yml
```

`rsync` matters here specifically because `ansible.posix.synchronize` (what pushes the app source
to the target) runs the actual `rsync` process **on the control node** - not through the target's
Python interpreter like most modules - so it has to be on the control node's own PATH, not just
the target's. The `helpdesk_app` role installs it on the target automatically; it can't install it
on the control node for you (chicken-and-egg - that's the machine running the playbook).

## Configure

```bash
cp group_vars/helpdesk/vars.yml.example group_vars/helpdesk/vars.yml
cp group_vars/helpdesk/vault.yml.example group_vars/helpdesk/vault.yml
```

Both files live in `group_vars/helpdesk/` (not flat `group_vars/<name>.yml`) on purpose - Ansible
only auto-loads vars from a `group_vars/<inventory-group-name>.yml` file *or* every file inside a
`group_vars/<inventory-group-name>/` directory. Since the inventory group is `helpdesk`
(`inventory.ini`'s `[helpdesk]`), splitting plain vars and vault secrets into two files only works
inside `group_vars/helpdesk/` - a same-named flat file elsewhere in `group_vars/` is silently never
loaded, which is an easy mistake to make (and was one - an earlier version of this laid the two
files flat as `group_vars/helpdesk.yml` + `group_vars/vault.yml`, and the latter was never read).

Edit both - `vars.yml` is plain (non-secret settings, including `helpdesk_repo_src`, the local
path to your existing `helpdesk` checkout), `vault.yml` holds the JWT secrets / DB password / seed
admin password. Encrypt the vault file once real values are in it:

```bash
ansible-vault encrypt group_vars/helpdesk/vault.yml
```

You'll be prompted for a vault password each run (`--ask-vault-pass`), or keep one in a file
outside git and pass `--vault-password-file=path/to/that/file` (this repo's `.gitignore` already
excludes `group_vars/vault_pass.txt` if you name it that).

Edit `inventory.ini` with the real target server's address and SSH user.

Point `helpdesk_domain` (in `vars.yml`) at a domain with a DNS A/AAAA record already pointing
at the target server - Caddy's automatic Let's Encrypt certificate needs that to succeed. No
public domain yet? Run just the `helpdesk_app` role for now (`--tags` isn't set up since there are
only two roles - comment `caddy_proxy` out of `site.yml`'s `roles:` list temporarily) and see
[`docs/certificates.md`](../../helpdesk-agents/docs/certificates.md) for the internal-only/private
CA path once you're ready to add TLS a different way.

## Run it

```bash
ansible-playbook site.yml --ask-vault-pass
```

Idempotent - re-run any time (after a `git pull` locally, a config change, or just to confirm
nothing's drifted). It re-syncs the app source, re-templates `.env` and the Caddyfile, and re-runs
`docker compose up -d --build`, which only actually rebuilds/recreates what changed.

Verify:

```bash
curl -s http://<target-server>:4000/api/health   # {"status":"ok"}
curl -s https://<helpdesk_domain>/api/health     # once Caddy/DNS/TLS are all in place
```

## What this doesn't do

- **Doesn't touch DNS.** Point `helpdesk_domain` at the server's IP yourself before the first run
  with Caddy enabled.
- **Doesn't manage backups.** See `docs/installation-linux.md` §6 (`pg_dump`) - still a manual or
  separately-cronned step.
- **Doesn't cover MySQL/S3/LDAP.** The default path (Postgres, local file storage, local auth)
  covers `env.j2`; if you need one of those switches, add the relevant variables to
  `group_vars/helpdesk/vars.yml(.example)` and `roles/helpdesk_app/templates/env.j2` following the
  pattern already there - see `docs/installation-linux.md`'s "Production hardening" section for
  which `.env` keys each switch needs.
- **Doesn't install the log/patch agents.** Those are a separate side project
  ([`helpdesk-agents`](../../helpdesk-agents)) with their own install docs, unrelated to this
  playbook.
