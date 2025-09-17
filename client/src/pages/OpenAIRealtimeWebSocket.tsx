import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectState = 'idle' | 'connecting' | 'connected' | 'error';

type ConversationEntry = { id: string; role: 'user' | 'assistant'; text: string };

export default function OpenAIRealtimeWebSocketPage() {
  const [state, setState] = useState<ConnectState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const assistantBufferRef = useRef<string>('');
  const [input, setInput] = useState('Say hello in one short sentence.');

  const logEvent = (name: string) => setEvents((prev) => [name].concat(prev).slice(0, 200));

  const disconnect = useCallback(() => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    assistantBufferRef.current = '';
    setState('idle');
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const connect = useCallback(async () => {
    setError(null);
    setState('connecting');
    try {
      // Mint ephemeral client secret from dev middleware
      const sessionConfig = {
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          audio: { output: { voice: 'marin' } },
          instructions: 'You are a helpful assistant.',
        },
      };
      const secretResp = await fetch('/api/openai/realtime/client_secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionConfig),
      });
      if (!secretResp.ok) throw new Error(`Failed to mint client secret: ${secretResp.status}`);
      const { value: clientSecret } = await secretResp.json();
      if (!clientSecret) throw new Error('No client secret returned');

      const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
      const ws = new WebSocket(
        url,
        [
          'realtime',
          // Auth: browsers cannot send headers, use subprotocol
          'openai-insecure-api-key.' + clientSecret,
        ],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        logEvent('socket.open');
        setState('connected');
        // Update session (optional since client_secret was minted with config)
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: { type: 'realtime', model: 'gpt-realtime' },
          }),
        );
      };

      ws.onmessage = (evt) => {
        let data: any = null;
        try { data = JSON.parse(evt.data as string); } catch { data = evt.data; }
        const t = data?.type;
        if (typeof t === 'string') {
          logEvent(t);
          if (t === 'response.output_text.delta') {
            assistantBufferRef.current += data.delta || '';
          } else if (t === 'response.output_text.done') {
            const text = assistantBufferRef.current;
            assistantBufferRef.current = '';
            if (text) setConversation((prev) => prev.concat([{ id: data?.response_id || String(Date.now()), role: 'assistant', text }]));
          } else if (t === 'conversation.item.added' || t === 'conversation.item.created') {
            const item = data.item;
            if (item?.type === 'message' && item.role === 'user') {
              const parts = item.content || [];
              const text = parts.map((p: any) => p?.text).filter(Boolean).join(' ');
              setConversation((prev) => prev.concat([{ id: item.id || String(Date.now()), role: 'user', text }]));
            }
          }
        } else {
          logEvent('message');
        }
      };

      ws.onerror = (e) => {
        setError('WebSocket error');
        logEvent('socket.error');
      };
      ws.onclose = () => {
        logEvent('socket.close');
        disconnect();
      };
    } catch (e: any) {
      setError(e?.message || String(e));
      disconnect();
      setState('error');
    }
  }, [disconnect]);

  const sendUserMessage = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const id = 'user_' + Date.now();
    setConversation((prev) => prev.concat([{ id, role: 'user', text: input }]));
    ws.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: input }],
        },
      }),
    );
    ws.send(JSON.stringify({ type: 'response.create' }));
  }, [input]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="#/">← Back</a>
        <h2 style={{ margin: 0 }}>OpenAI Realtime via WebSocket (Browser)</h2>
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
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message"
              style={{ flex: 1 }}
            />
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
          <h3 style={{ margin: '8px 0' }}>Events</h3>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, minHeight: 0, overflow: 'auto', flex: 1 }}>
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
          This page uses a browser WebSocket to the Realtime API with an ephemeral client secret. For audio, use WebRTC or a server.
        </p>
      </div>
    </div>
  );
}


