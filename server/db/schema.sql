-- Nifty Notes — database schema
-- Runs once on first container start (mounted in /docker-entrypoint-initdb.d/)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Roles enum ----------
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---------- Users (auth) ----------
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Backfill column for existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Roles in a separate table (security best practice)
CREATE TABLE IF NOT EXISTS user_roles (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- ---------- Profiles (extended) ----------
CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  bio          TEXT,
  theme        TEXT NOT NULL DEFAULT 'dark',
  language     TEXT NOT NULL DEFAULT 'nl',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Notebooks ----------
CREATE TABLE IF NOT EXISTS notebooks (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notebooks_user_id_idx ON notebooks(user_id);

-- ---------- Labels ----------
CREATE TABLE IF NOT EXISTS labels (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS labels_user_id_idx ON labels(user_id);

-- ---------- Notes ----------
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL DEFAULT '',
  pinned      BOOLEAN NOT NULL DEFAULT false,
  archived    BOOLEAN NOT NULL DEFAULT false,
  password    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
-- Backfill column for existing databases
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_notebook_id_idx ON notes(notebook_id);
CREATE INDEX IF NOT EXISTS notes_deleted_at_idx ON notes(deleted_at);

-- ---------- Note ↔ Label (many-to-many) ----------
CREATE TABLE IF NOT EXISTS note_labels (
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, label_id)
);
CREATE INDEX IF NOT EXISTS note_labels_label_id_idx ON note_labels(label_id);

-- ---------- Note shares ----------
DO $$ BEGIN
  CREATE TYPE share_permission AS ENUM ('read', 'write');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS note_shares (
  note_id            TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission         share_permission NOT NULL DEFAULT 'read',
  -- Optional: notebook (of the recipient) where this shared note appears.
  -- NULL means the recipient hasn't picked a notebook yet → shows in "Gedeeld met mij".
  target_notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS note_shares_recipient_idx ON note_shares(recipient_id);
CREATE INDEX IF NOT EXISTS note_shares_owner_idx ON note_shares(owner_id);

-- ---------- Note versions (history) ----------
-- Snapshots of (title, content) taken just before a note is updated.
-- We keep at most 5 versions per note (oldest are pruned automatically).
CREATE TABLE IF NOT EXISTS note_versions (
  id         BIGSERIAL PRIMARY KEY,
  note_id    TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON note_versions(note_id, created_at DESC);
