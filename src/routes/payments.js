import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['unpaid', 'paid', 'late'];
const VALID_METHODS = ['cash', 'transfer', 'e-wallet'];

// GET /api/payments  (?month=&year=&status=&tenant_id=&room_id=)
router.get('/', (req, res) => {
  const { month, year, status, tenant_id, room_id } = req.query;
  const clauses = [];
  const params = [];

  if (month) {
    clauses.push('p.period_month = ?');
    params.push(month);
  }
  if (year) {
    clauses.push('p.period_year = ?');
    params.push(year);
  }
  if (status && VALID_STATUS.includes(status)) {
    clauses.push('p.status = ?');
    params.push(status);
  }
  if (tenant_id) {
    clauses.push('p.tenant_id = ?');
    params.push(tenant_id);
  }
  if (room_id) {
    clauses.push('p.room_id = ?');
    params.push(room_id);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const payments = db
    .prepare(
      `SELECT p.*, t.name AS tenant_name, r.room_number
       FROM payments p
       LEFT JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN rooms r ON r.id = p.room_id
       ${where}
       ORDER BY p.period_year DESC, p.period_month DESC, r.room_number COLLATE NOCASE ASC`
    )
    .all(...params);
  res.json({ payments });
});

// POST /api/payments - create a single payment/bill
router.post('/', (req, res) => {
  const { tenant_id, period_month, period_year, amount, paid_date, payment_method, status, notes } =
    req.body || {};

  if (!tenant_id || !period_month || !period_year) {
    return res.status(400).json({ error: 'Penghuni, bulan, dan tahun wajib diisi.' });
  }
  if (payment_method && !VALID_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Metode pembayaran tidak valid.' });
  }
  if (status && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenant_id);
  if (!tenant) return res.status(400).json({ error: 'Penghuni tidak ditemukan.' });

  const room = tenant.room_id
    ? db.prepare('SELECT * FROM rooms WHERE id = ?').get(tenant.room_id)
    : null;
  const finalAmount = amount != null ? Number.parseInt(amount, 10) || 0 : room?.price || 0;

  const dup = db
    .prepare('SELECT id FROM payments WHERE tenant_id = ? AND period_month = ? AND period_year = ?')
    .get(tenant_id, period_month, period_year);
  if (dup) {
    return res.status(409).json({ error: 'Tagihan untuk periode ini sudah ada.' });
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO payments (tenant_id, room_id, period_month, period_year, amount, paid_date, payment_method, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        tenant_id,
        tenant.room_id || null,
        Number.parseInt(period_month, 10),
        Number.parseInt(period_year, 10),
        finalAmount,
        paid_date || null,
        payment_method || null,
        status || 'unpaid',
        notes || null
      );
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ payment });
  } catch (e) {
    res.status(400).json({ error: 'Gagal menyimpan pembayaran.' });
  }
});

// POST /api/payments/generate - auto-generate monthly bills for all active tenants
router.post('/generate', (req, res) => {
  const now = new Date();
  const month = Number.parseInt(req.body?.month, 10) || now.getMonth() + 1;
  const year = Number.parseInt(req.body?.year, 10) || now.getFullYear();

  const tenants = db
    .prepare(
      `SELECT t.*, r.price AS room_price FROM tenants t
       LEFT JOIN rooms r ON r.id = t.room_id
       WHERE t.status = 'active'`
    )
    .all();

  const insert = db.prepare(
    `INSERT INTO payments (tenant_id, room_id, period_month, period_year, amount, status)
     VALUES (?, ?, ?, ?, ?, 'unpaid')`
  );
  const exists = db.prepare(
    'SELECT id FROM payments WHERE tenant_id = ? AND period_month = ? AND period_year = ?'
  );

  let created = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const t of tenants) {
      if (exists.get(t.id, month, year)) {
        skipped++;
        continue;
      }
      insert.run(t.id, t.room_id || null, month, year, t.room_price || 0);
      created++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Gagal generate tagihan.' });
  }

  res.json({ created, skipped, month, year });
});

// PUT /api/payments/:id
router.put('/:id', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan.' });

  const { amount, paid_date, payment_method, status, notes } = req.body || {};
  if (payment_method && !VALID_METHODS.includes(payment_method)) {
    return res.status(400).json({ error: 'Metode pembayaran tidak valid.' });
  }
  if (status && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }

  // When marking as paid without a date, default to today.
  let finalPaidDate = paid_date !== undefined ? paid_date : payment.paid_date;
  if (status === 'paid' && !finalPaidDate) {
    finalPaidDate = new Date().toISOString().slice(0, 10);
  }

  db.prepare(
    `UPDATE payments
     SET amount = ?, paid_date = ?, payment_method = ?, status = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    amount != null ? Number.parseInt(amount, 10) || 0 : payment.amount,
    finalPaidDate || null,
    payment_method !== undefined ? payment_method || null : payment.payment_method,
    status || payment.status,
    notes !== undefined ? notes : payment.notes,
    req.params.id
  );
  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  res.json({ payment: updated });
});

// POST /api/payments/:id/pay - quick "mark as paid" shortcut
router.post('/:id/pay', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan.' });

  const method =
    req.body?.payment_method && VALID_METHODS.includes(req.body.payment_method)
      ? req.body.payment_method
      : 'cash';
  const paidDate = req.body?.paid_date || new Date().toISOString().slice(0, 10);

  db.prepare(
    `UPDATE payments SET status = 'paid', paid_date = ?, payment_method = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(paidDate, method, req.params.id);
  const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  res.json({ payment: updated });
});

// DELETE /api/payments/:id
router.delete('/:id', (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan.' });
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
