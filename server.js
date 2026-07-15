import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate } from './src/db.js';
import authRoutes from './src/routes/auth.js';
import roomRoutes from './src/routes/rooms.js';
import tenantRoutes from './src/routes/tenants.js';
import paymentRoutes from './src/routes/payments.js';
import dashboardRoutes from './src/routes/dashboard.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialise the database schema on boot.
migrate();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'kelolakos' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Static frontend (PWA)
app.use(
  express.static(resolve(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  })
);

// SPA fallback for any non-API GET request.
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(resolve(__dirname, 'public', 'index.html'));
});

// JSON error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log(`KelolaKos berjalan di http://localhost:${PORT}`);
});
