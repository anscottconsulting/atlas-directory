# Atlas Directory — app

A React web app that sits on top of a local HAPI FHIR server, modeling the directory IG's organization hierarchy.

## What it does

- **Dashboard** — counts of Organizations by profile (QHIN / Participant / Subparticipant / Child), Endpoint counts, descendant totals per top-level org.
- **Hierarchy** — interactive React Flow graph of the `Organization.partOf` tree, color-coded by profile.
- **Directory** — searchable list of all Organizations with profile, active state, identifier filters.
- **Detail** — full Organization view including contained Endpoint, with action buttons for `$activate-hierarchy`, `$deactivate-hierarchy`, and `$update-tefcaid`.
- **Create / Edit** — profile-aware form: Children can't have Endpoints, QHINs can't have `partOf`, etc. Client-side rules enforce the IG's structural constraints.

## Prereqs

A local HAPI FHIR server on `http://localhost:8081/fhir`. Start one from the
sandbox folder in this repo:

```bash
cd ../sandbox && docker compose up -d
```

That gives you `hapi-fhir` (hapiproject/hapi, 8081:8080) and `hapi-db`
(postgres:15, 5432:5432). See the root README for the full walkthrough.

## Run it

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>.

The Vite dev server proxies `/fhir/*` to `http://localhost:8081/fhir/*`, so the
browser app makes same-origin requests and CORS is a non-issue.

## Seed the server

If your HAPI is empty (it will be on first boot), click **Load sample data** on
the dashboard. It POSTs a transaction Bundle with two QHINs, four Participants,
seven Subparticipants, and a Child — matching the topology of the IG's worked
examples.

## Stack

Vite, React 18, TypeScript, Tailwind, React Router, TanStack Query, React Flow
(`@xyflow/react`) with Dagre auto-layout, Zod for form validation, `@types/fhir`
for typed resources.

## Project layout

```
src/
  lib/           FHIR client, profile/extension/operation constants, sample data
  hooks/         TanStack Query hooks
  components/    Layout, badges, shared UI
  pages/         Dashboard, Hierarchy, Directory list, Detail, Form
```
