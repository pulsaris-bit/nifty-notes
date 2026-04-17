# Nifty Notes

A self-hostable note-taking app. Runs fully in the browser with a mock auth + storage layer (localStorage), so it works out of the box without any backend.

## Run with Docker

The repo ships with a multi-stage `Dockerfile` (Node build → nginx serve) and a `docker-compose.yml`.

### Using docker compose (recommended)

```bash
docker compose up -d --build
```

Then open <http://localhost:8080>.

To stop:

```bash
docker compose down
```

### Using plain docker

```bash
docker build -t nifty-notes .
docker run -d --name nifty-notes -p 8080:80 nifty-notes
```

### Changing the port

Edit the `ports` mapping in `docker-compose.yml` (e.g. `"3000:80"` to expose on port 3000).

## Mock environment (Lovable preview)

The app uses a mock auth + data layer that lives entirely in the browser
(`localStorage`). This means:

- The Lovable preview keeps working with no backend changes.
- The Docker container also runs the same mock setup — every visitor gets their
  own local data in their own browser.
- The first account created is automatically promoted to `admin`.

When you're ready to move to a real backend (persistent users, shared data),
enable Lovable Cloud and we can swap the mock hooks for real API calls without
changing the UI.

## Local development

```bash
npm install
npm run dev
```
