import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import casesRoutes, { setCasesSocketIO } from './routes/cases.js';
import triageRoutes from './routes/triage.js';
import uploadsRoutes from './routes/uploads.js';
import doctorsRoutes from './routes/doctors.js';
import notificationsRoutes from './routes/notifications.js';
import statsRoutes from './routes/stats.js';

import { setSocketIO } from './notifier/sms.js';
import { setupSocketHandlers } from './sockets/handler.js';
import { seedDatabase } from './db/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Gzip compression middleware for compact low-bandwidth responses
app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

setSocketIO(io);
setCasesSocketIO(io);
setupSocketHandlers(io);

// 1. Low-Bandwidth Network Measurement Endpoints
// Tiny ping for RTT measurement
app.get('/api/ping', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ pong: 1, t: Date.now() });
});

// 32 KB repeatable binary payload for accurate throughput measurement
const probeBuffer = Buffer.alloc(32 * 1024, 0x5a); // 32 KB fixed payload
app.get('/api/probe', (req, res) => {
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Length', String(probeBuffer.length));
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.send(probeBuffer);
});

// 2. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/doctors', doctorsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SwasthaSetu', time: Date.now() });
});

// Ensure database is seeded if empty
try {
  const dbModule = await import('./db/connection.js');
  const db = dbModule.default;
  const userCount = db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!userCount || userCount.count === 0) {
    seedDatabase();
  }
} catch (e) {
  console.log('Running auto-seed check...');
  seedDatabase();
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🏥 SwasthaSetu Server active on http://localhost:${PORT}`);
  console.log(`📶 Network Probe: http://localhost:${PORT}/api/ping & /api/probe`);
});

export { app, server };
