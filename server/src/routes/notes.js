import { Router } from 'express';
import { z } from 'zod';
import { pool, withTx } from '../db.js';
import { requireAuth } from '../auth.js';
import { publish } from '../lib/events.js';
import {
  fetchOwnedNotes, fetchSharedWithMe, purgeOldTrash, recipientsForNote,
} from '../lib/notes.js';

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

// Active notes (owned + shared with me, excludes trash)
router.get('/', async (req, res) => {
  await purgeOldTrash(req.userId);
  const [owned, shared] = await Promise.all([
    fetchOwnedNotes(req.userId, 'deleted_at IS NULL'),
    fetchSharedWithMe(req.userId),
  ]);
  res.json([...owned, ...shared]);
});

// Trashed notes (owner only — recipients can't trash, only leave)
router.get('/trash', async (req, res) => {
  await purgeOldTrash(req.userId);
  const notes = await fetchOwnedNotes(req.userId, 'deleted_at IS NOT NULL');
  res.json(notes);
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
    publish([req.userId], { type: 'note.created', noteId: n.id });
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
  const originDeviceId = req.headers['x-device-id'] || null;

  try {
    // Determine permission: owner or shared write?
    const { rows } = await pool.query(
      `SELECT n.user_id AS owner_id, n.password,
              s.permission AS share_permission
         FROM notes n
         LEFT JOIN note_shares s ON s.note_id = n.id AND s.recipient_id = $2
        WHERE n.id = $1 LIMIT 1`,
      [req.params.id, req.userId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    const row = rows[0];
    const isOwner = row.owner_id === req.userId;
    const isWriteRecipient = !isOwner && row.share_permission === 'write';
    if (!isOwner && !isWriteRecipient) return res.status(403).json({ error: 'No permission' });

    // Recipients are restricted to title/content only.
    if (!isOwner) {
      const allowed = ['title', 'content'];
      for (const k of Object.keys(u)) {
        if (!allowed.includes(k)) return res.status(403).json({ error: `Recipients cannot change ${k}` });
      }
    }

    // If owner sets a password on a shared note → revoke all shares (encryption breaks sharing).
    let revokedShares = false;
    if (isOwner && u.password && !row.password) {
      const { rowCount } = await pool.query('DELETE FROM note_shares WHERE note_id = $1', [req.params.id]);
      revokedShares = rowCount > 0;
    }

    await withTx(async (c) => {
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
      if (u.labelIds !== undefined && isOwner) {
        await c.query('DELETE FROM note_labels WHERE note_id = $1', [req.params.id]);
        for (const labelId of u.labelIds) {
          await c.query(
            'INSERT INTO note_labels (note_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.params.id, labelId],
          );
        }
      }
    });

    const userIds = await recipientsForNote(req.params.id);
    publish(userIds, {
      type: 'note.updated',
      noteId: req.params.id,
      originDeviceId,
      // Hint to clients which fields changed (so they can be selective).
      fields: Object.keys(u),
    });
    if (revokedShares) {
      publish(userIds, { type: 'share.changed', noteId: req.params.id });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('update note error', e);
    res.status(400).json({ error: e.message });
  }
});

// Soft delete: move to trash (owner only)
router.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE notes SET deleted_at = now() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
    [req.params.id, req.userId],
  );
  if (rowCount > 0) {
    const userIds = await recipientsForNote(req.params.id);
    publish(userIds, { type: 'note.deleted', noteId: req.params.id });
  }
  res.json({ ok: true });
});

router.post('/:id/restore', async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE notes SET deleted_at = NULL WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL',
    [req.params.id, req.userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Note not in trash' });
  publish([req.userId], { type: 'note.created', noteId: req.params.id });
  res.json({ ok: true });
});

router.delete('/:id/permanent', async (req, res) => {
  const userIds = await recipientsForNote(req.params.id);
  await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  publish(userIds, { type: 'note.deleted', noteId: req.params.id });
  res.json({ ok: true });
});

router.post('/trash/purge', async (req, res) => {
  await purgeOldTrash(req.userId);
  res.json({ ok: true });
});

export default router;
