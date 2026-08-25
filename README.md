# Atlas Directory

A React web app for browsing and editing a TEFCA-style organization directory,
modeled on a publicly published FHIR directory implementation guide, running on
top of a HAPI FHIR server.

> **Independent project.** Built by Anscott Consulting LLC as an independent
> reference implementation and learning exercise. It is not a client
> deliverable — it was not commissioned by, produced for, or endorsed by any
> standards organization, governing body, or client, and nothing here
> represents anyone's positions, plans, or roadmap. All sample data is
> synthetic.

## What's here

| Folder     | What it is                                                            |
| ---------- | --------------------------------------------------------------------- |
| `app/`     | The Vite + React + TypeScript front end, plus deploy scripts           |
| `sandbox/` | Docker Compose for a local HAPI FHIR server, and IG packages to load   |
| `tests/`   | A Postman collection exercising NDH profiles against a FHIR server     |

## Running it locally

You need Docker and Node 18+.

### 1. Start the FHIR server

```bash
cd sandbox
docker compose up -d
```

This brings up two containers: `hapi-db` (Postgres 15, port 5432) and
`hapi-fhir` (port 8081). First boot takes a minute or two while HAPI starts its
JVM and installs US Core 6.1.0. Follow along with `docker compose logs -f hapi`.

Confirm it's up:

```bash
curl -s localhost:8081/fhir/metadata | head -c 200
```

> **Heads up:** the sandbox compose file defines no volume for Postgres, so the
> database lives in the container's writable layer. `docker compose down`
> discards your data; `stop` / `start` keeps it.

### 2. Start the app

```bash
cd app
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/fhir/*` to `localhost:8081`, so the
browser makes same-origin requests and CORS never comes up.

### 3. Seed some data

A fresh HAPI is empty. Click **Load sample data** on the dashboard — it POSTs a
transaction Bundle of two QHINs, four Participants, seven Subparticipants, and a
Child, matching the topology of the IG's worked examples.

## What the app does

- **Dashboard** — Organization counts by profile (QHIN / Participant /
  Subparticipant / Child), Endpoint counts, descendant totals per top-level org.
- **Hierarchy** — interactive React Flow graph of the `Organization.partOf` tree,
  color-coded by profile, laid out with Dagre.
- **Directory** — searchable Organization list with profile, active-state, and
  identifier filters.
- **Detail** — full Organization view including contained Endpoint, with buttons
  for `$activate-hierarchy`, `$deactivate-hierarchy`, and `$update-tefcaid`.
- **Create / Edit** — profile-aware form enforcing the IG's structural rules
  client-side: Children can't have Endpoints, QHINs can't have `partOf`, etc.

## Loading the IG packages

`sandbox/` ships the IG packages the app models (`rce.tgz`, `sphd.tgz`). The
compose file only auto-installs US Core, but runtime IG upload is enabled, so
you can push these in through the HAPI UI or `$install` if you want profile
validation.

## Deploying

`app/DEPLOY.md` walks through a single small EC2 box running HAPI, Postgres, and
Caddy in Docker (~$13/month), with the React build served as static files and
basic auth on the FHIR endpoint. `app/deploy/deploy.sh` builds and rsyncs it up.

Before deploying you'll need to fill in two things the repo deliberately doesn't
carry: your own domain and bcrypt hash in `app/deploy/Caddyfile` (it ships with
placeholders), and `app/deploy/.env` copied from `.env.example`.

## Stack

Vite, React 18, TypeScript, Tailwind, React Router, TanStack Query,
React Flow (`@xyflow/react`) with Dagre auto-layout, `@types/fhir`.

## License

Apache License 2.0 — see [LICENSE](LICENSE). Use it, fork it, change it.
