import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(50),
  color: z.string().min(1).max(64),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, color FROM labels WHERE user_id = $1 ORDER BY created_at ASC',
    [req.userId],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { id, name, color } = parsed.data;
  await pool.query(
    'INSERT INTO labels (id, user_id, name, color) VALUES ($1, $2, $3, $4)',
    [id, req.userId, name, color],
  );
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!parsed.data.name) return res.json({ ok: true });
  await pool.query(
    'UPDATE labels SET name = $1 WHERE id = $2 AND user_id = $3',
    [parsed.data.name, req.params.id, req.userId],
  );
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM labels WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
