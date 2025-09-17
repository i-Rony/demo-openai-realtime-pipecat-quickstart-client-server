import { ConsoleTemplate, FullScreenContainer, ThemeProvider } from '@pipecat-ai/voice-ui-kit';
import { StrictMode, useMemo, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import OpenAIRealtimePage from './pages/OpenAIRealtime';
import OpenAIRealtimeAdvancedPage from './pages/OpenAIRealtimeAdvanced';
import OpenAIRealtimeDirectPage from './pages/OpenAIRealtimeDirect';
import OpenAIRealtimeWebSocketPage from './pages/OpenAIRealtimeWebSocket';
import VoiceAgentsQuickstartPage from './pages/VoiceAgentsQuickstart';

//@ts-ignore - fontsource-variable/geist is not typed
import '@fontsource-variable/geist';
//@ts-ignore - fontsource-variable/geist is not typed
import '@fontsource-variable/geist-mono';

function useHash() {
  const subscribe = (cb: () => void) => {
    window.addEventListener('hashchange', cb);
    return () => window.removeEventListener('hashchange', cb);
  };
  const getSnapshot = () => window.location.hash || '#/' ;
  return useSyncExternalStore(subscribe, getSnapshot);
}

function Router() {
  const hash = useHash();
  const route = useMemo(() => (
    hash.startsWith('#/realtime-advanced') ? 'realtime-advanced' :
    hash.startsWith('#/realtime-direct') ? 'realtime-direct' :
    hash.startsWith('#/realtime-ws') ? 'realtime-ws' :
    hash.startsWith('#/voice-agents-quickstart') ? 'voice-agents-quickstart' :
    hash.startsWith('#/realtime') ? 'realtime' : 'home'
  ), [hash]);

  if (route === 'realtime') {
    return <OpenAIRealtimePage />;
  }
  if (route === 'realtime-advanced') {
    return <OpenAIRealtimeAdvancedPage />;
  }
  if (route === 'realtime-direct') {
    return <OpenAIRealtimeDirectPage />;
  }
  if (route === 'realtime-ws') {
    return <OpenAIRealtimeWebSocketPage />;
  }
  if (route === 'voice-agents-quickstart') {
    return <VoiceAgentsQuickstartPage />;
  }

  return (
    <ThemeProvider>
      <FullScreenContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%', padding: 16 }}>
          <h1 style={{ margin: 0 }}>Pipecat Client/Server</h1>
          <p>Default console demo. Try the OpenAI Realtime page for S2S.</p>
          <a href="#/realtime">Go to OpenAI Realtime Beta demo →</a>
          <a href="#/realtime-advanced">Go to Realtime Advanced demo →</a>
          <a href="#/realtime-direct">Go to OpenAI Realtime Direct (no Pipecat) →</a>
          <a href="#/realtime-ws">Go to OpenAI Realtime WebSocket (browser) →</a>
          <a href="#/voice-agents-quickstart">Go to Voice Agents Quickstart →</a>
          <ConsoleTemplate
            transportType="smallwebrtc"
            connectParams={{
              connectionUrl: '/api/offer',
            }}
          />
        </div>
      </FullScreenContainer>
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  // @ts-ignore
  <StrictMode>
    <Router />
  </StrictMode>
);
