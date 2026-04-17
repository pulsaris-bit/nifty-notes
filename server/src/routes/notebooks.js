import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(100),
  icon: z.string().min(1).max(8),
  color: z.string().min(1).max(64),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  icon: z.string().min(1).max(8).optional(),
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, icon, color FROM notebooks WHERE user_id = $1 ORDER BY created_at ASC',
    [req.userId],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { id, name, icon, color } = parsed.data;
  await pool.query(
    'INSERT INTO notebooks (id, user_id, name, icon, color) VALUES ($1, $2, $3, $4, $5)',
    [id, req.userId, name, icon, color],
  );
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const u = parsed.data;
  const fields = []; const values = []; let i = 1;
  if (u.name !== undefined) { fields.push(`name = $${i++}`); values.push(u.name); }
  if (u.icon !== undefined) { fields.push(`icon = $${i++}`); values.push(u.icon); }
  if (fields.length === 0) return res.json({ ok: true });
  values.push(req.params.id, req.userId);
  await pool.query(
    `UPDATE notebooks SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
    values,
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM notebooks WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
