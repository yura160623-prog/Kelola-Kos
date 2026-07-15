import { Router } from 'express';
import db from '../db.js';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from '../auth.js';

const router = Router();

// GET /api/auth/registration-open - whether self-registration is still allowed
router.get('/registration-open', (req, res) => {
  const owner = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  res.json({ open: !owner });
});

// POST /api/auth/register - register an owner account
router.post('/register', (req, res) => {
  const { name, username, password, phone } = req.body || {};

  // Single-owner MVP: only allow registration until the first owner exists.
  // Additional accounts must be created deliberately (future multi-owner phase).
  const ownerExists = db.prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1").get();
  if (ownerExists) {
    return res
      .status(403)
      .json({ error: 'Registrasi ditutup. Akun pemilik sudah terdaftar. Silakan masuk.' });
  }

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username sudah digunakan.' });
  }

  const info = db
    .prepare(
      `INSERT INTO users (role, name, username, phone, password)
       VALUES ('owner', ?, ?, ?, ?)`
    )
    .run(name, username, phone || null, hashPassword(password));

  const user = {
    id: info.lastInsertRowid,
    role: 'owner',
    name,
    username,
  };
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user, token });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!row || !verifyPassword(password, row.password)) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  const user = { id: row.id, role: row.role, name: row.name, username: row.username };
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user, token });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const row = db
    .prepare('SELECT id, role, name, username, phone, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User tidak ditemukan.' });
  res.json({ user: row });
});

export default router;
