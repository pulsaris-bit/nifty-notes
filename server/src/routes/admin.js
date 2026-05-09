// Admin-only endpoints. CRITICAL: never expose note content/title here.
// Only aggregates (counts, sizes) per user are returned.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// ---------- Database status ----------
router.get('/stats', async (_req, res) => {
  try {
    const [users, notes, notebooks, labels, shares, versions, dbSize, recent] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS c FROM users'),
      pool.query('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trashed FROM notes'),
      pool.query('SELECT COUNT(*)::int AS c FROM notebooks'),
      pool.query('SELECT COUNT(*)::int AS c FROM labels'),
      pool.query('SELECT COUNT(*)::int AS c FROM note_shares'),
      pool.query('SELECT COUNT(*)::int AS c FROM note_versions'),
      pool.query('SELECT pg_database_size(current_database())::bigint AS b'),
      pool.query("SELECT COUNT(*)::int AS c FROM users WHERE created_at > now() - interval '7 days'"),
    ]);
    res.json({
      users: users.rows[0].c,
      newUsers7d: recent.rows[0].c,
      notes: notes.rows[0].total,
      trashedNotes: notes.rows[0].trashed,
      notebooks: notebooks.rows[0].c,
      labels: labels.rows[0].c,
      shares: shares.rows[0].c,
      versions: versions.rows[0].c,
      databaseBytes: Number(dbSize.rows[0].b),
      serverTime: new Date().toISOString(),
    });
  } catch (e) {
    console.error('admin stats', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/health', async (_req, res) => {
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    res.json({ ok: true, dbLatencyMs: Date.now() - t0, uptimeSec: Math.round(process.uptime()) });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// ---------- Users management ----------
// Returns aggregate per-user counts only — NEVER note title/content.
router.get('/users', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.created_at, u.updated_at,
             COALESCE(r.role::text, 'user') AS role,
             p.display_name, p.avatar_url,
             (SELECT COUNT(*)::int FROM notes n WHERE n.user_id = u.id AND n.deleted_at IS NULL) AS note_count,
             (SELECT COUNT(*)::int FROM notes n WHERE n.user_id = u.id AND n.deleted_at IS NOT NULL) AS trashed_count,
             (SELECT COUNT(*)::int FROM notebooks nb WHERE nb.user_id = u.id) AS notebook_count,
             (SELECT COUNT(*)::int FROM labels l WHERE l.user_id = u.id) AS label_count
      FROM users u
      LEFT JOIN user_roles r ON r.user_id = u.id
      LEFT JOIN profiles p ON p.user_id = u.id
      ORDER BY u.created_at ASC
    `);
    res.json({
      users: rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        noteCount: r.note_count,
        trashedCount: r.trashed_count,
        notebookCount: r.notebook_count,
        labelCount: r.label_count,
      })),
    });
  } catch (e) {
    console.error('admin users', e);
    res.status(500).json({ error: 'Server error' });
  }
});

const updateUserSchema = z.object({
  email: z.string().trim().email().max(255).optional(),
  displayName: z.string().trim().min(2).max(50).optional(),
  role: z.enum(['admin', 'user']).optional(),
});

router.patch('/users/:id', async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, displayName, role } = parsed.data;
  const targetId = req.params.id;
  try {
    if (email !== undefined) {
      const dup = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2', [email, targetId]);
      if (dup.rowCount > 0) return res.status(409).json({ error: 'E-mailadres is al in gebruik.' });
      await pool.query('UPDATE users SET email = $1, updated_at = now() WHERE id = $2', [email, targetId]);
    }
    if (displayName !== undefined) {
      await pool.query('UPDATE profiles SET display_name = $1, updated_at = now() WHERE user_id = $2', [displayName, targetId]);
    }
    if (role !== undefined) {
      // Prevent demoting yourself if you'd be the last admin
      if (targetId === req.userId && role !== 'admin') {
        const { rows: [{ c }] } = await pool.query("SELECT COUNT(*)::int AS c FROM user_roles WHERE role = 'admin'");
        if (c <= 1) return res.status(400).json({ error: 'Je kunt jezelf niet degraderen — je bent de enige admin.' });
      }
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [targetId]);
      await pool.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [targetId, role]);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('admin patch user', e);
    res.status(500).json({ error: 'Server error' });
  }
});

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(12).max(100)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
});

router.post('/users/:id/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Wachtwoord voldoet niet aan eisen (12+ tekens, hoofdletter, cijfer, speciaal teken).' });
  try {
    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    const result = await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [hash, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('admin reset pw', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.userId) return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen.' });
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    res.json({ ok: true });
  } catch (e) {
    console.error('admin delete user', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
