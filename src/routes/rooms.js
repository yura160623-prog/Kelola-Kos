import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const VALID_TYPES = ['single', 'shared'];
const VALID_STATUS = ['available', 'occupied', 'maintenance'];

// GET /api/rooms  (?status=&q=)
router.get('/', (req, res) => {
  const { status, q } = req.query;
  const clauses = [];
  const params = [];

  if (status && VALID_STATUS.includes(status)) {
    clauses.push('r.status = ?');
    params.push(status);
  }
  if (q) {
    clauses.push('(r.room_number LIKE ? OR r.notes LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rooms = db
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM tenants t WHERE t.room_id = r.id AND t.status = 'active') AS active_tenants
       FROM rooms r
       ${where}
       ORDER BY r.room_number COLLATE NOCASE ASC`
    )
    .all(...params);
  res.json({ rooms });
});

// GET /api/rooms/:id
router.get('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Kamar tidak ditemukan.' });
  const tenants = db
    .prepare("SELECT * FROM tenants WHERE room_id = ? ORDER BY status ASC, name ASC")
    .all(req.params.id);
  res.json({ room, tenants });
});

// POST /api/rooms
router.post('/', (req, res) => {
  const { room_number, type, price, status, notes } = req.body || {};
  if (!room_number) return res.status(400).json({ error: 'Nomor kamar wajib diisi.' });
  if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipe kamar tidak valid.' });
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status kamar tidak valid.' });

  const info = db
    .prepare(
      `INSERT INTO rooms (room_number, type, price, status, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(room_number).trim(),
      type || 'single',
      Number.parseInt(price, 10) || 0,
      status || 'available',
      notes || null
    );
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ room });
});

// PUT /api/rooms/:id
router.put('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Kamar tidak ditemukan.' });

  const { room_number, type, price, status, notes } = req.body || {};
  if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Tipe kamar tidak valid.' });
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status kamar tidak valid.' });

  db.prepare(
    `UPDATE rooms
     SET room_number = ?, type = ?, price = ?, status = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    room_number != null ? String(room_number).trim() : room.room_number,
    type || room.type,
    price != null ? Number.parseInt(price, 10) || 0 : room.price,
    status || room.status,
    notes !== undefined ? notes : room.notes,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  res.json({ room: updated });
});

// DELETE /api/rooms/:id
router.delete('/:id', (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Kamar tidak ditemukan.' });

  const active = db
    .prepare("SELECT COUNT(*) AS c FROM tenants WHERE room_id = ? AND status = 'active'")
    .get(req.params.id).c;
  if (active > 0) {
    return res
      .status(409)
      .json({ error: 'Tidak dapat menghapus kamar yang masih memiliki penghuni aktif.' });
  }

  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
