import jwt from 'jsonwebtoken';

const DEV_DEFAULT_SECRET = 'dev-only-change-me';
const SECRET = process.env.JWT_SECRET || DEV_DEFAULT_SECRET;
const EXPIRES = process.env.JWT_EXPIRES || '7d';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || SECRET === DEV_DEFAULT_SECRET || SECRET.length < 32)) {
  // Refuse to boot with a guessable signing key — would let anyone forge tokens.
  throw new Error('JWT_SECRET must be set to a strong (>=32 char) random value in production');
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
