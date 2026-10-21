import db from '../db/connection.js';

export function setupSocketHandlers(io) {
  // Track online participants in cases: caseId -> Set of { socketId, userId, role, name }
  const caseRooms = new Map();

  io.on('connection', (socket) => {
    let currentCaseId = null;
    let currentUser = null;

    // 1. Join Consultation Room
    socket.on('join-case', ({ caseId, user }) => {
      currentCaseId = caseId;
      currentUser = user;
      socket.join(`case_${caseId}`);

      if (!caseRooms.has(caseId)) {
        caseRooms.set(caseId, new Map());
      }
      const room = caseRooms.get(caseId);
      room.set(socket.id, {
        socketId: socket.id,
        userId: user?.id,
        name: user?.name,
        role: user?.role
      });

      // Broadcast updated presence list
      const participants = Array.from(room.values());
      io.to(`case_${caseId}`).emit('presence', {
        caseId,
        participants
      });

      // Update doctor idle time or consultation status
      if (user?.role === 'doctor') {
        try {
          db.prepare("UPDATE cases SET status = 'in-consultation' WHERE id = ? AND status = 'pending'").run(caseId);
          io.emit('queue-update', { caseId, status: 'in-consultation' });
        } catch (e) {
          console.error('Error updating case status on join:', e);
        }
      }
    });

    // 2. Chat Message Broadcast & Ack
    socket.on('message', (msg) => {
      if (!msg.case_id) return;
      socket.to(`case_${msg.case_id}`).emit('message', msg);
      socket.emit('message-ack', { id: msg.id, status: 'sent', timestamp: Date.now() });
    });

    // 3. Consultation Mode Change (Video <-> Audio <-> Chat <-> Store-and-Forward)
    socket.on('mode-change', ({ caseId, mode, reason, estimatedKbps }) => {
      try {
        db.prepare('UPDATE cases SET consultation_mode = ? WHERE id = ?').run(mode, caseId);
      } catch (e) {
        console.error('Error recording mode change in DB:', e);
      }

      // Notify peer in the room
      socket.to(`case_${caseId}`).emit('mode-change', {
        caseId,
        mode,
        reason,
        estimatedKbps,
        timestamp: Date.now()
      });
    });

    // 4. WebRTC Signalling: Offer, Answer, ICE Candidates
    socket.on('webrtc-offer', ({ caseId, sdp }) => {
      socket.to(`case_${caseId}`).emit('webrtc-offer', {
        from: socket.id,
        sdp
      });
    });

    socket.on('webrtc-answer', ({ caseId, sdp }) => {
      socket.to(`case_${caseId}`).emit('webrtc-answer', {
        from: socket.id,
        sdp
      });
    });

    socket.on('webrtc-ice', ({ caseId, candidate }) => {
      socket.to(`case_${caseId}`).emit('webrtc-ice', {
        from: socket.id,
        candidate
      });
    });

    // 5. Cleanup on Disconnect
    socket.on('disconnect', () => {
      if (currentCaseId && caseRooms.has(currentCaseId)) {
        const room = caseRooms.get(currentCaseId);
        room.delete(socket.id);
        if (room.size === 0) {
          caseRooms.delete(currentCaseId);
        } else {
          io.to(`case_${currentCaseId}`).emit('presence', {
            caseId: currentCaseId,
            participants: Array.from(room.values())
          });
        }
      }
    });
  });
}
