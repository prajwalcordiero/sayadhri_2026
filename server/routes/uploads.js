import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/connection.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');

if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// 1. Initialize or check status of chunked upload
router.post('/init', (req, res) => {
  try {
    const { uploadId, fileName, mimeType, totalChunks } = req.body;
    if (!uploadId || !fileName || !totalChunks) {
      return res.status(400).json({ success: false, error: 'Missing required upload parameters' });
    }

    const existing = db.prepare('SELECT * FROM uploads WHERE upload_id = ?').get(uploadId);
    if (existing) {
      // Find which chunks are already received on disk
      const chunkDir = path.join(CHUNKS_DIR, uploadId);
      let receivedChunkIndices = [];
      if (fs.existsSync(chunkDir)) {
        receivedChunkIndices = fs.readdirSync(chunkDir).map(name => parseInt(name.replace('chunk_', ''), 10)).filter(n => !isNaN(n));
      }

      return res.json({
        success: true,
        uploadId,
        receivedChunks: receivedChunkIndices,
        isComplete: Boolean(existing.is_complete),
        filePath: existing.file_path
      });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const finalPath = path.join(UPLOADS_DIR, `${uploadId}_${fileName}`);

    db.prepare(`
      INSERT INTO uploads (upload_id, file_name, mime_type, total_chunks, received_chunks, file_path, is_complete, created_at)
      VALUES (?, ?, ?, ?, 0, ?, 0, ?)
    `).run(uploadId, fileName, mimeType || 'application/octet-stream', Number(totalChunks), finalPath, Date.now());

    res.json({
      success: true,
      uploadId,
      receivedChunks: [],
      isComplete: false
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Upload an individual chunk (16KB or arbitrary slice)
router.post('/:uploadId/chunks', (req, res) => {
  try {
    const { uploadId } = req.params;
    const { chunkIndex, chunkData } = req.body; // chunkData can be base64 string

    if (chunkIndex === undefined || !chunkData) {
      return res.status(400).json({ success: false, error: 'chunkIndex and chunkData are required' });
    }

    const upload = db.prepare('SELECT * FROM uploads WHERE upload_id = ?').get(uploadId);
    if (!upload) {
      return res.status(404).json({ success: false, error: 'Upload session not found' });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkFilePath = path.join(chunkDir, `chunk_${chunkIndex}`);
    // Convert base64 data to buffer
    const buffer = Buffer.from(chunkData, 'base64');
    fs.writeFileSync(chunkFilePath, buffer);

    // Update received count
    const existingChunks = fs.readdirSync(chunkDir);
    db.prepare('UPDATE uploads SET received_chunks = ? WHERE upload_id = ?').run(
      existingChunks.length,
      uploadId
    );

    res.json({
      success: true,
      chunkIndex,
      receivedChunksCount: existingChunks.length,
      totalChunks: upload.total_chunks
    });
  } catch (err) {
    console.error('Error writing chunk:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Complete and reassemble chunks
router.post('/:uploadId/complete', (req, res) => {
  try {
    const { uploadId } = req.params;
    const upload = db.prepare('SELECT * FROM uploads WHERE upload_id = ?').get(uploadId);
    if (!upload) {
      return res.status(404).json({ success: false, error: 'Upload session not found' });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      return res.status(400).json({ success: false, error: 'No chunks found for this upload' });
    }

    // Reassemble chunks sequentially
    const outStream = fs.createWriteStream(upload.file_path);
    for (let i = 0; i < upload.total_chunks; i++) {
      const chunkFile = path.join(chunkDir, `chunk_${i}`);
      if (!fs.existsSync(chunkFile)) {
        outStream.close();
        return res.status(400).json({
          success: false,
          error: `Missing chunk ${i}. Resubmit this chunk before completing.`
        });
      }
      const data = fs.readFileSync(chunkFile);
      outStream.write(data);
    }
    outStream.end();

    // Mark completed in database
    db.prepare('UPDATE uploads SET is_complete = 1 WHERE upload_id = ?').run(uploadId);

    // Clean up temporary chunk pieces
    try {
      fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Could not remove temporary chunk directory:', e.message);
    }

    const publicUrl = `/uploads/${path.basename(upload.file_path)}`;

    res.json({
      success: true,
      uploadId,
      url: publicUrl,
      fileName: upload.file_name,
      mimeType: upload.mime_type
    });
  } catch (err) {
    console.error('Error completing chunked upload:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
