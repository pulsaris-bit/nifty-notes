import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import notebookRoutes from './routes/notebooks.js';
import labelRoutes from './routes/labels.js';
import noteRoutes from './routes/notes.js';
import shareRoutes from './routes/shares.js';
import userRoutes from './routes/users.js';
import eventsRoutes from './routes/events.js';
import { pool } from './db.js';
import { startPresenceSweeper } from './lib/events.js';
import { recipientsForNote } from './lib/notes.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: false }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/notebooks', notebookRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventsRoutes);
// Share routes register paths under /api (e.g. /api/notes/:id/shares and
// /api/notes/shared-with-me/:id), so mount at /api.
app.use('/api', shareRoutes);
// Standard notes routes mounted last so /shared-with-me/* in shares wins routing
// (Express matches by registration order within the same path prefix).
app.use('/api/notes', noteRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

// Wait for DB before listening
async function start() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch {
      console.log('Waiting for database...');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  // Lightweight runtime migrations (idempotent) for existing databases
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()");
    await pool.query("ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ");
    await pool.query("CREATE INDEX IF NOT EXISTS notes_deleted_at_idx ON notes(deleted_at)");
    await pool.query(`DO $$ BEGIN
      CREATE TYPE share_permission AS ENUM ('read', 'write');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS note_shares (
      note_id            TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission         share_permission NOT NULL DEFAULT 'read',
      target_notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (note_id, recipient_id)
    )`);
    await pool.query("CREATE INDEX IF NOT EXISTS note_shares_recipient_idx ON note_shares(recipient_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS note_shares_owner_idx ON note_shares(owner_id)");
  } catch (e) {
    console.warn('migration warning:', e.message);
  }

  startPresenceSweeper(recipientsForNote);
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

start();
