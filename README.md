# Nifty Notes

A self-hostable note-taking app. Two run modes:

- **Mock mode** (default in Lovable preview & `npm run dev`): everything lives in
  `localStorage`, no backend needed.
- **API mode** (Docker): a Postgres database + Express API container, with the
  React app served by nginx and proxying `/api` to the API container.

The app code is the same in both modes — the build-time env var `VITE_API_URL`
flips the switch.

## Quick start (Docker, full stack with Postgres)

This runs three containers: `db` (Postgres 16), `api` (Express + JWT), and
`web` (nginx serving the built React app).

```bash
# Optional: copy the env example and edit secrets
cp .env.example .env

docker compose up -d --build
```

Then open <http://localhost:8080>. The first account you sign up with becomes
`admin` automatically.

To stop and remove containers (data persists in the named volume):

```bash
docker compose down
```

To wipe **all data** (including the database):

```bash
docker compose down -v
```

### Configuration

All settings are env vars (see `.env.example`):

| Variable            | Default                       | Description                                |
| ------------------- | ----------------------------- | ------------------------------------------ |
| `WEB_PORT`          | `8080`                        | Host port for the web UI                   |
| `POSTGRES_USER`     | `notes`                       | Postgres user                              |
| `POSTGRES_PASSWORD` | `notes`                       | Postgres password                          |
| `POSTGRES_DB`       | `notes`                       | Postgres database name                     |
| `JWT_SECRET`        | `change-me-in-production`     | **Change this** in production              |
| `JWT_EXPIRES`       | `7d`                          | Token lifetime                             |

### Architecture in Docker

```
┌──────────┐   :8080    ┌──────────────┐   /api/*   ┌────────────┐
│ Browser  │ ─────────► │  web (nginx) │ ─────────► │  api :4000 │
└──────────┘            └──────────────┘            └─────┬──────┘
                                                          │ pg
                                                          ▼
                                                    ┌──────────┐
                                                    │ db (pg)  │
                                                    └──────────┘
```

The API exposes `/api/auth/{signup,login,me}`, `/api/notebooks`, `/api/labels`,
and `/api/notes`. JWT is sent in the `Authorization: Bearer …` header and
stored in `localStorage` on the client.

### Database schema

See [`server/db/schema.sql`](./server/db/schema.sql). Tables: `users`,
`user_roles` (separate table — never store roles on `users`/`profiles` to avoid
privilege-escalation bugs), `profiles`, `notebooks`, `labels`, `notes`,
`note_labels`. The schema runs automatically on the very first DB container
start (mounted into `/docker-entrypoint-initdb.d/`).

## Mock mode (Lovable preview & local dev)

If `VITE_API_URL` is **not** set at build time (the default for `npm run dev`
and the Lovable preview), the app falls back to its original mock layer:

- Auth lives in `localStorage` (`mock_auth_users`, `mock_auth_session`).
- Notes/notebooks/labels live in component state seeded with demo data.
- The first account created is automatically `admin`.

This way you can keep iterating in Lovable without touching the Docker stack.

## Local development

```bash
npm install
npm run dev
```

To develop against the real API locally:

```bash
# In one shell: start db + api
docker compose up -d db api

# In another shell: run the Vite dev server pointed at the API
VITE_API_URL=http://localhost:4000/api npm run dev
```

(You'll also need to expose port 4000 from the `api` service — add `ports: ["4000:4000"]` to the `api` block in `docker-compose.yml` for local dev.)

## Plain docker (frontend only, mock mode)

If you only want the static frontend with mock data and no backend:

```bash
docker build -t nifty-notes-web --build-arg VITE_API_URL= .
docker run -d --name nifty-notes -p 8080:80 nifty-notes-web
```
