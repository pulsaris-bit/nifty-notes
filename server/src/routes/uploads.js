import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';
import { pool } from '../db.js';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure uploads dir exists at module load
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* ignore */ }

// ---------- Image uploads (existing, used for inline images in notes) ----------
// SVG is intentionally NOT allowed: it can contain <script> and would be
// served from the same origin as the app, enabling stored XSS.
const ALLOWED_IMAGE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '';
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, id);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE.has(file.mimetype)) return cb(new Error('Unsupported image type'));
    cb(null, true);
  },
});

// Verify the uploaded bytes actually match a supported raster image.
function detectImageMimeFromBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

const router = Router();

// Image upload (authenticated) — used by the rich text editor.
router.post('/', requireAuth, imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    const real = detectImageMimeFromBytes(head);
    if (!real || real !== req.file.mimetype) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid image content' });
    }
  } catch {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'Invalid image content' });
  }
  res.json({ url: `/api/uploads/${req.file.filename}` });
});

// ---------- Document attachments (new) ----------
// Generic document storage for note attachments. Files are NOT served from the
// static /api/uploads handler — they are downloaded via /api/notes/:id/attachments/:aid
// which enforces ownership/sharing and sets Content-Disposition: attachment.
const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  'text/plain',
  'text/csv',
  'application/json',
  'application/octet-stream', // fallback for unknown but allowed extensions
]);
const ALLOWED_DOC_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.json', '.zip', '.7z', '.rar',
]);

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const id = `att-${Date.now().toString(36)}-${crypto.randomBytes(10).toString('hex')}${ext}`;
    cb(null, id);
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_DOC_EXT.has(ext)) return cb(new Error('Bestandstype niet toegestaan'));
    if (file.mimetype && !ALLOWED_DOC_MIME.has(file.mimetype)) {
      // Allow generic octet-stream; reject obviously dangerous types
      if (file.mimetype.startsWith('text/html') || file.mimetype.startsWith('image/svg')) {
        return cb(new Error('Bestandstype niet toegestaan'));
      }
    }
    cb(null, true);
  },
});

// Helper: assert the current user can attach/list/delete files on this note.
// Owner: full access. Write-recipient: can list & add. Read-recipient: list only.
async function getNotePermission(noteId, userId) {
  const { rows } = await pool.query(
    `SELECT n.user_id AS owner_id, s.permission AS share_permission
       FROM notes n
       LEFT JOIN note_shares s ON s.note_id = n.id AND s.recipient_id = $2
      WHERE n.id = $1 LIMIT 1`,
    [noteId, userId],
  );
  if (rows.length === 0) return null;
  if (rows[0].owner_id === userId) return 'owner';
  if (rows[0].share_permission === 'write') return 'write';
  if (rows[0].share_permission === 'read') return 'read';
  return null;
}

// List attachments for a note
router.get('/note/:noteId', requireAuth, async (req, res) => {
  const perm = await getNotePermission(req.params.noteId, req.userId);
  if (!perm) return res.status(404).json({ error: 'Note not found' });
  const { rows } = await pool.query(
    `SELECT id, filename, mime_type, size_bytes, created_at
       FROM note_attachments WHERE note_id = $1 ORDER BY created_at DESC`,
    [req.params.noteId],
  );
  res.json(rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: Number(r.size_bytes),
    createdAt: r.created_at,
  })));
});

// Upload one attachment for a note
router.post('/note/:noteId', requireAuth, docUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Geen bestand' });
  const cleanup = () => { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } };
  try {
    const perm = await getNotePermission(req.params.noteId, req.userId);
    if (!perm || perm === 'read') {
      cleanup();
      return res.status(403).json({ error: 'Geen toestemming' });
    }
    const id = `at-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`;
    const original = (req.file.originalname || 'bestand').slice(0, 255);
    const mime = req.file.mimetype || 'application/octet-stream';
    await pool.query(
      `INSERT INTO note_attachments (id, note_id, filename, storage_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.params.noteId, original, req.file.filename, mime, req.file.size, req.userId],
    );
    res.json({
      id,
      filename: original,
      mimeType: mime,
      size: req.file.size,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('attach upload error', e);
    cleanup();
    res.status(500).json({ error: 'Upload mislukt' });
  }
});

// Download a specific attachment (forces save dialog via Content-Disposition).
// Token may be supplied via Authorization header OR ?token= query (so plain
// <a href> downloads work without custom fetch logic).
import { verifyToken } from '../auth.js';
router.get('/note/:noteId/:attId', async (req, res) => {
  // Manual auth: support query token for direct browser links
  let userId = null;
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const token = bearer || (typeof req.query.token === 'string' ? req.query.token : null);
  try {
    const payload = token ? verifyToken(token) : null;
    userId = payload?.sub || null;
  } catch { userId = null; }
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const perm = await getNotePermission(req.params.noteId, userId);
  if (!perm) return res.status(404).json({ error: 'Niet gevonden' });

  const { rows } = await pool.query(
    `SELECT filename, storage_name, mime_type, size_bytes
       FROM note_attachments WHERE id = $1 AND note_id = $2 LIMIT 1`,
    [req.params.attId, req.params.noteId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Niet gevonden' });
  const row = rows[0];
  const filePath = path.join(UPLOADS_DIR, row.storage_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Bestand ontbreekt' });

  const safeName = encodeURIComponent(row.filename).replace(/['()]/g, escape);
  res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', String(row.size_bytes));
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${safeName}`,
  );
  fs.createReadStream(filePath).pipe(res);
});

// Delete an attachment (owner only)
router.delete('/note/:noteId/:attId', requireAuth, async (req, res) => {
  const perm = await getNotePermission(req.params.noteId, req.userId);
  if (perm !== 'owner') return res.status(403).json({ error: 'Geen toestemming' });
  const { rows } = await pool.query(
    `DELETE FROM note_attachments WHERE id = $1 AND note_id = $2 RETURNING storage_name`,
    [req.params.attId, req.params.noteId],
  );
  if (rows[0]?.storage_name) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, rows[0].storage_name)); } catch { /* ignore */ }
  }
  res.json({ ok: true });
});

export default router;
