import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Camera,
  Paperclip,
  Check,
  CheckCheck,
  Clock,
  HardDrive,
  AlertCircle,
  Activity,
  FileText,
  User,
  Stethoscope,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { WebRTCManager } from '../webrtc/peerConnection.js';
import ImageUploader from '../components/ImageUploader.jsx';
import VoiceRecorder from '../components/VoiceRecorder.jsx';
import { enqueueOutboxItem, saveMessagesLocally, getLocalMessages } from '../outbox/db.js';

export default function ConsultationRoom({
  caseId,
  user,
  mode,
  controller,
  onNavigate,
  t
}) {
  const [caseDetails, setCaseDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [presence, setPresence] = useState([]);
  const [transitionToast, setTransitionToast] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Doctor prescription form state
  const [diagnosisNote, setDiagnosisNote] = useState('');
  const [medicines, setMedicines] = useState([
    { name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', days: '3' }
  ]);
  const [followUpDays, setFollowUpDays] = useState(5);
  const [savingAdvice, setSavingAdvice] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const webrtcRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isDoctor = user?.role === 'doctor';

  // 1. Fetch Case Details and Cached Messages
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // Load offline cache first
      try {
        const cached = await getLocalMessages(caseId);
        if (cached && cached.length > 0 && isMounted) {
          setMessages(cached);
        }
      } catch (e) {}

      // Fetch from API
      try {
        const res = await fetch(`/api/cases/${caseId}`);
        const data = await res.json();
        if (data.success && isMounted) {
          setCaseDetails(data.caseItem);
          if (data.messages) {
            setMessages(data.messages);
            await saveMessagesLocally(caseId, data.messages);
          }
        }
      } catch (e) {
        console.warn('Working from offline cache for case', caseId);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [caseId]);

  // 2. Setup Socket.IO and WebRTC Manager
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.emit('join-case', { caseId, user });

    socket.on('presence', ({ participants }) => {
      setPresence(participants || []);
    });

    socket.on('message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        saveMessagesLocally(caseId, updated);
        return updated;
      });
    });

    socket.on('mode-change', ({ mode: newMode, reason }) => {
      setTransitionToast({
        title: `Peer downgraded to ${newMode.toUpperCase()}`,
        desc: reason || 'Network bandwidth decreased.'
      });
      setTimeout(() => setTransitionToast(null), 5000);
    });

    // Initialize WebRTC
    const webrtc = new WebRTCManager({
      socket,
      caseId,
      onRemoteStream: (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      }
    });
    webrtcRef.current = webrtc;

    webrtc.initialize(mode).then(stream => {
      if (stream && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    });

    // WebRTC Signalling Handlers
    socket.on('webrtc-offer', async ({ sdp }) => {
      const answer = await webrtc.handleOffer(sdp);
      socket.emit('webrtc-answer', { caseId, sdp: answer });
    });

    socket.on('webrtc-answer', async ({ sdp }) => {
      await webrtc.handleAnswer(sdp);
    });

    socket.on('webrtc-ice', async ({ candidate }) => {
      await webrtc.handleIceCandidate(candidate);
    });

    return () => {
      webrtc.cleanup();
      socket.disconnect();
    };
  }, [caseId, user]);

  // 3. React to Mode Controller Transitions (Hysteresis-governed)
  useEffect(() => {
    if (!webrtcRef.current) return;
    webrtcRef.current.transitionMode(mode);

    // Broadcast mode change to remote peer
    if (socketRef.current) {
      socketRef.current.emit('mode-change', {
        caseId,
        mode,
        reason: controller.lastTransitionReason
      });
    }

    // Trigger local user toast
    setTransitionToast({
      title: `Mode shifted to ${mode.toUpperCase()}`,
      desc: controller.lastTransitionReason
    });
    const timer = setTimeout(() => setTransitionToast(null), 5000);
    return () => clearTimeout(timer);
  }, [mode, controller.lastTransitionReason]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message (with Outbox Store & Forward fallback)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const msgId = `msg_${uuidv4().substring(0, 8)}`;
    const newMsg = {
      id: msgId,
      case_id: caseId,
      sender_id: user.id,
      sender_role: user.role,
      sender_name: user.name,
      content: inputText,
      message_type: 'text',
      created_at: Date.now(),
      status: 'pending'
    };

    setInputText('');
    setMessages(prev => [...prev, newMsg]);

    const isOffline = mode === 'store-forward' || !navigator.onLine;

    if (isOffline) {
      await enqueueOutboxItem({
        id: `outbox_msg_${msgId}`,
        type: 'message',
        endpoint: `/api/cases/${caseId}/messages`,
        payload: newMsg
      });
    } else {
      try {
        const res = await fetch(`/api/cases/${caseId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMsg)
        });
        if (res.ok) {
          newMsg.status = 'sent';
          if (socketRef.current) socketRef.current.emit('message', newMsg);
        } else {
          await enqueueOutboxItem({
            id: `outbox_msg_${msgId}`,
            type: 'message',
            endpoint: `/api/cases/${caseId}/messages`,
            payload: newMsg
          });
        }
      } catch (err) {
        await enqueueOutboxItem({
          id: `outbox_msg_${msgId}`,
          type: 'message',
          endpoint: `/api/cases/${caseId}/messages`,
          payload: newMsg
        });
      }
    }
  };

  // Image Upload Completed Handler
  const handleImageUploaded = async ({ url, meta }) => {
    setShowUploader(false);
    const msgId = `msg_img_${uuidv4().substring(0, 8)}`;
    const imgMsg = {
      id: msgId,
      case_id: caseId,
      sender_id: user.id,
      sender_role: user.role,
      sender_name: user.name,
      content: 'Medical Photo Uploaded',
      message_type: 'image',
      attachment_url: url,
      attachment_meta: meta,
      created_at: Date.now()
    };

    setMessages(prev => [...prev, imgMsg]);
    if (socketRef.current) socketRef.current.emit('message', imgMsg);

    try {
      await fetch(`/api/cases/${caseId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imgMsg)
      });
    } catch (e) {
      await enqueueOutboxItem({
        id: `outbox_msg_${msgId}`,
        type: 'message',
        endpoint: `/api/cases/${caseId}/messages`,
        payload: imgMsg
      });
    }
  };

  // Voice Note Send Handler
  const handleSendVoiceNote = async (voiceNote) => {
    setShowRecorder(false);
    const msgId = `msg_aud_${uuidv4().substring(0, 8)}`;
    const audMsg = {
      id: msgId,
      case_id: caseId,
      sender_id: user.id,
      sender_role: user.role,
      sender_name: user.name,
      content: `Voice Note (${voiceNote.durationSec}s)`,
      message_type: 'audio',
      attachment_meta: { duration: voiceNote.durationSec, size: voiceNote.sizeBytes },
      created_at: Date.now()
    };

    setMessages(prev => [...prev, audMsg]);
    if (socketRef.current) socketRef.current.emit('message', audMsg);
  };

  // Doctor Submit Prescription Advice
  const handleSavePrescription = async () => {
    setSavingAdvice(true);
    const payload = {
      doctor_id: user.id,
      diagnosis_note: diagnosisNote || 'Treatment advised as per clinical presentation.',
      medicines,
      follow_up_days: Number(followUpDays) || 7,
      mark_completed: true
    };

    try {
      const res = await fetch(`/api/cases/${caseId}/advice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowPrescriptionModal(false);
        setTransitionToast({
          title: 'Prescription Issued',
          desc: 'Dispatched to patient app and sent via SMS fallback.'
        });
      }
    } catch (e) {
      await enqueueOutboxItem({
        id: `outbox_adv_${Date.now()}`,
        type: 'advice',
        endpoint: `/api/cases/${caseId}/advice`,
        payload
      });
      setShowPrescriptionModal(false);
    } finally {
      setSavingAdvice(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-2 sm:p-4 h-[calc(100vh-65px)] flex flex-col space-y-2">
      {/* Dynamic Mode Transition Banner */}
      {transitionToast && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <Activity size={16} />
            <span>{transitionToast.title}: {transitionToast.desc}</span>
          </div>
          <button onClick={() => setTransitionToast(null)} className="font-mono">✕</button>
        </div>
      )}

      {/* Main Consultation Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 overflow-hidden">
        
        {/* Left 2 Cols: Media Feed / Call Controls */}
        <div className="md:col-span-2 flex flex-col bg-[#1C2541] border border-slate-700 rounded-2xl p-3 overflow-hidden shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-700/60 mb-2">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${mode === 'video' ? 'bg-emerald-400' : mode === 'audio' ? 'bg-amber-400' : 'bg-orange-400'}`} />
              <h2 className="text-sm font-bold text-white capitalize">
                {mode === 'video' ? 'WebRTC Low-Bandwidth Video' : mode === 'audio' ? 'Opus Audio Call (20 kbps)' : mode === 'chat' ? 'Interactive Chat Mode' : 'Store & Forward Offline Mode'}
              </h2>
            </div>
            <div className="text-[11px] text-slate-400">
              Room: #{caseId.substring(0, 8)} • {presence.length} active
            </div>
          </div>

          {/* Video / Audio Area */}
          <div className="flex-1 bg-[#0B132B] rounded-xl overflow-hidden relative flex items-center justify-center min-h-[220px]">
            {mode === 'video' ? (
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                {/* Remote Video */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                {/* Local Video Thumbnail */}
                <div className="absolute bottom-3 right-3 w-28 h-20 bg-slate-900 rounded-lg overflow-hidden border border-amber-500/50 shadow-md">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 text-[9px] bg-slate-950/80 text-amber-300 px-1 rounded">
                    You
                  </span>
                </div>
              </div>
            ) : mode === 'audio' ? (
              <div className="text-center p-6 space-y-3">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300 animate-pulse">
                  <Mic size={36} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Audio Call Active (16-24 kbps)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Video disabled to preserve bandwidth on rural towers.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-2">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-400 flex items-center justify-center mx-auto text-orange-400">
                  <HardDrive size={28} />
                </div>
                <h3 className="font-bold text-white text-sm">
                  {mode === 'chat' ? 'Text & Media Consultation Active' : 'Store-and-Forward Outbox Engaged'}
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Audio & video disconnected. All messages and notes are safely queued locally.
                </p>
              </div>
            )}
          </div>

          {/* Media Bar Controls */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMicOn(!isMicOn)}
                disabled={mode === 'chat' || mode === 'store-forward'}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  isMicOn ? 'bg-slate-800 text-white border-slate-600' : 'bg-red-950 text-red-300 border-red-800'
                }`}
                title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
              >
                {isMicOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button
                onClick={() => setIsCameraOn(!isCameraOn)}
                disabled={mode !== 'video'}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  isCameraOn ? 'bg-slate-800 text-white border-slate-600' : 'bg-red-950 text-red-300 border-red-800'
                }`}
                title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isCameraOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
            </div>

            {/* Doctor Advice Action Button */}
            {isDoctor && (
              <button
                onClick={() => setShowPrescriptionModal(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow cursor-pointer"
              >
                <Stethoscope size={15} />
                <span>Write Prescription</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('cases')}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <PhoneOff size={15} />
              <span>Leave Room</span>
            </button>
          </div>
        </div>

        {/* Right Col: Consultation Chat & Attachments */}
        <div className="flex flex-col bg-[#1C2541] border border-slate-700 rounded-2xl overflow-hidden shadow-lg">
          {/* Case Quick Details Header */}
          <div className="bg-[#161F38] p-3 border-b border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">
                {caseDetails?.patient_name} ({caseDetails?.patient_age}y)
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                caseDetails?.urgency === 'Emergency' ? 'bg-red-500 text-white' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {caseDetails?.urgency}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Village: {caseDetails?.patient_village}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
            {messages.map(msg => {
              const isMe = msg.sender_id === user.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className="text-[10px] text-slate-400 mb-0.5 px-1">
                    {msg.sender_name} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  <div className={`p-2.5 rounded-2xl max-w-[85%] text-xs shadow-sm ${
                    msg.message_type === 'advice'
                      ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-100'
                      : isMe
                      ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none'
                      : 'bg-[#0B132B] border border-slate-700 text-slate-100 rounded-bl-none'
                  }`}>
                    {msg.message_type === 'image' && msg.attachment_url && (
                      <div className="mb-2">
                        <img
                          src={msg.attachment_url}
                          alt="Medical attachment"
                          className="rounded-lg max-h-48 object-cover border border-slate-700"
                        />
                        {msg.attachment_meta && (
                          <div className="text-[10px] text-slate-300 mt-1 font-mono">
                            Compressed: {msg.attachment_meta.sentSize || '<100 KB'}
                          </div>
                        )}
                      </div>
                    )}

                    {msg.message_type === 'advice' && (
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-300 flex items-center gap-1">
                          <Stethoscope size={14} />
                          <span>Medical Advice & Prescription</span>
                        </div>
                        <p>{msg.content}</p>
                      </div>
                    )}

                    {msg.message_type === 'text' && <p>{msg.content}</p>}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Media Pickers (Image & Voice) */}
          {showUploader && (
            <div className="p-2 border-t border-slate-700">
              <ImageUploader onUploadComplete={handleImageUploaded} />
            </div>
          )}

          {showRecorder && (
            <div className="p-2 border-t border-slate-700">
              <VoiceRecorder onSendVoiceNote={handleSendVoiceNote} />
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-2.5 bg-[#161F38] border-t border-slate-700 flex items-center gap-1.5">
            <button
              onClick={() => { setShowUploader(!showUploader); setShowRecorder(false); }}
              type="button"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
              title="Upload Photo (<100KB WebP)"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => { setShowRecorder(!showRecorder); setShowUploader(false); }}
              type="button"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
              title="Record Voice Note (Opus 16kbps)"
            >
              <Mic size={16} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage(e)}
              placeholder={t.typeMessagePlaceholder}
              className="flex-1 bg-[#0B132B] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            />

            <button
              onClick={handleSendMessage}
              type="button"
              className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors cursor-pointer"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Doctor Prescription Advice Modal */}
      {showPrescriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C2541] border border-amber-500/40 rounded-2xl p-5 max-w-lg w-full text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <h3 className="font-bold text-base text-amber-300 flex items-center gap-2">
                <Stethoscope size={18} />
                <span>{t.writeAdvice}</span>
              </h3>
              <button
                onClick={() => setShowPrescriptionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t.diagnosisLabel}</label>
              <textarea
                rows={2}
                value={diagnosisNote}
                onChange={e => setDiagnosisNote(e.target.value)}
                placeholder="e.g. Acute viral pharyngitis with mild dehydration."
                className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-2.5 text-xs focus:border-amber-400 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">Prescribed Medicines:</span>
                <button
                  type="button"
                  onClick={() => setMedicines([...medicines, { name: '', dosage: '', frequency: '', days: '' }])}
                  className="text-xs text-amber-400 font-bold hover:underline"
                >
                  {t.addMedicine}
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {medicines.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-1.5 bg-[#0B132B] p-2 rounded-lg text-xs">
                    <input
                      type="text"
                      placeholder="Name"
                      value={m.name}
                      onChange={e => {
                        const copy = [...medicines];
                        copy[idx].name = e.target.value;
                        setMedicines(copy);
                      }}
                      className="bg-transparent border-b border-slate-700 outline-none text-white text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={m.dosage}
                      onChange={e => {
                        const copy = [...medicines];
                        copy[idx].dosage = e.target.value;
                        setMedicines(copy);
                      }}
                      className="bg-transparent border-b border-slate-700 outline-none text-white text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="Freq (1-0-1)"
                      value={m.frequency}
                      onChange={e => {
                        const copy = [...medicines];
                        copy[idx].frequency = e.target.value;
                        setMedicines(copy);
                      }}
                      className="bg-transparent border-b border-slate-700 outline-none text-white text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="Days"
                      value={m.days}
                      onChange={e => {
                        const copy = [...medicines];
                        copy[idx].days = e.target.value;
                        setMedicines(copy);
                      }}
                      className="bg-transparent border-b border-slate-700 outline-none text-white text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">{t.followUpDays}</label>
              <input
                type="number"
                value={followUpDays}
                onChange={e => setFollowUpDays(e.target.value)}
                className="w-full bg-[#0B132B] border border-slate-700 rounded-xl p-2 text-xs outline-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrescription}
                disabled={savingAdvice}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
              >
                {savingAdvice ? 'Dispatching...' : t.btnSubmitAdvice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
