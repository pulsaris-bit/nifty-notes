import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure uploads dir exists at module load
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* ignore */ }

// ---------- Image uploads (used for inline images in notes) ----------
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

export default router;
