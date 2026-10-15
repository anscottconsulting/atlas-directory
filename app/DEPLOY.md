# Deploying to AWS EC2

This is the cheapest practical deploy for the Atlas Directory app: one small EC2
box running HAPI FHIR, Postgres, and Caddy in Docker. Total cost: ~$13/month.

The React app is served as static files by Caddy. The FHIR endpoint sits
behind Caddy with HTTP basic auth — the browser prompts once per session.

## What you'll need

- An AWS account
- An SSH key pair
- (Optional) A domain name pointing at the box, for free Let's Encrypt TLS
- Docker installed locally (just to generate the bcrypt password hash)

## 1. Launch the EC2 instance

In the AWS console:

1. **EC2 → Launch instance**
2. **Name:** `rce-directory`
3. **AMI:** Amazon Linux 2023 (ARM)
4. **Instance type:** `t4g.small` (2 vCPU, 2 GB RAM, ~$12/mo) — `t4g.micro` is too small for HAPI's JVM
5. **Key pair:** select or create one
6. **Network settings:** create a security group that allows
   - SSH (port 22) from your IP only
   - HTTP (port 80) from anywhere
   - HTTPS (port 443) from anywhere (only needed if you're using a domain)
7. **Storage:** 20 GB gp3 (plenty for a sandbox)
8. **Launch**

Once it's up, grab the public IPv4 address.

## 2. Install Docker on the box

SSH in:

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<public-ip>
```

Then on the box:

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
# Install the docker-compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```

Log out and back in so the group membership takes effect, then verify:

```bash
docker compose version
```

### Add a swap file

HAPI needs about 1.1 GB once it has loaded the RCE profiles for Level 1
validation, which leaves a `t4g.small` with very little free memory and no
swap. A 2 GB swap file lets a memory spike spill to disk instead of the
kernel killing a container:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # keep it after reboots
free -m                                                      # Swap line should show 2047
```

Swap is much slower than RAM. If the site gets sluggish and `free -m` shows
swap in steady use, move to a `t4g.medium` (4 GB) instead.

## 3. Generate the basic-auth password hash

On your laptop (anywhere with Docker):

```bash
docker run --rm caddy:2 caddy hash-password --plaintext 'pick-a-real-password'
```

Copy the output (starts with `$2a$14$...`) and paste it into
`deploy/Caddyfile` in place of `$2a$14$REPLACE_ME_WITH_A_REAL_BCRYPT_HASH`.

The username is `admin` by default — change it in the Caddyfile if you like.

## 4. (Optional) Point a domain at the box

If you want HTTPS instead of plain HTTP:

1. Create an A record for e.g. `rce.example.com` pointing at the EC2 public IP
2. In `deploy/Caddyfile`, change `:80 {` to `rce.example.com {`
3. Caddy will fetch a Let's Encrypt cert automatically on first start

Without a domain, you'll get HTTP on the raw IP — fine for a sandbox, but
browsers will warn you and basic-auth credentials travel in cleartext.

## 5. Create your .env file

```bash
cp deploy/.env.example deploy/.env
# edit deploy/.env and set POSTGRES_PASSWORD to anything
```

## 6. Deploy

From the project root on your laptop:

```bash
EC2_HOST=ec2-user@<public-ip> ./deploy/deploy.sh
# or with an explicit SSH key:
EC2_HOST=ec2-user@<public-ip> SSH_KEY=~/.ssh/your-key.pem ./deploy/deploy.sh
```

The script runs `npm run build`, rsyncs the static build, compose files and
the RCE/SPHD IG packages (from `../sandbox/`) to the box, and runs
`docker compose up -d`. First run takes a few minutes because Docker has to
pull the HAPI image (~500 MB), and HAPI installs the IG packages on startup.

## 7. Verify

Open `http://<public-ip>/` in a browser. You should see the dashboard.

Click "Load sample data". The browser will prompt for basic auth credentials
(`admin` + the password you hashed). After you enter them, the seed bundle
posts and the dashboard fills in.

## Day-to-day

- **Code changes:** edit locally, re-run `./deploy/deploy.sh` — it's
  idempotent and only restarts Caddy if the static files changed.
- **Logs:** `ssh <host> "cd ~/rce-directory && docker compose logs -f hapi"`
- **Backups:** `ssh <host> "docker exec rce-directory-postgres-1 pg_dump -U hapi hapi" > backup.sql`
- **Stop the box** when not using it: AWS console → Instances → Stop. You
  still pay for the EBS volume (~$2/mo) but not the compute. Start it again
  when you want to demo.
- **Nuke and recreate:** `ssh <host> "cd ~/rce-directory && docker compose down -v"`
  wipes Postgres and HAPI data. Re-deploy from scratch.

## Notes & gotchas

- **CORS:** not an issue because Caddy serves both the frontend and the
  FHIR endpoint from the same origin. Browser sees same-origin requests.
- **Basic auth in the React app:** no code changes needed. The browser
  prompts on the first `/fhir/*` request, caches the credentials for the
  session, and sends them automatically afterward.
- **HAPI startup:** HAPI takes 30–60 seconds to boot on first run while
  it provisions the schema. Watch `docker compose logs -f hapi`.
- **Bots will find your endpoint.** Even with basic auth, expect probes.
  Caddy logs them to `/data/access.log` inside the container.
