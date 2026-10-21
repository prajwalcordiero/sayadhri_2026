import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Send, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function VoiceRecorder({ onSendVoiceNote }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const MAX_SECONDS = 60;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // 16kHz speech sample rate
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Target low-bitrate Opus (~16 kbps)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000 // 16 kbps
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorder.start(250); // timeslice 250ms
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Audio recording access error:', err);
      setError('Microphone access denied or unsupported: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  const discardRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
    setError(null);
  };

  const sendRecording = () => {
    if (!audioBlob) return;
    const voiceNoteData = {
      id: `audio_${uuidv4().substring(0, 8)}`,
      blob: audioBlob,
      durationSec: seconds,
      sizeBytes: audioBlob.size,
      mimeType: audioBlob.type
    };
    if (onSendVoiceNote) {
      onSendVoiceNote(voiceNoteData);
    }
    discardRecording();
  };

  return (
    <div className="bg-[#1C2541] border border-amber-500/20 rounded-xl p-3 text-white">
      {!audioUrl && !isRecording && (
        <button
          onClick={startRecording}
          type="button"
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Mic size={16} />
          <span>Record Voice Note (16 kbps Opus, max 60s)</span>
        </button>
      )}

      {isRecording && (
        <div className="flex items-center justify-between bg-red-950/40 border border-red-500/50 p-2.5 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="font-mono text-sm font-bold text-red-300">
              00:{seconds < 10 ? `0${seconds}` : seconds} / 01:00
            </span>
            <span className="text-xs text-slate-400">Recording audio...</span>
          </div>
          <button
            onClick={stopRecording}
            type="button"
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <Square size={14} />
            <span>Stop</span>
          </button>
        </div>
      )}

      {audioUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 font-semibold">
              Voice Note Ready ({seconds}s, ~{Math.round(audioBlob.size / 1024)} KB)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={discardRecording}
                type="button"
                className="text-slate-400 hover:text-red-400 p-1.5 rounded transition-colors"
                title="Discard"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={sendRecording}
                type="button"
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
              >
                <Send size={14} />
                <span>Send Note</span>
              </button>
            </div>
          </div>
          <audio controls src={audioUrl} className="w-full h-8" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 mt-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
