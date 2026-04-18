import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';

export const UPLOADS_DIR = process.env.UPLOADS_DIR || '/app/uploads';

// Ensure uploads dir exists at module load
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* ignore */ }

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']);
const EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase() || '';
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

const router = Router();

// Upload (authenticated)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: `/api/uploads/${req.file.filename}` });
});

export default router;
