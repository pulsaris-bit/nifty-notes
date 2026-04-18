import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { subscribe, setPresence, clearPresenceForNote, listViewers, publish, removeDevicePresence } from '../lib/events.js';
import { recipientsForNote } from '../lib/notes.js';

const router = Router();
const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// SSE stream — auth via query token because EventSource cannot set headers.
router.get('/stream', async (req, res) => {
  const token = String(req.query.token || '');
  const deviceId = String(req.query.deviceId || '').slice(0, 64);
  if (!token || !deviceId) return res.status(401).end();
  let userId;
  try { userId = jwt.verify(token, SECRET).sub; } catch { return res.status(401).end(); }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
  subscribe(userId, deviceId, res);
});

// Set/clear which note the user is currently viewing.
const presenceSchema = z.object({
  noteId: z.string().min(1).max(64).nullable(),
  deviceId: z.string().min(1).max(64),
});

async function broadcastPresence(noteId) {
  const recipients = await recipientsForNote(noteId);
  publish(recipients, { type: 'presence.changed', noteId, viewers: listViewers(noteId) });
}

router.post('/presence', requireAuth, async (req, res) => {
  const parsed = presenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { noteId, deviceId } = parsed.data;

  // Look up display name for the viewer.
  const { rows } = await pool.query(
    `SELECT COALESCE(p.display_name, u.email) AS display_name
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [req.userId],
  );
  const displayName = rows[0]?.display_name || 'Onbekend';

  // First clear this device on all other notes (only one active note at a time).
  const cleared = removeDevicePresence(req.userId, deviceId);

  if (noteId) setPresence(noteId, req.userId, deviceId, displayName);

  // Broadcast to all affected notes (the previous ones + the new one).
  const affected = new Set(cleared);
  if (noteId) affected.add(noteId);
  for (const n of affected) {
    await broadcastPresence(n).catch(() => undefined);
  }
  res.json({ ok: true });
});

// Heartbeat — refreshes lastSeen for the active note.
router.post('/presence/ping', requireAuth, async (req, res) => {
  const parsed = presenceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { noteId, deviceId } = parsed.data;
  if (noteId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(p.display_name, u.email) AS display_name
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1 LIMIT 1`,
      [req.userId],
    );
    setPresence(noteId, req.userId, deviceId, rows[0]?.display_name || 'Onbekend');
  }
  res.json({ ok: true });
});

// Read current viewers for a note (used to bootstrap on note open).
router.get('/presence/:noteId', requireAuth, async (req, res) => {
  res.json({ viewers: listViewers(req.params.noteId) });
});

export default router;
