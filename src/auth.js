import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Fail fast if a real secret is not configured in production, so the app never
// silently boots with a publicly-known signing key.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET wajib diset di environment production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'kk_token';

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

/**
 * Express middleware: requires a valid JWT (from cookie or Bearer header).
 * Attaches decoded user to req.user.
 */
export function requireAuth(req, res, next) {
  const token =
    req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Tidak terautentikasi. Silakan login.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa.' });
  }
}
