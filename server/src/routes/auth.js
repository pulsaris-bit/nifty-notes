import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool, withTx } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

// Brute-force protection. Counts per IP — login/signup/change-password are
// the highest-value endpoints to attack.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel pogingen, probeer het over enkele minuten opnieuw.' },
});

// Modern password policy — keep in sync with src/lib/passwordPolicy.ts
const strongPassword = z.string()
  .min(12, 'Wachtwoord moet minimaal 12 tekens zijn')
  .max(100, 'Wachtwoord mag maximaal 100 tekens zijn')
  .regex(/[a-z]/, 'Wachtwoord moet minstens één kleine letter bevatten')
  .regex(/[A-Z]/, 'Wachtwoord moet minstens één hoofdletter bevatten')
  .regex(/[0-9]/, 'Wachtwoord moet minstens één cijfer bevatten')
  .regex(/[^A-Za-z0-9]/, 'Wachtwoord moet minstens één speciaal teken bevatten')
  .refine((v) => !/\s/.test(v), 'Wachtwoord mag geen spaties bevatten');

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: strongPassword,
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

router.post('/signup', authLimiter, async (req, res) => {
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

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { email, password } = parsed.data;

  // Generic message — do NOT reveal whether the email exists (user enumeration).
  const GENERIC = 'Onjuiste inloggegevens.';

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
    // Always run bcrypt against a real-looking hash so attackers can't time-distinguish
    // "no such user" from "wrong password".
    const dummyHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Z1C6F1q9w0qYx5YqJxK8h7q3XbDa';
    const row = rows[0];
    const ok = await bcrypt.compare(password, row?.password_hash || dummyHash);
    if (!row || !ok) return res.status(401).json({ error: GENERIC });

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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: strongPassword,
});

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Nieuw wachtwoord moet verschillen van het huidige wachtwoord.' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
      [req.userId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Gebruiker niet gevonden.' });

    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Huidig wachtwoord is onjuist.' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
      [newHash, req.userId],
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('change-password error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
