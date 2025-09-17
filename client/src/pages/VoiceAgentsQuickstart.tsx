import { useCallback, useEffect, useRef, useState } from 'react';
import { FullScreenContainer, ThemeProvider } from '@pipecat-ai/voice-ui-kit';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';

type ConnectState = 'idle' | 'connecting' | 'connected' | 'error';

export default function VoiceAgentsQuickstartPage() {
  const [state, setState] = useState<ConnectState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const DEFAULT_PROMPT = `# Role & Objective
You are a helpful general assistant for a realtime voice conversation.
SUCCESS = answer clearly, keep the call moving, and resolve requests.

# Personality & Tone
Warm, concise, confident. 2–3 sentences per turn.

# Conversation Flow — Greeting
SPEAK FIRST with a short identity line and invite the user's goal.
Sample: "Hi there—how can I help today?"

# Language
Mirror the user's language. If unclear, default to English.

# Unclear audio
- Only respond to clear input.
- If input is unclear/noisy/partial, ask for clarification.

# Variety
DO NOT repeat the same sentence; vary phrasing.

# Safety & Escalation
If user explicitly asks for a human or is extremely frustrated, escalate politely.`;
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [voice, setVoice] = useState<string>('alloy');
  const [selectedLabel, setSelectedLabel] = useState<string>('Default');
  // UI styles (neutral, work in dark/light)
  const surfaceBorder = '1px solid rgba(255,255,255,0.14)';
  const surfaceBg = 'rgba(255,255,255,0.04)';
  const mutedText = 'rgba(255,255,255,0.65)';
  const radius = 12;
  const cardStyle: React.CSSProperties = { border: surfaceBorder, borderRadius: radius, padding: 16, minHeight: 0, overflow: 'auto', background: surfaceBg };
  const titleStyle: React.CSSProperties = { fontWeight: 600, margin: '0 0 12px 0' };
  const headerBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
  const primaryBtn: React.CSSProperties = { background: '#5b7cfa', color: '#fff', border: '1px solid #4d6bee', borderRadius: radius, padding: '8px 14px', cursor: 'pointer' };
  const dangerOutlineBtn: React.CSSProperties = { background: 'transparent', color: '#ff6b6b', border: '1px solid #ff6b6b', borderRadius: radius, padding: '8px 14px', cursor: 'pointer' };
  const secondaryBtn: React.CSSProperties = { background: 'transparent', color: '#c9d1d9', border: '1px solid rgba(255,255,255,0.2)', borderRadius: radius, padding: '8px 12px', cursor: 'pointer' };
  const chipBase: React.CSSProperties = { borderRadius: 999, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 12 };
  const selectStyle: React.CSSProperties = { background: 'transparent', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.2)', borderRadius: radius, padding: '8px 10px' };
  const badge = (status: ConnectState): React.CSSProperties => {
    const m: Record<ConnectState, { bg: string; fg: string; br: string }> = {
      idle: { bg: '#2d333b', fg: '#9aa7b2', br: '#3a424b' },
      connecting: { bg: '#6643ff', fg: '#ffffff', br: '#5b3be6' },
      connected: { bg: '#2e7d32', fg: '#ffffff', br: '#276b2b' },
      error: { bg: '#8b1d1d', fg: '#ffffff', br: '#7a1919' },
    };
    const c = m[status];
    return { background: c.bg, color: c.fg, border: `1px solid ${c.br}`, borderRadius: 999, padding: '6px 10px', fontSize: 12 };
  };
  const voices = ['alloy', 'marin', 'verse'];

  const suggestions: { label: string; text: string; voice: string }[] = [
    {
      label: 'Call Center Assistant',
      voice: 'marin',
      text: `# Role & Objective
You are a professional call center assistant for Acme Support.
SUCCESS = quickly identify the caller's goal, verify identity when needed, and resolve.

# Personality & Tone
Warm, efficient, confident. 2–3 sentences per turn.

# Conversation Flow — Greeting
SPEAK FIRST with identity and invitation.
Sample: "Hi, you've reached Acme Support—this is Alex. How can I help today?"

# Language
Mirror the user's language; default to English if unclear.

# Unclear audio
- Only respond to clear input.
- If unclear/noisy/partial/silent, ask for clarification.

# Variety
DO NOT repeat the same sentence; vary phrasing.

# Verification (if needed)
- When account changes/billing/security topics arise, politely verify identity.

# Resolution
- Summarize the issue briefly, ask focused follow-ups, propose clear next steps.

# Safety & Escalation
Escalate to a human on explicit request or severe dissatisfaction.`,
    },
    {
      label: 'Truck Dispatch Agent',
      voice: 'alloy',
      text: `# Role & Objective
You are a truck transportation dispatch agent for RoadRunner Logistics.
SUCCESS = coordinate loads, routes, ETAs, and check-ins with minimal back-and-forth.

# Personality & Tone
Direct, courteous, precise. 1–2 sentences per turn when possible.

# Conversation Flow — Greeting
SPEAK FIRST with identity and task focus.
Sample: "RoadRunner Dispatch—this is Alex. What load are we working on today?"

# Language
Mirror the user's language; default to English if unclear.

# Unclear audio
- Only respond to clear input.
- If unclear/noisy/partial/silent, ask for clarification.

# Load Coordination Checklist
- Pickup & delivery locations and time windows
- Equipment type (e.g., dry van, reefer), weight, special requirements
- Contact names, phone numbers, on-site instructions

# Confirmation
Confirm all critical details back to the user before concluding.

# Variety
Avoid robotic repetition; vary phrasing.

# Safety & Escalation
Escalate to a human on explicit request or operational risk.`,
    },
    {
      label: 'Hotel Receptionist',
      voice: 'verse',
      text: `# Role & Objective
You are a friendly hotel receptionist for The Regent in New York.
SUCCESS = help with reservations, check-in/out, availability, amenities, and local guidance.

# Personality & Tone
Warm, polished, efficient. 2–3 sentences per turn.

# Conversation Flow — Greeting
SPEAK FIRST with identity and invitation to assist.
Sample: "Hello, you've reached The Regent in New York—this is Alex at the front desk. How may I assist you today?"

# Language
Mirror the user's language; default to English if unclear.

# Unclear audio
- Only respond to clear input.
- If unclear/noisy/partial/silent, ask for clarification.

# Services
- Reservations, check-in/out, room types, rates, availability, amenities, late checkout
- Local recommendations on dining, transport, and attractions

# Variety
Avoid robotic repetition; vary phrasing.

# Safety & Escalation
Escalate to a human on explicit request or complex billing/security matters.`,
    },
    { label: 'Default', text: DEFAULT_PROMPT, voice: 'alloy' },
  ];

  const appendLog = (line: string) => setLog((prev) => [line].concat(prev).slice(0, 200));

  const disconnect = useCallback(() => {
    try { sessionRef.current?.close?.(); } catch {}
    sessionRef.current = null;
    setState('idle');
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const applyPromptTextVoice = useCallback((text: string, v: string) => {
    const s = sessionRef.current;
    if (!s) return;
    const promptToUse = (text || '').trim() || DEFAULT_PROMPT;
    try {
      s.transport.updateSessionConfig({
        instructions: promptToUse,
        outputModalities: ['audio', 'text'],
        audio: { output: { voice: v } },
      });
      s.transport.sendEvent({ type: 'response.create' });
      appendLog(`Applied prompt and voice (${v}); requested response.`);
    } catch {}
  }, []);

  const applyPrompt = useCallback(() => applyPromptTextVoice(prompt, voice), [applyPromptTextVoice, prompt, voice]);

  const connect = useCallback(async () => {
    setError(null);
    setState('connecting');
    try {
      const promptToUse = (prompt || '').trim() || DEFAULT_PROMPT;
      // Create agent and session
      const agent = new RealtimeAgent({
        name: 'Assistant',
        instructions: promptToUse,
      });
      const session = new RealtimeSession(agent, {
        model: 'gpt-realtime',
        config: {
          outputModalities: ['audio', 'text'],
          audio: { output: { voice } },
        },
      });
      sessionRef.current = session;

      // Mint an ephemeral client secret via Vite dev middleware
      const secretResp = await fetch('/api/openai/realtime/client_secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: { type: 'realtime', model: 'gpt-realtime', instructions: promptToUse, audio: { output: { voice } } },
        }),
      });
      if (!secretResp.ok) throw new Error(`Failed to mint client secret: ${secretResp.status}`);
      const { value: clientSecret } = await secretResp.json();
      if (!clientSecret) throw new Error('No client secret returned');

      try {
        await session.connect({ apiKey: clientSecret });
        appendLog(`Connected via RealtimeSession (WebRTC) with voice: ${voice}.`);
        // Apply current prompt/voice and trigger initial response
        applyPrompt();
        setState('connected');
      } catch (e: any) {
        throw new Error(e?.message || String(e));
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      disconnect();
      setState('error');
    }
  }, [disconnect, prompt, voice, applyPrompt]);

  return (
    <ThemeProvider>
      <FullScreenContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%', padding: 16, minHeight: 0 }}>
          <div style={headerBar}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <a href="#/">← Back</a>
              <h2 style={{ margin: 0 }}>Voice Agents Quickstart</h2>
              <span style={badge(state)}>{state}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: mutedText }}>Voice</label>
              <select
                value={voice}
                onChange={(e) => {
                  const v = e.target.value;
                  setVoice(v);
                  if (state === 'connected') {
                    applyPromptTextVoice(prompt, v);
                  }
                }}
                style={selectStyle}
              >
                {voices.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              {state !== 'connected' ? (
                <button onClick={connect} disabled={state === 'connecting'} style={primaryBtn}>
                  {state === 'connecting' ? 'Connecting…' : 'Connect'}
                </button>
              ) : (
                <>
                  <button onClick={disconnect} style={dangerOutlineBtn}>Disconnect</button>
                  <button onClick={applyPrompt} style={secondaryBtn}>Apply prompt</button>
                </>
              )}
            </div>
          </div>

          <div>
            <p style={{ marginTop: 0 }}>
              This page demonstrates building a minimal voice agent in the browser using the OpenAI
              Agents SDK with Realtime WebRTC. It uses a dev-only ephemeral secret endpoint.
            </p>
        </div>

        {error ? <div style={{ color: '#ff8888' }}>{error}</div> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, minHeight: 0, flex: 1 }}>
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={titleStyle}>System Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the agent's persona and behavior"
              rows={14}
              style={{ width: '100%', resize: 'vertical', padding: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', background: 'rgba(255,255,255,0.02)', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
              {suggestions.map((s, idx) => {
                const colors = [
                  { bg: '#e7f1ff', br: '#b6d4fe', fg: '#084298' }, // primary-ish
                  { bg: '#e8f5e9', br: '#c8e6c9', fg: '#1b5e20' }, // success-ish
                  { bg: '#fff3cd', br: '#ffe69c', fg: '#664d03' }, // warning-ish
                  { bg: '#f8f9fa', br: '#ced4da', fg: '#343a40' }, // default
                ];
                const c = colors[idx % colors.length];
                const isActive = selectedLabel === s.label;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setPrompt(s.text);
                      setVoice(s.voice);
                      setSelectedLabel(s.label);
                      if (state === 'connected') {
                        applyPromptTextVoice(s.text, s.voice);
                      }
                    }}
                    style={{
                      ...chipBase,
                      background: isActive ? c.fg : c.bg,
                      borderColor: isActive ? c.fg : c.br,
                      color: isActive ? '#fff' : c.fg,
                    }}
                  >
                    {s.label} · voice: {s.voice}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={titleStyle}>Logs</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 11, lineHeight: '18px', whiteSpace: 'pre-wrap', overflow: 'auto', flex: 1, color: mutedText }}>
              {log.length === 0 ? <div style={{ opacity: 0.6 }}>No logs yet.</div> : null}
              {log.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
          </div>
        </div>

          <div style={{ opacity: 0.7, color: mutedText }}>
            <p>
              Grant microphone access when prompted. The SDK automatically configures audio in/out.
            </p>
          </div>
        </div>
      </FullScreenContainer>
    </ThemeProvider>
  );
}


