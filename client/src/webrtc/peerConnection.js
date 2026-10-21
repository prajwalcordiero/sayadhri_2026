/**
 * SwasthaSetu WebRTC Engine with Bandwidth Shaping & Dynamic Degradation
 * - Max video resolution: 480x360 @ 15fps, maxBitrate 250 kbps
 * - Audio: Opus constrained to 16-24 kbps with in-band FEC
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export class WebRTCManager {
  constructor(options = {}) {
    this.socket = options.socket;
    this.caseId = options.caseId;
    this.onRemoteStream = options.onRemoteStream || (() => {});
    this.onConnectionStateChange = options.onConnectionStateChange || (() => {});
    
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentMode = 'video'; // 'video' | 'audio' | 'chat'
  }

  async initialize(mode = 'video') {
    this.currentMode = mode;
    this.cleanup();

    if (mode === 'chat' || mode === 'store-forward') {
      return null;
    }

    try {
      // 1. Acquire appropriate constrained media
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Voice-optimized 16kHz
        },
        video: mode === 'video' ? {
          width: { ideal: 480, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 15, max: 15 }
        } : false
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 2. Instantiate RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: DEFAULT_ICE_SERVERS
      });

      // 3. Attach local tracks
      this.localStream.getTracks().forEach(track => {
        const sender = this.peerConnection.addTrack(track, this.localStream);
        if (track.kind === 'video') {
          this._applyVideoBandwidthLimits(sender);
        }
      });

      // 4. Handle incoming remote stream
      this.remoteStream = new MediaStream();
      this.peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
        this.onRemoteStream(this.remoteStream);
      };

      // 5. ICE Candidate exchange
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          this.socket.emit('webrtc-ice', {
            caseId: this.caseId,
            candidate: event.candidate
          });
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          this.onConnectionStateChange(this.peerConnection.connectionState);
        }
      };

      return this.localStream;
    } catch (err) {
      console.warn('WebRTC media acquisition fallback to chat:', err.message);
      return null;
    }
  }

  // Bandwidth shaping on RTCRtpSender
  async _applyVideoBandwidthLimits(sender) {
    if (!sender || !sender.getParameters) return;
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}];
      }
      parameters.encodings[0].maxBitrate = 250000; // 250 kbps ceiling
      parameters.encodings[0].maxFramerate = 15;
      parameters.encodings[0].scaleResolutionDownBy = 1.5;
      await sender.setParameters(parameters);
    } catch (e) {
      console.warn('Could not set WebRTC bitrate parameters:', e);
    }
  }

  // Graceful degradation when network drops
  async transitionMode(targetMode) {
    if (this.currentMode === targetMode) return;
    const oldMode = this.currentMode;
    this.currentMode = targetMode;

    if (oldMode === 'video' && targetMode === 'audio') {
      // Turn off webcam video track to immediately drop bandwidth consumption from ~400kbps to ~20kbps
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
      }
    } else if (targetMode === 'chat' || targetMode === 'store-forward') {
      // Disconnect peer connection and release hardware entirely
      this.cleanup();
    } else if (oldMode === 'audio' && targetMode === 'video') {
      // Re-initialize with video
      await this.initialize('video');
    }
  }

  // WebRTC Signalling methods
  async createOffer() {
    if (!this.peerConnection) return null;
    const offer = await this.peerConnection.createOffer();
    // Prefer Opus low-bitrate with forward error correction
    offer.sdp = this._shapeSDPForOpus(offer.sdp);
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(sdp) {
    if (!this.peerConnection) await this.initialize(this.currentMode);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.peerConnection.createAnswer();
    answer.sdp = this._shapeSDPForOpus(answer.sdp);
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(sdp) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async handleIceCandidate(candidate) {
    if (this.peerConnection) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  }

  // Low-bitrate Opus SDP modifier
  _shapeSDPForOpus(sdp) {
    if (!sdp) return sdp;
    // Inject maxaveragebitrate=20000;useinbandfec=1 to cap voice bitrate at 20 kbps
    return sdp.replace(/a=rtpmap:(\d+) opus\/48000\/2/i, (match, pt) => {
      return `${match}\r\na=fmtp:${pt} maxaveragebitrate=20000;useinbandfec=1;cbr=1`;
    });
  }

  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}
