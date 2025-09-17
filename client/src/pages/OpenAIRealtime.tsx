import { ConsoleTemplate, FullScreenContainer, ThemeProvider } from '@pipecat-ai/voice-ui-kit';

export default function OpenAIRealtimePage() {
  return (
    <ThemeProvider>
      <FullScreenContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%', padding: 16 }}>
          <h2 style={{ margin: 0 }}>OpenAI Realtime Beta</h2>
          <a href="#/">← Back</a>
          <ConsoleTemplate
            transportType="smallwebrtc"
            connectParams={{ connectionUrl: '/api/offer' }}
          />
        </div>
      </FullScreenContainer>
    </ThemeProvider>
  );
}


