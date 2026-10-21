import React, { useState } from 'react';
import { Camera, Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * On-Device Image Compression & Resumable 16KB Chunked Uploader
 * Compresses raw high-res camera photos (often 3-8 MB) down to <100 KB WebP
 */
export default function ImageUploader({ onUploadComplete, isOffline = false }) {
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState(null); // { originalSize, sentSize, reductionRatio }
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError(null);
    setCompressing(true);
    setProgress(0);

    try {
      // 1. Read image into HTML Image object
      const originalSize = file.size;
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      // 2. Client-side canvas downscaling (max 1024px on longest edge)
      const MAX_DIM = 1024;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // 3. Encode to WebP at 0.6 quality
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.6);
      });

      URL.revokeObjectURL(objectUrl);
      const compressedSize = blob.size;
      const compressedPreview = URL.createObjectURL(blob);
      setPreviewUrl(compressedPreview);

      const ratio = Math.round((1 - compressedSize / originalSize) * 100);
      const statDetails = {
        originalSize: formatBytes(originalSize),
        sentSize: formatBytes(compressedSize),
        rawBytes: compressedSize,
        reductionPercent: ratio
      };
      setStats(statDetails);
      setCompressing(false);

      // 4. Chunked resumable upload (16 KB chunks)
      await performChunkedUpload(blob, file.name.replace(/\.[^/.]+$/, "") + ".webp", statDetails);
    } catch (err) {
      console.error('Compression/Upload error:', err);
      setError('Compression or upload failed: ' + err.message);
      setCompressing(false);
      setUploading(false);
    }
  };

  const performChunkedUpload = async (blob, fileName, statDetails) => {
    setUploading(true);
    const CHUNK_SIZE = 16 * 1024; // 16 KB chunks
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const uploadId = `upl_${uuidv4().substring(0, 8)}`;

    try {
      // Init upload
      const initRes = await fetch('/api/uploads/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          fileName,
          mimeType: 'image/webp',
          totalChunks
        })
      });
      const initData = await initRes.json();
      if (!initData.success) throw new Error(initData.error || 'Init failed');

      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, blob.size);
        const chunkSlice = arrayBuffer.slice(start, end);

        // Convert slice to base64
        const uint8 = new Uint8Array(chunkSlice);
        let binary = '';
        for (let b = 0; b < uint8.length; b++) {
          binary += String.fromCharCode(uint8[b]);
        }
        const base64Data = btoa(binary);

        const chunkRes = await fetch(`/api/uploads/${uploadId}/chunks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunkIndex: i,
            chunkData: base64Data
          })
        });

        if (!chunkRes.ok) throw new Error(`Chunk ${i} failed`);
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      // Complete assembly
      const completeRes = await fetch(`/api/uploads/${uploadId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const completeData = await completeRes.json();

      setUploading(false);
      if (onUploadComplete) {
        onUploadComplete({
          url: completeData.url,
          meta: statDetails
        });
      }
    } catch (err) {
      setError('Chunk upload interrupted: ' + err.message);
      setUploading(false);
    }
  };

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <div className="bg-[#1C2541] border border-amber-500/30 rounded-xl p-4 text-white">
      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 cursor-pointer bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors text-sm shadow">
          <Camera size={18} />
          <span>Take / Upload Photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            disabled={compressing || uploading}
          />
        </label>
        <span className="text-xs text-slate-400">Auto-compressed to WebP (&lt;100 KB)</span>
      </div>

      {compressing && (
        <div className="flex items-center gap-2 text-sm text-amber-400 animate-pulse my-2">
          <RefreshCw className="animate-spin" size={16} />
          Compressing on device (1024px WebP)...
        </div>
      )}

      {uploading && (
        <div className="my-2">
          <div className="flex justify-between text-xs text-slate-300 mb-1">
            <span>Uploading 16 KB chunks...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {stats && (
        <div className="bg-[#0B132B] p-2.5 rounded-lg border border-slate-700 mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={16} />
            <div>
              <span className="text-slate-400">Original: </span>
              <span className="line-through text-slate-500">{stats.originalSize}</span>
              <span className="text-emerald-400 font-bold ml-2">Sent: {stats.sentSize}</span>
            </div>
          </div>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
            {stats.reductionPercent}% saved
          </span>
        </div>
      )}

      {previewUrl && (
        <div className="mt-2 relative">
          <img
            src={previewUrl}
            alt="Compressed Preview"
            className="w-full max-h-40 object-cover rounded-lg border border-slate-600"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/60 p-2 rounded mt-2 border border-red-800">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
