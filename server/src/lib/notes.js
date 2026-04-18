// Shared helpers for note serialisation and querying.
// Used by routes/notes.js and routes/shares.js.

import { pool } from '../db.js';

export const TRASH_RETENTION_DAYS = 30;

export function rowToNote(row, labelIds, extra = {}) {
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
    deletedAt: row.deleted_at,
    permission: 'owner',
    sharedBy: null,
    ...extra,
  };
}

// Auto-purge notes that have been in the trash longer than the retention window.
export async function purgeOldTrash(userId) {
  try {
    await pool.query(
      `DELETE FROM notes
       WHERE user_id = $1
         AND deleted_at IS NOT NULL
         AND deleted_at < now() - ($2 || ' days')::interval`,
      [userId, String(TRASH_RETENTION_DAYS)],
    );
  } catch (e) {
    console.warn('purgeOldTrash failed', e.message);
  }
}

async function attachLabels(notes, userId) {
  if (notes.length === 0) return [];
  const ids = notes.map((n) => n.id);
  const links = await pool.query(
    `SELECT note_id, label_id FROM note_labels
     WHERE note_id = ANY($1::text[])`,
    [ids],
  );
  const byNote = new Map();
  for (const r of links.rows) {
    if (!byNote.has(r.note_id)) byNote.set(r.note_id, []);
    byNote.get(r.note_id).push(r.label_id);
  }
  return notes;
}

// Owner-only: notes the user owns (active or trashed depending on whereClause).
export async function fetchOwnedNotes(userId, whereClause) {
  const notes = await pool.query(
    `SELECT id, notebook_id, title, content, pinned, archived, password,
            created_at, updated_at, deleted_at
     FROM notes WHERE user_id = $1 AND ${whereClause} ORDER BY updated_at DESC`,
    [userId],
  );
  if (notes.rows.length === 0) return [];
  await attachLabels(notes.rows, userId);
  const ids = notes.rows.map((n) => n.id);
  const links = await pool.query(
    `SELECT note_id, label_id FROM note_labels WHERE note_id = ANY($1::text[])`,
    [ids],
  );
  const byNote = new Map();
  for (const r of links.rows) {
    if (!byNote.has(r.note_id)) byNote.set(r.note_id, []);
    byNote.get(r.note_id).push(r.label_id);
  }
  return notes.rows.map((n) => rowToNote(n, byNote.get(n.id) || []));
}

// Notes shared WITH the user (always active, no trash for shared).
export async function fetchSharedWithMe(userId) {
  const { rows } = await pool.query(
    `SELECT n.id, n.notebook_id AS owner_notebook_id, n.title, n.content, n.pinned,
            n.archived, n.password, n.created_at, n.updated_at,
            s.permission, s.target_notebook_id,
            s.owner_id, ownerProfile.display_name AS owner_display_name,
            ownerUser.email AS owner_email
     FROM note_shares s
     JOIN notes n ON n.id = s.note_id
     JOIN users ownerUser ON ownerUser.id = s.owner_id
     LEFT JOIN profiles ownerProfile ON ownerProfile.user_id = s.owner_id
     WHERE s.recipient_id = $1 AND n.deleted_at IS NULL
     ORDER BY n.updated_at DESC`,
    [userId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const links = await pool.query(
    `SELECT note_id, label_id FROM note_labels WHERE note_id = ANY($1::text[])`,
    [ids],
  );
  const byNote = new Map();
  for (const r of links.rows) {
    if (!byNote.has(r.note_id)) byNote.set(r.note_id, []);
    byNote.get(r.note_id).push(r.label_id);
  }
  return rows.map((r) => ({
    id: r.id,
    // Use the recipient's chosen notebook (or empty string sentinel for "Gedeeld met mij")
    notebookId: r.target_notebook_id || '__shared__',
    title: r.title,
    content: r.content,
    pinned: false, // pin is recipient-local; not stored yet → always false for shared
    archived: false,
    password: r.password,
    labelIds: byNote.get(r.id) || [], // owner's labels (recipient sees them but cannot edit)
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: null,
    permission: r.permission, // 'read' | 'write'
    sharedBy: {
      id: r.owner_id,
      email: r.owner_email,
      displayName: r.owner_display_name || r.owner_email,
    },
  }));
}

// Returns the list of user IDs that should receive a realtime event for a note:
// the owner + all current recipients.
export async function recipientsForNote(noteId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM notes WHERE id = $1
     UNION
     SELECT recipient_id AS user_id FROM note_shares WHERE note_id = $1`,
    [noteId],
  );
  return rows.map((r) => r.user_id);
}
