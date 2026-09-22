# AWS Beta Deployment Runbook

Hosting the Rivisk backend on one AWS EC2 server, with the web app on Vercel.

```text
                 Vercel (free)                       AWS EC2  t3.medium
             ┌──────────────────┐        ┌──────────────────────────────────────┐
 browser ───▶│ apps/web         │        │ Caddy :443  (automatic HTTPS)        │
             │ rivisk.vercel.app│──API──▶│   api.<IP>.sslip.io ─▶ api     :4000 │
             └──────────────────┘──ws───▶│   ws.<IP>.sslip.io  ─▶ realtime:4001 │
                                         │                                      │
 Hiro Chainhook ───── HTTPS POST ───────▶│ indexer · worker · migrate (one-off) │
                                         │ Postgres · Redis   (private only)    │
                                         └──────────────────────────────────────┘
```

Everything on the server runs from one image and one Compose file
(`infrastructure/deploy/`). Only Caddy publishes ports; Postgres and Redis are
reachable on the private Docker network alone.

**Time:** about 60–90 minutes the first time. **Cost:** about $36/month
(t3.medium ≈ $30, 30 GB disk ≈ $2.40, public IPv4 ≈ $3.65). Traffic is
effectively free: inbound is always free, and the first 100 GB/month outbound is
free. The web app's traffic is Vercel's, not AWS's.

> This is a **beta** shape: one server, no managed database, no redundancy. It is
> the right trade for proving the product works in public. Moving Postgres to RDS
> and the apps to ECS is the path when real users depend on it.

## What you need

| Item | Where |
| --- | --- |
| AWS account | aws.amazon.com |
| Vercel account, linked to GitHub | vercel.com |
| This repo on GitHub | `github.com/TheSoftNode/rivisk` (public) |
| `contracts/settings/Testnet.toml` on your laptop | Only for turning on attestation publishing (step 9) |

No domain is needed: `sslip.io` turns the server's IP into a hostname that
Let's Encrypt will issue a certificate for.

---

## Phase 1 — AWS account (10 minutes)

### 1. Secure the account

1. Sign in as the root user → top-right account menu → **Security credentials**
   → **Assign MFA device**. Use an authenticator app or passkey.
2. Don't create access keys for the root user. Nothing in this runbook needs them.

### 2. Set a budget alert (earns $20 credit)

1. Search **Budgets** → **Create budget** → **Use a template** →
   **Monthly cost budget**.
2. Amount **$40**, your email as recipient → **Create budget**.

You get an email at 85% and 100% of the amount. This is the one safeguard against
a forgotten resource.

### 3. Pick a region

Top-right region selector. Choose one close to you or your reviewers, e.g.
`us-east-1` (N. Virginia) or `eu-west-2` (London). Everything below must be
created **in the same region**.

---

## Phase 2 — The server (15 minutes)

### 4. Launch the instance (earns $20 credit)

**EC2** → **Instances** → **Launch instances**.

| Field | Value |
| --- | --- |
| Name | `rivisk-beta` |
| Application and OS image | **Ubuntu** → **Ubuntu Server 24.04 LTS**, architecture **64-bit (x86)** |
| Instance type | **t3.medium** (2 vCPU, 4 GiB) |
| Key pair | **Create new key pair** → name `rivisk-beta`, type **ED25519**, format **.pem** → downloads once |
| Network settings → Edit | Create security group `rivisk-beta-sg` with the three rules below |
| Configure storage | **30 GiB**, **gp3** |

Security group inbound rules:

| Type | Port | Source | Why |
| --- | --- | --- | --- |
| SSH | 22 | **My IP** | Only you can log in |
| HTTP | 80 | Anywhere (0.0.0.0/0) | Let's Encrypt verification, redirect to HTTPS |
| HTTPS | 443 | Anywhere (0.0.0.0/0) | The API and realtime gateway |

Do **not** open 5432 (Postgres), 6379 (Redis), 4000 or 4001.

**Launch instance.** Keep the `.pem` file safe; it is the only way in. Don't
commit it, email it, or paste it anywhere.

> `t3.micro` has 1 GiB and cannot run the stack. **Accounts on the AWS free
> plan** only offer free-tier types (t3.micro, t3.small, c7i-flex.large,
> m7i-flex.large). There, pick **t3.small** (2 GiB, ≈ $15/month): it runs the
> stack with 2 GiB of swap, but it is too small to build the image, so build it
> on your laptop and ship it — see [Building off the server](#building-off-the-server).

### 5. Give it a fixed IP

**EC2** → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
Select it → **Actions** → **Associate Elastic IP address** → instance
`rivisk-beta` → **Associate**.

Write the address down; it's `<IP>` from here on (for example `3.8.14.201`).
Without an Elastic IP the address changes every time the instance stops, and
every hostname and Chainhook registration would break.

Your two hostnames are now:

```text
api.<IP>.sslip.io     e.g. api.3.8.14.201.sslip.io
ws.<IP>.sslip.io      e.g. ws.3.8.14.201.sslip.io
```

Check they resolve (from your laptop):

```bash
dig +short api.3.8.14.201.sslip.io     # → 3.8.14.201
```

### 6. Connect and prepare the server

From your laptop:

```bash
chmod 400 ~/Downloads/rivisk-beta.pem
ssh -i ~/Downloads/rivisk-beta.pem ubuntu@<IP>
```

On the server:

```bash
# System updates (Ubuntu applies security updates automatically after this)
sudo apt-get update && sudo apt-get -y upgrade

# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# 4 GiB swap: the image build peaks above the 4 GiB of RAM
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

exit   # log out so the docker group applies
```

Reconnect and confirm:

```bash
ssh -i ~/Downloads/rivisk-beta.pem ubuntu@<IP>
docker compose version        # Docker Compose version v2.x
free -h                       # Swap: 4.0Gi
```

### 7. Get the code

```bash
git clone https://github.com/TheSoftNode/rivisk.git ~/rivisk
cd ~/rivisk/infrastructure/deploy
```

---

## Phase 3 — The web app on Vercel (10 minutes)

Done before configuring the server because the API has to know the site's URL
(`WEB_URL`, used for CORS).

### 8. Import the project

1. vercel.com → **Add New** → **Project** → import `TheSoftNode/rivisk`.
2. **Root Directory** → `apps/web`. Vercel detects Next.js and uses npm from
   `apps/web/package-lock.json`.
3. Environment variables (Production):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://api.<IP>.sslip.io/api/v1` |
   | `NEXT_PUBLIC_REALTIME_URL` | `https://ws.<IP>.sslip.io` |
   | `NEXT_PUBLIC_STACKS_NETWORK` | `testnet` |
   | `NEXT_PUBLIC_RISK_POLICY_CONTRACT` | `ST2F3J1PK46D6XVRBB9SQ66PY89P8G0EBDW5E05M7.risk-policy` |

4. **Deploy.** Note the production URL, e.g. `https://rivisk.vercel.app`.

`NEXT_PUBLIC_*` values are baked in at build time. After changing one, use
**Deployments → ⋯ → Redeploy**; saving the variable alone changes nothing.

---

## Phase 4 — Configure and start the backend (20 minutes)

### 9. Generate the production configuration

On the server, in `~/rivisk/infrastructure/deploy`:

```bash
./setup-env.sh api.<IP>.sslip.io ws.<IP>.sslip.io https://rivisk.vercel.app
```

This writes `.env.production` (mode 600) with six fresh random secrets: the
Postgres and Redis passwords, `JWT_SECRET`, `API_KEY_PEPPER`,
`WEBHOOK_ENCRYPTION_KEY` and `CHAINHOOK_AUTH_TOKEN`. They are generated on the
server and never printed.

It refuses to overwrite an existing file on purpose: a new `JWT_SECRET` signs
everyone out, and a new `WEBHOOK_ENCRYPTION_KEY` makes every stored webhook
secret undecryptable.

Optional edits (`nano .env.production`):

| Variable | When |
| --- | --- |
| `WEB_URL` | Add a custom domain, comma-separated: `https://rivisk.vercel.app,https://rivisk.xyz` |
| `STACKS_API_KEY` | A free Hiro key raises rate limits (platform.hiro.so) |
| `COINGECKO_API_KEY` | Higher price-lookup limits |
| `MONITORED_WALLETS` | Wallets to index on every start, for the demo |
| `SMTP_*` | Email alerts; leave empty to disable |

### 10. (Optional) Turn on attestation publishing

Skip this on the first run; come back once everything else is green.

On your **laptop**, in the repo:

```bash
cd contracts
node scripts/export-publisher-key.mjs ../infrastructure/deploy/publisher.env
scp -i ~/Downloads/rivisk-beta.pem ../infrastructure/deploy/publisher.env \
    ubuntu@<IP>:~/rivisk/infrastructure/deploy/publisher.env
rm ../infrastructure/deploy/publisher.env
```

The script derives the key of the authorised publisher
(`ST3YFXHB07XYK0XZWE43JCDBEYFKTR7SXEK41TJ75`) from your local seed file, refuses
if it doesn't match `contracts/deployments/testnet.json`, and writes it with
mode 600 without printing it. The file is gitignored and excluded from the image.

On the **server**:

```bash
chmod 600 publisher.env
sed -i 's/^RISK_PUBLISHER_ENABLED=false/RISK_PUBLISHER_ENABLED=true/' .env.production
```

Every risk snapshot then costs one testnet transaction, paid by the publisher
account. Check its balance on the explorer now and then; testnet STX comes from
the faucet.

### Amazon Linux instead of Ubuntu

If the instance runs Amazon Linux 2023, the user is `ec2-user` and Docker comes
from `dnf`; `get.docker.com` does not support it:

```bash
sudo dnf -y install docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -fsSL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Swap is the same, but use `dd if=/dev/zero of=/swapfile bs=1M count=2048`;
`fallocate` swap files are refused on XFS. Amazon Linux grows the root
filesystem to a resized volume on boot.

### Building off the server

On a 2 GiB instance, build on your laptop (x86_64, or pass
`--platform linux/amd64` on Apple Silicon) and stream the image over SSH:

```bash
docker build -f infrastructure/docker/Dockerfile -t rivisk-backend .
docker save rivisk-backend:latest | gzip -1 | ssh -i <key>.pem <user>@<IP> 'gunzip | docker load'
```

Then start with `--no-build` instead of `--build`, so Compose uses the loaded
image. A redeploy is the same two commands followed by `up -d --no-build`.

### 11. Build and start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

The first build takes 10–15 minutes on a t3.medium. Then:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Expected: `postgres`, `redis`, `api` **healthy**; `indexer`, `worker`,
`realtime`, `caddy` **running**; `migrate` **exited (0)**.

To save typing, add an alias:

```bash
echo "alias rv='docker compose --env-file ~/rivisk/infrastructure/deploy/.env.production -f ~/rivisk/infrastructure/deploy/docker-compose.prod.yml'" >> ~/.bashrc
source ~/.bashrc
rv ps
```

### 12. Verify

From your **laptop**:

```bash
curl https://api.<IP>.sslip.io/api/v1/health
# {"status":"ok","service":"rivisk-api",...}

curl https://api.<IP>.sslip.io/api/v1/health/ready
# {"status":"ready"}

curl https://ws.<IP>.sslip.io/health
# {"status":"ok"}
```

A valid HTTPS response means Caddy got its certificate. Then in the browser:

1. Open the Vercel URL → **Open dashboard** → enter a testnet address → watch it index.
2. Sign in with Leather → **Developers** → create an API key.
3. Interactive API docs: `https://api.<IP>.sslip.io/docs`.

If publishing is on, the worker log shows `risk attestation broadcast` after an
index, and the transaction appears under the registry contract on the explorer:

```bash
rv logs -f worker
```

---

## Phase 5 — Chainhook (15 minutes)

Chainhook makes indexing incremental: when a tracked wallet transacts, Hiro
calls the API and only that wallet is re-read. It also records which on-chain
snapshot id each attestation became.

1. On the server, read the token (it is the one value you have to copy out):

   ```bash
   grep ^CHAINHOOK_AUTH_TOKEN .env.production
   ```

2. On your laptop, in each file under `chainhook/predicates/`, set the callback
   to `https://api.<IP>.sslip.io/api/v1/chainhook/<route>` and the header to
   `Bearer <token>`. **Do not commit these edited copies**; the token is a secret.

   | Predicate | Route | Network |
   | --- | --- | --- |
   | `risk-registry.publish.json` | `risk-registry` | testnet |
   | `risk-policy.updated.json` | `risk-policy` | testnet |
   | `protocol.activity.json` | `protocol` | mainnet (Zest vault) |

3. platform.hiro.so → **Chainhooks** → create one per predicate and upload the file.

4. Test the route and token without waiting for a block:

   ```bash
   curl -X POST https://api.<IP>.sslip.io/api/v1/chainhook/risk-registry \
     -H "Authorization: Bearer <token>" -H 'content-type: application/json' \
     -d '{"apply":[],"rollback":[]}'
   # {"accepted":true,"source":"risk-registry","confirmed":0,...}
   ```

   A `401` means the token doesn't match `.env.production`.

> The server indexes **testnet** (`STACKS_NETWORK=testnet`), so the mainnet Zest
> predicate only matters once the stack is pointed at mainnet. Attestations must
> stay on the same network as the registry: a mainnet block height is rejected by
> the testnet registry (`u103`).

> Hiro has been moving Chainhook to a newer platform API. If the upload rejects
> the predicate format, the receiver doesn't change; only the predicate files do.

---

## Operating it

| Task | Command (on the server) |
| --- | --- |
| Status | `rv ps` |
| Logs | `rv logs -f api` (or `indexer`, `worker`, `realtime`, `caddy`) |
| Deploy a new version | `cd ~/rivisk && git pull && rv up -d --build` |
| Restart one service | `rv restart worker` |
| Stop everything | `rv down` (data volumes are kept) |
| Database shell | `rv exec postgres psql -U rivisk rivisk` |
| Disk usage | `df -h && docker system df` |
| Reclaim old images | `docker image prune -f` |

Migrations run automatically on every `up`: the `migrate` service applies
pending ones and every app waits for it to exit successfully.

### Backups

Postgres is the only state that matters; Redis holds queues that rebuild.

```bash
# Nightly dump at 03:00, keeping 14 days
mkdir -p ~/backups
( crontab -l 2>/dev/null; echo '0 3 * * * docker compose --env-file ~/rivisk/infrastructure/deploy/.env.production -f ~/rivisk/infrastructure/deploy/docker-compose.prod.yml exec -T postgres pg_dump -U rivisk rivisk | gzip > ~/backups/rivisk-$(date +\%F).sql.gz && find ~/backups -name "*.sql.gz" -mtime +14 -delete' ) | crontab -
```

For a copy off the server: **EC2** → **Lifecycle Manager** → create a policy that
snapshots the instance's volume daily and keeps 7. About $0.05/GB-month for
what changes.

Keep `.env.production` backed up somewhere private too (a password manager). A
database restored without the same `WEBHOOK_ENCRYPTION_KEY` has webhook secrets
nobody can decrypt.

### Costs to watch

- **Stopping the instance** stops compute (~$30) but not the disk or the
  Elastic IP (~$6/month together). An Elastic IP that is allocated but not
  attached to anything is still billed.
- **Hiro API** calls are free within limits; add `STACKS_API_KEY` if the indexer
  logs `429`.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `curl` → SSL error / connection refused | Caddy has no certificate yet. `rv logs caddy`. Usually port 80 isn't open to 0.0.0.0/0 (Let's Encrypt verifies over it), or the hostname doesn't resolve to the Elastic IP. |
| Caddy log mentions `rateLimited` | Let's Encrypt limits certificates per domain, and `sslip.io` is shared. Register a cheap domain, point `api.` and `ws.` A-records at the Elastic IP, update `API_HOST`/`REALTIME_HOST`, and `rv up -d`. |
| Build killed, or `exit code 137` | Out of memory. Check swap is on (`free -h`). |
| `migrate` exited with an error | `rv logs migrate`. Usually Postgres wasn't healthy yet; run `rv up -d` again. |
| Browser: `CORS` error | `WEB_URL` doesn't exactly match the site's origin (scheme included, no trailing slash). Fix it, then `rv up -d api realtime`. |
| Dashboard can't reach the API | The Vercel `NEXT_PUBLIC_API_URL` was changed without a redeploy. |
| Chainhook `401` | The `Bearer` token differs from `CHAINHOOK_AUTH_TOKEN`. |
| No attestations | `RISK_PUBLISHER_ENABLED=true` and `publisher.env` present? `rv logs worker`. The publisher needs testnet STX. |
| SSH times out | Your IP changed. **EC2 → Security Groups → rivisk-beta-sg** → edit the SSH rule → **My IP**. |

---

## Security checklist

- [ ] Root account has MFA; no root access keys
- [ ] Security group opens only 22 (your IP), 80 and 443
- [ ] `.env.production` and `publisher.env` are mode 600 and exist only on the server (plus your private backup)
- [ ] Nothing with a secret is committed: the edited Chainhook predicates, `.env.production`, `publisher.env`, the `.pem`
- [ ] Budget alert is active
- [ ] Backups run (`ls ~/backups` the next day)

## Tearing it down

In this order, so nothing keeps billing:

1. **EC2 → Instances** → `rivisk-beta` → **Terminate** (deletes the disk too).
2. **Elastic IPs** → select → **Release** (an unattached IP is still billed).
3. **Snapshots** and **Lifecycle Manager** policies, if you created them.
4. Vercel → project → **Settings** → **Delete**, if you are removing the site.
