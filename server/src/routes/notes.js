import { Router } from 'express';
import { z } from 'zod';
import { pool, withTx } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  id: z.string().min(1).max(64),
  notebookId: z.string().min(1).max(64),
  title: z.string().max(500).default(''),
  content: z.string().max(1_000_000).default(''),
  pinned: z.boolean().default(false),
  archived: z.boolean().default(false),
  password: z.string().max(200).nullable().default(null),
  labelIds: z.array(z.string().max(64)).default([]),
});

const updateSchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(1_000_000).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  password: z.string().max(200).nullable().optional(),
  labelIds: z.array(z.string().max(64)).optional(),
});

function rowToNote(row, labelIds) {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    archived: row.archived,
    password: row.password,
    labelIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  const notes = await pool.query(
    `SELECT id, notebook_id, title, content, pinned, archived, password, created_at, updated_at
     FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.userId],
  );
  if (notes.rows.length === 0) return res.json([]);
  const ids = notes.rows.map((n) => n.id);
  const links = await pool.query(
    `SELECT nl.note_id, nl.label_id
     FROM note_labels nl
     JOIN notes n ON n.id = nl.note_id
     WHERE n.user_id = $1 AND nl.note_id = ANY($2::text[])`,
    [req.userId, ids],
  );
  const byNote = new Map();
  for (const r of links.rows) {
    if (!byNote.has(r.note_id)) byNote.set(r.note_id, []);
    byNote.get(r.note_id).push(r.label_id);
  }
  res.json(notes.rows.map((n) => rowToNote(n, byNote.get(n.id) || [])));
});

router.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const n = parsed.data;
  try {
    await withTx(async (c) => {
      const { rowCount } = await c.query(
        'SELECT 1 FROM notebooks WHERE id = $1 AND user_id = $2',
        [n.notebookId, req.userId],
      );
      if (rowCount === 0) throw new Error('Notebook not found');
      await c.query(
        `INSERT INTO notes (id, user_id, notebook_id, title, content, pinned, archived, password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [n.id, req.userId, n.notebookId, n.title, n.content, n.pinned, n.archived, n.password],
      );
      for (const labelId of n.labelIds) {
        await c.query(
          'INSERT INTO note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [n.id, labelId],
        );
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('create note error', e);
    res.status(400).json({ error: e.message });
  }
});

router.patch('/:id', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const u = parsed.data;
  try {
    await withTx(async (c) => {
      const { rowCount } = await c.query(
        'SELECT 1 FROM notes WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId],
      );
      if (rowCount === 0) throw new Error('Note not found');

      const fields = []; const values = []; let i = 1;
      if (u.title !== undefined)    { fields.push(`title = $${i++}`);    values.push(u.title); }
      if (u.content !== undefined)  { fields.push(`content = $${i++}`);  values.push(u.content); }
      if (u.pinned !== undefined)   { fields.push(`pinned = $${i++}`);   values.push(u.pinned); }
      if (u.archived !== undefined) { fields.push(`archived = $${i++}`); values.push(u.archived); }
      if (u.password !== undefined) { fields.push(`password = $${i++}`); values.push(u.password); }
      if (fields.length > 0) {
        fields.push(`updated_at = now()`);
        values.push(req.params.id);
        await c.query(`UPDATE notes SET ${fields.join(', ')} WHERE id = $${i}`, values);
      }
      if (u.labelIds !== undefined) {
        await c.query('DELETE FROM note_labels WHERE note_id = $1', [req.params.id]);
        for (const labelId of u.labelIds) {
          await c.query(
            'INSERT INTO note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.id, labelId],
          );
        }
      }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('update note error', e);
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  res.json({ ok: true });
});

export default router;
