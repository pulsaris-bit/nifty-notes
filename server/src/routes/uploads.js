import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure uploads dir exists at module load
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* ignore */ }

// SVG is intentionally NOT allowed: it can contain <script> and would be
// served from the same origin as the app, enabling stored XSS.
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || '';
    const id = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, id);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) return cb(new Error('Unsupported image type'));
    cb(null, true);
  },
});

// Verify the uploaded bytes actually match a supported raster image.
// Without this, an attacker could mislabel an SVG/HTML file as image/png.
function detectMimeFromBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  // RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

const router = Router();

// Upload (authenticated)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Read the first 16 bytes to verify the actual file type and discard if mismatched.
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    const real = detectMimeFromBytes(head);
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
