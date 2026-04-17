import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import notebookRoutes from './routes/notebooks.js';
import labelRoutes from './routes/labels.js';
import noteRoutes from './routes/notes.js';
import { pool } from './db.js';

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
  } catch (e) {
    console.warn('migration warning:', e.message);
  }
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

start();
