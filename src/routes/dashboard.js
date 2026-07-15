import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/dashboard - summary metrics for the owner home screen
router.get('/', (req, res) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const rooms = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
         SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) AS maintenance
       FROM rooms`
    )
    .get();

  const activeTenants = db
    .prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'active'").get().c;

  const incomeThisMonth = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE status = 'paid' AND period_month = ? AND period_year = ?`
    )
    .get(month, year).total;

  const outstanding = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
       FROM payments
       WHERE status IN ('unpaid', 'late')`
    )
    .get();

  // Unpaid / late bills - the "jatuh tempo" list.
  const dueList = db
    .prepare(
      `SELECT p.*, t.name AS tenant_name, t.phone AS tenant_phone, r.room_number
       FROM payments p
       LEFT JOIN tenants t ON t.id = p.tenant_id
       LEFT JOIN rooms r ON r.id = p.room_id
       WHERE p.status IN ('unpaid', 'late')
       ORDER BY p.period_year ASC, p.period_month ASC
       LIMIT 20`
    )
    .all();

  // Income trend for the last 6 months (paid payments).
  const trendRows = db
    .prepare(
      `SELECT period_year AS year, period_month AS month, COALESCE(SUM(amount), 0) AS total
       FROM payments
       WHERE status = 'paid'
       GROUP BY period_year, period_month
       ORDER BY period_year DESC, period_month DESC
       LIMIT 6`
    )
    .all();
  const trend = trendRows.reverse();

  res.json({
    period: { month, year },
    rooms: {
      total: rooms.total || 0,
      available: rooms.available || 0,
      occupied: rooms.occupied || 0,
      maintenance: rooms.maintenance || 0,
    },
    activeTenants,
    incomeThisMonth,
    outstanding: { total: outstanding.total, count: outstanding.count },
    dueList,
    trend,
  });
});

export default router;
