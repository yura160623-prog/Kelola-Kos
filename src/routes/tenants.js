import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['active', 'moved_out'];

// Recalculate a room's status based on active tenants (unless under maintenance).
function syncRoomStatus(roomId) {
  if (!roomId) return;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room || room.status === 'maintenance') return;
  const active = db
    .prepare("SELECT COUNT(*) AS c FROM tenants WHERE room_id = ? AND status = 'active'")
    .get(roomId).c;
  const newStatus = active > 0 ? 'occupied' : 'available';
  if (newStatus !== room.status) {
    db.prepare("UPDATE rooms SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
      newStatus,
      roomId
    );
  }
}

// GET /api/tenants  (?status=&room_id=&q=)
router.get('/', (req, res) => {
  const { status, room_id, q } = req.query;
  const clauses = [];
  const params = [];

  if (status && VALID_STATUS.includes(status)) {
    clauses.push('t.status = ?');
    params.push(status);
  }
  if (room_id) {
    clauses.push('t.room_id = ?');
    params.push(room_id);
  }
  if (q) {
    clauses.push('(t.name LIKE ? OR t.phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const tenants = db
    .prepare(
      `SELECT t.*, r.room_number
       FROM tenants t
       LEFT JOIN rooms r ON r.id = t.room_id
       ${where}
       ORDER BY t.status ASC, t.name COLLATE NOCASE ASC`
    )
    .all(...params);
  res.json({ tenants });
});

// GET /api/tenants/:id
router.get('/:id', (req, res) => {
  const tenant = db
    .prepare(
      `SELECT t.*, r.room_number FROM tenants t
       LEFT JOIN rooms r ON r.id = t.room_id WHERE t.id = ?`
    )
    .get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Penghuni tidak ditemukan.' });
  const payments = db
    .prepare('SELECT * FROM payments WHERE tenant_id = ? ORDER BY period_year DESC, period_month DESC')
    .all(req.params.id);
  res.json({ tenant, payments });
});

// POST /api/tenants
router.post('/', (req, res) => {
  const { room_id, name, phone, identity_number, start_date, status, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Nama penghuni wajib diisi.' });
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });

  if (room_id) {
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(room_id);
    if (!room) return res.status(400).json({ error: 'Kamar tidak ditemukan.' });
  }

  const info = db
    .prepare(
      `INSERT INTO tenants (room_id, name, phone, identity_number, start_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      room_id || null,
      String(name).trim(),
      phone || null,
      identity_number || null,
      start_date || null,
      status || 'active',
      notes || null
    );

  syncRoomStatus(room_id);
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ tenant });
});

// PUT /api/tenants/:id
router.put('/:id', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Penghuni tidak ditemukan.' });

  const { room_id, name, phone, identity_number, start_date, status, notes } = req.body || {};
  if (status && !VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });

  const newRoomId = room_id !== undefined ? room_id || null : tenant.room_id;
  if (newRoomId) {
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(newRoomId);
    if (!room) return res.status(400).json({ error: 'Kamar tidak ditemukan.' });
  }

  db.prepare(
    `UPDATE tenants
     SET room_id = ?, name = ?, phone = ?, identity_number = ?, start_date = ?, status = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    newRoomId,
    name != null ? String(name).trim() : tenant.name,
    phone !== undefined ? phone : tenant.phone,
    identity_number !== undefined ? identity_number : tenant.identity_number,
    start_date !== undefined ? start_date : tenant.start_date,
    status || tenant.status,
    notes !== undefined ? notes : tenant.notes,
    req.params.id
  );

  // Sync both the old and new room (in case tenant was moved).
  syncRoomStatus(tenant.room_id);
  syncRoomStatus(newRoomId);

  const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  res.json({ tenant: updated });
});

// DELETE /api/tenants/:id
router.delete('/:id', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  if (!tenant) return res.status(404).json({ error: 'Penghuni tidak ditemukan.' });

  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  syncRoomStatus(tenant.room_id);
  res.json({ ok: true });
});

export default router;
