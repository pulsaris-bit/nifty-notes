import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, withTx } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  displayName: z.string().trim().min(2).max(50),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(100),
});

function buildUserPayload({ user, role, profile }) {
  return {
    id: user.id,
    email: user.email,
    role,
    createdAt: user.created_at,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    theme: profile.theme,
    language: profile.language,
  };
}

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password, displayName } = parsed.data;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Er bestaat al een account met dit e-mailadres.' });

    const hash = await bcrypt.hash(password, 10);

    const result = await withTx(async (c) => {
      const { rows: [user] } = await c.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, hash],
      );
      // First user becomes admin
      const { rows: [{ count }] } = await c.query('SELECT COUNT(*)::int AS count FROM users');
      const role = count === 1 ? 'admin' : 'user';
      await c.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user.id, role]);
      const { rows: [profile] } = await c.query(
        `INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)
         RETURNING display_name, avatar_url, bio, theme, language`,
        [user.id, displayName],
      );
      return { user, role, profile };
    });

    const token = signToken({ sub: result.user.id, role: result.role });
    res.json({ token, user: buildUserPayload(result) });
  } catch (e) {
    console.error('signup error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password } = parsed.data;

  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.created_at,
              COALESCE(r.role::text, 'user') AS role,
              p.display_name, p.avatar_url, p.bio, p.theme, p.language
       FROM users u
       LEFT JOIN user_roles r ON r.user_id = u.id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email],
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Geen account gevonden met dit e-mailadres.' });
    const row = rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Onjuist wachtwoord.' });

    const token = signToken({ sub: row.id, role: row.role });
    res.json({
      token,
      user: buildUserPayload({
        user: { id: row.id, email: row.email, created_at: row.created_at },
        role: row.role,
        profile: {
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          bio: row.bio,
          theme: row.theme,
          language: row.language,
        },
      }),
    });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.created_at,
            COALESCE(r.role::text, 'user') AS role,
            p.display_name, p.avatar_url, p.bio, p.theme, p.language
     FROM users u
     LEFT JOIN user_roles r ON r.user_id = u.id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = $1 LIMIT 1`,
    [req.userId],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
  const row = rows[0];
  res.json({
    user: buildUserPayload({
      user: { id: row.id, email: row.email, created_at: row.created_at },
      role: row.role,
      profile: {
        display_name: row.display_name,
        avatar_url: row.avatar_url,
        bio: row.bio,
        theme: row.theme,
        language: row.language,
      },
    }),
  });
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  avatarUrl: z.string().trim().max(2048).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  theme: z.string().trim().max(20).optional(),
  language: z.string().trim().max(10).optional(),
});

router.patch('/me', requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const u = parsed.data;
  const fields = [];
  const values = [];
  let i = 1;
  if (u.displayName !== undefined) { fields.push(`display_name = $${i++}`); values.push(u.displayName); }
  if (u.avatarUrl !== undefined)   { fields.push(`avatar_url = $${i++}`);   values.push(u.avatarUrl); }
  if (u.bio !== undefined)         { fields.push(`bio = $${i++}`);          values.push(u.bio); }
  if (u.theme !== undefined)       { fields.push(`theme = $${i++}`);        values.push(u.theme); }
  if (u.language !== undefined)    { fields.push(`language = $${i++}`);     values.push(u.language); }
  if (fields.length === 0) return res.json({ ok: true });
  fields.push(`updated_at = now()`);
  values.push(req.userId);
  await pool.query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = $${i}`, values);
  res.json({ ok: true });
});

export default router;
