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
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_notebook_id_idx ON notes(notebook_id);

-- ---------- Note ↔ Label (many-to-many) ----------
CREATE TABLE IF NOT EXISTS note_labels (
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, label_id)
);
CREATE INDEX IF NOT EXISTS note_labels_label_id_idx ON note_labels(label_id);
