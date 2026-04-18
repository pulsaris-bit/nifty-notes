import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Search users by exact-or-prefix email match. Returns at most 10.
// Excludes the requester.
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json([]);
  const { rows } = await pool.query(
    `SELECT u.id, u.email, COALESCE(p.display_name, u.email) AS display_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE lower(u.email) LIKE $1 AND u.id <> $2
     ORDER BY u.email ASC LIMIT 10`,
    [`${q}%`, req.userId],
  );
  res.json(rows.map((r) => ({ id: r.id, email: r.email, displayName: r.display_name })));
});

export default router;
