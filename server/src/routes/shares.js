import { Router } from 'express';
import { z } from 'zod';
import { pool, withTx } from '../db.js';
import { requireAuth } from '../auth.js';
import { publish } from '../lib/events.js';
import { recipientsForNote } from '../lib/notes.js';

const router = Router();
router.use(requireAuth);

const createShareSchema = z.object({
  recipientEmail: z.string().trim().email().max(255),
  permission: z.enum(['read', 'write']),
});

const updateShareSchema = z.object({
  permission: z.enum(['read', 'write']),
});

const setNotebookSchema = z.object({
  targetNotebookId: z.string().min(1).max(64).nullable(),
});

// Helper — verify the requester owns the note and it's not encrypted.
async function loadOwnedNote(noteId, userId) {
  const { rows } = await pool.query(
    'SELECT id, user_id, password FROM notes WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [noteId],
  );
  if (rows.length === 0) return { error: 'Notitie niet gevonden', status: 404 };
  if (rows[0].user_id !== userId) return { error: 'Geen toegang', status: 403 };
  return { note: rows[0] };
}

// List shares of a note (owner only)
router.get('/notes/:id/shares', async (req, res) => {
  const owned = await loadOwnedNote(req.params.id, req.userId);
  if (owned.error) return res.status(owned.status).json({ error: owned.error });
  const { rows } = await pool.query(
    `SELECT s.recipient_id, u.email, COALESCE(p.display_name, u.email) AS display_name,
            s.permission, s.created_at
     FROM note_shares s
     JOIN users u ON u.id = s.recipient_id
     LEFT JOIN profiles p ON p.user_id = s.recipient_id
     WHERE s.note_id = $1
     ORDER BY s.created_at ASC`,
    [req.params.id],
  );
  res.json(rows.map((r) => ({
    recipientId: r.recipient_id,
    email: r.email,
    displayName: r.display_name,
    permission: r.permission,
    createdAt: r.created_at,
  })));
});

// Create a share
router.post('/notes/:id/shares', async (req, res) => {
  const parsed = createShareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const owned = await loadOwnedNote(req.params.id, req.userId);
  if (owned.error) return res.status(owned.status).json({ error: owned.error });
  if (owned.note.password) {
    return res.status(400).json({ error: 'Versleutelde notities kunnen niet worden gedeeld.' });
  }

  const { rows: rec } = await pool.query(
    'SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1',
    [parsed.data.recipientEmail],
  );
  if (rec.length === 0) return res.status(404).json({ error: 'Geen gebruiker met dit e-mailadres.' });
  if (rec[0].id === req.userId) return res.status(400).json({ error: 'Je kunt niet met jezelf delen.' });

  await pool.query(
    `INSERT INTO note_shares (note_id, owner_id, recipient_id, permission)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (note_id, recipient_id)
     DO UPDATE SET permission = EXCLUDED.permission`,
    [req.params.id, req.userId, rec[0].id, parsed.data.permission],
  );

  // Notify owner devices + new recipient.
  const userIds = await recipientsForNote(req.params.id);
  publish(userIds, { type: 'share.changed', noteId: req.params.id });
  res.json({ ok: true });
});

// Update permission
router.patch('/notes/:id/shares/:recipientId', async (req, res) => {
  const parsed = updateShareSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const owned = await loadOwnedNote(req.params.id, req.userId);
  if (owned.error) return res.status(owned.status).json({ error: owned.error });
  await pool.query(
    'UPDATE note_shares SET permission = $1 WHERE note_id = $2 AND recipient_id = $3',
    [parsed.data.permission, req.params.id, req.params.recipientId],
  );
  const userIds = await recipientsForNote(req.params.id);
  publish(userIds, { type: 'share.changed', noteId: req.params.id });
  res.json({ ok: true });
});

// Revoke a share (owner)
router.delete('/notes/:id/shares/:recipientId', async (req, res) => {
  const owned = await loadOwnedNote(req.params.id, req.userId);
  if (owned.error) return res.status(owned.status).json({ error: owned.error });
  // Capture recipients BEFORE delete so the soon-to-be-removed recipient also gets notified.
  const userIds = await recipientsForNote(req.params.id);
  await pool.query(
    'DELETE FROM note_shares WHERE note_id = $1 AND recipient_id = $2',
    [req.params.id, req.params.recipientId],
  );
  publish(userIds, { type: 'share.changed', noteId: req.params.id });
  res.json({ ok: true });
});

// Recipient: leave a shared note (removes the share for self only)
router.delete('/notes/shared-with-me/:id', async (req, res) => {
  const userIds = await recipientsForNote(req.params.id);
  await pool.query(
    'DELETE FROM note_shares WHERE note_id = $1 AND recipient_id = $2',
    [req.params.id, req.userId],
  );
  publish(userIds, { type: 'share.changed', noteId: req.params.id });
  res.json({ ok: true });
});

// Recipient: pick which of their own notebooks the shared note appears in.
router.patch('/notes/shared-with-me/:id', async (req, res) => {
  const parsed = setNotebookSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const target = parsed.data.targetNotebookId;
  if (target) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM notebooks WHERE id = $1 AND user_id = $2',
      [target, req.userId],
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Notebook niet gevonden' });
  }
  const { rowCount } = await pool.query(
    'UPDATE note_shares SET target_notebook_id = $1 WHERE note_id = $2 AND recipient_id = $3',
    [target, req.params.id, req.userId],
  );
  if (rowCount === 0) return res.status(404).json({ error: 'Share niet gevonden' });
  publish([req.userId], { type: 'share.changed', noteId: req.params.id });
  res.json({ ok: true });
});

export default router;
