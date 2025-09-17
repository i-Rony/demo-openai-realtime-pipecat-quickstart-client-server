import { useCallback, useEffect, useRef, useState } from 'react';
import { FullScreenContainer, ThemeProvider } from '@pipecat-ai/voice-ui-kit';

type ConnectState = 'idle' | 'connecting' | 'connected' | 'error';

export default function OpenAIRealtimeDirectPage() {
  const [state, setState] = useState<ConnectState>('idle');
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  type ConversationEntry = { id: string; role: 'user' | 'assistant'; text: string };
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const assistantBufferRef = useRef<string>('');
  const [events, setEvents] = useState<string[]>([]);
  const [stats, setStats] = useState<{ inKbps: number; outKbps: number; rttMs: number; packetsSent: number; packetsReceived: number } | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const lastStatsRef = useRef<{ ts: number; bytesSent: number; bytesReceived: number } | null>(null);
  const [input, setInput] = useState<string>('Say hello in one short sentence.');

  const disconnect = useCallback(() => {
    try {
      pcRef.current?.getSenders().forEach((s) => {
        try { s.track?.stop(); } catch {}
      });
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    try { dataChannelRef.current?.close(); } catch {}
    dataChannelRef.current = null;
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;
    if (statsTimerRef.current) {
      window.clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    lastStatsRef.current = null;
    assistantBufferRef.current = '';
    setConversation([]);
    setEvents([]);
    setStats(null);
    setState('idle');
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const connect = useCallback(async () => {
    setError(null);
    setState('connecting');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = mic;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio playback
      pc.addEventListener('track', (event) => {
        const [remoteStream] = event.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {});
        }
      });

      // Data channel for events (Realtime API sends JSON events)
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;
      dc.onopen = () => {
        try {
          dc.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                type: 'realtime',
                model: 'gpt-realtime',
                // Request both audio and text, and enable input transcription so we see user messages
                modalities: ['audio', 'text'],
                instructions: 'You are a helpful assistant.',
                audio: {
                  output: { voice: 'marin' },
                  input: { transcription: { enabled: true } },
                },
              },
            })
          );
        } catch {}
      };
      const handleEventMessage = (raw: any) => {
        try {
          const msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(String(raw));
          const t = msg?.type as string | undefined;
          if (!t) {
            setEvents((prev) => [String(raw)].concat(prev).slice(0, 200));
            return;
          }
          if (t === 'response.output_text.delta') {
            assistantBufferRef.current += msg.delta || '';
          } else if (t === 'response.output_text.done') {
            const text = assistantBufferRef.current;
            assistantBufferRef.current = '';
            if (text) {
              setConversation((prev) => prev.concat([{ id: msg?.response_id || String(Date.now()), role: 'assistant', text }]));
            }
          } else if (t === 'response.output_audio_transcript.delta') {
            // Some models emit audio transcripts separately
            assistantBufferRef.current += msg.delta || '';
          } else if (t === 'response.output_audio_transcript.done') {
            const text = assistantBufferRef.current;
            assistantBufferRef.current = '';
            if (text) {
              setConversation((prev) => prev.concat([{ id: msg?.response_id || String(Date.now()), role: 'assistant', text }]));
            }
          } else if (t === 'conversation.item.added' || t === 'conversation.item.created') {
            const item = msg.item;
            if (item?.type === 'message' && item.role === 'user') {
              const parts = item.content || [];
              const text = parts.map((p: any) => p?.text).filter(Boolean).join(' ');
              setConversation((prev) => prev.concat([{ id: item.id || String(Date.now()), role: 'user', text }]));
            }
          }
          setEvents((prev) => [t].concat(prev).slice(0, 200));
        } catch {
          setEvents((prev) => [String(raw)].concat(prev).slice(0, 200));
        }
      };
      dc.onmessage = (ev) => handleEventMessage(ev.data);
      pc.addEventListener('datachannel', (ev) => {
        // Some implementations may open their own channel
        const ch = ev.channel;
        ch.onmessage = (e) => handleEventMessage(e.data);
      });

      // Add microphone tracks
      for (const track of mic.getTracks()) {
        pc.addTrack(track, mic);
      }

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete for a full SDP
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc.addEventListener('icegatheringstatechange', check);
      });

      // Request ephemeral client secret from our dev server middleware
      const sessionConfig = {
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          audio: { output: { voice: 'marin' } },
        },
      };

      const secretResp = await fetch('/api/openai/realtime/client_secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionConfig),
      });
      if (!secretResp.ok) throw new Error(`Failed to mint client secret: ${secretResp.status}`);
      const secretJson = await secretResp.json();
      const clientSecret = secretJson?.value;
      if (!clientSecret) throw new Error('No client secret returned');

      // Exchange SDP with OpenAI
      const baseUrl = 'https://api.openai.com/v1/realtime/calls';
      const sdpResponse = await fetch(baseUrl, {
        method: 'POST',
        body: pc.localDescription?.sdp || '',
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
      });
      if (!sdpResponse.ok) throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
      const sdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp });

      // Start periodic stats polling
      statsTimerRef.current = window.setInterval(async () => {
        if (!pcRef.current) return;
        try {
          const report = await pcRef.current.getStats();
          let bytesSent = 0;
          let bytesReceived = 0;
          let rtt = 0;
          let packetsSent = 0;
          let packetsReceived = 0;
          report.forEach((stat: any) => {
            if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
              bytesSent += stat.bytesSent || 0;
              packetsSent += stat.packetsSent || 0;
            }
            if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
              bytesReceived += stat.bytesReceived || 0;
              packetsReceived += stat.packetsReceived || 0;
            }
            if (stat.type === 'candidate-pair' && stat.nominated) {
              rtt = Math.round((stat.currentRoundTripTime || 0) * 1000);
            }
          });
          const now = Date.now();
          const last = lastStatsRef.current;
          let inKbps = 0;
          let outKbps = 0;
          if (last) {
            const dt = Math.max(1, now - last.ts) / 1000;
            inKbps = Math.round(((bytesReceived - last.bytesReceived) * 8) / 1000 / dt);
            outKbps = Math.round(((bytesSent - last.bytesSent) * 8) / 1000 / dt);
          }
          lastStatsRef.current = { ts: now, bytesSent, bytesReceived };
          setStats({ inKbps, outKbps, rttMs: rtt, packetsSent, packetsReceived });
        } catch {}
      }, 1000);

      setState('connected');
    } catch (e: any) {
      setError(e?.message || String(e));
      disconnect();
      setState('error');
    }
  }, [disconnect]);

  const sendUserMessage = useCallback(() => {
    const ch = dataChannelRef.current;
    if (!ch || ch.readyState !== 'open') return;
    try {
      ch.send(
        JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: input }],
          },
        })
      );
      setConversation((prev) => prev.concat([{ id: 'user_' + Date.now(), role: 'user', text: input }]));
      ch.send(JSON.stringify({ type: 'response.create' }));
    } catch {}
  }, [input]);

  return (
    <ThemeProvider>
      <FullScreenContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%', padding: 16, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="#/">← Back</a>
            <h2 style={{ margin: 0 }}>OpenAI Realtime Direct (WebRTC)</h2>
            <div />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {state !== 'connected' ? (
              <button onClick={connect} disabled={state === 'connecting'}>
                {state === 'connecting' ? 'Connecting…' : 'Connect'}
              </button>
            ) : (
              <button onClick={disconnect}>Disconnect</button>
            )}
            {error ? <span style={{ color: 'red' }}>{error}</span> : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, minHeight: 0, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <h3 style={{ margin: '8px 0' }}>Conversation</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message" style={{ flex: 1 }} />
                <button onClick={sendUserMessage} disabled={state !== 'connected' || !input.trim()}>Send</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                {conversation.length === 0 ? <div style={{ opacity: 0.6 }}>No messages yet.</div> : null}
                {conversation.map((m) => (
                  <div key={m.id} style={{ marginBottom: 8 }}>
                    <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong> {m.text}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
              <h3 style={{ margin: '8px 0' }}>Session</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minHeight: 0 }}>
                <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Stats</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    <div>State: {state}</div>
                    <div>In: {stats ? stats.inKbps : 0} kbps</div>
                    <div>Out: {stats ? stats.outKbps : 0} kbps</div>
                    <div>RTT: {stats ? stats.rttMs : 0} ms</div>
                    <div>Pkts Sent: {stats ? stats.packetsSent : 0}</div>
                    <div>Pkts Recv: {stats ? stats.packetsReceived : 0}</div>
                  </div>
                </div>
                <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Audio</div>
                  <audio ref={remoteAudioRef} autoPlay playsInline />
                </div>
              </div>
              <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 0, overflow: 'auto', flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Events</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                  {events.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ opacity: 0.7 }}>
            <p style={{ marginTop: 0 }}>
              This page connects your microphone directly to OpenAI's Realtime API using WebRTC.
              Audio output will play automatically when the model responds.
            </p>
          </div>
        </div>
      </FullScreenContainer>
    </ThemeProvider>
  );
}


