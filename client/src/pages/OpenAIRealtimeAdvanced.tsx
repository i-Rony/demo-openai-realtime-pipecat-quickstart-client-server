import {
  AudioClientHelper,
  ClientStatus,
  ControlBar,
  FullScreenContainer,
  SessionInfo,
  ThemeProvider,
  ConnectButton,
  Conversation,
  AudioOutput,
} from '@pipecat-ai/voice-ui-kit';

export default function OpenAIRealtimeAdvancedPage() {
  return (
    <ThemeProvider>
      <FullScreenContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="#/">← Back</a>
            <h2 style={{ margin: 0 }}>OpenAI Realtime Beta (Advanced)</h2>
            <div />
          </div>

          <p style={{ marginTop: 0 }}>This demo expects the server to run with PIPELINE_MODE=realtime-advanced.</p>

          <AudioClientHelper
            transportType="smallwebrtc"
            connectParams={{ connectionUrl: '/api/offer' }}
          >
            {({ handleConnect, handleDisconnect, loading, error }) => (
              <>
                <ControlBar>
                  <ConnectButton onConnect={handleConnect} onDisconnect={handleDisconnect} />
                </ControlBar>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%' }}>
                  <div style={{ minHeight: 0 }}>
                    <Conversation />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <SessionInfo />
                    <ClientStatus />
                    <AudioOutput />
                  </div>
                </div>

                {error ? <div style={{ color: 'red' }}>{error}</div> : null}
              </>
            )}
          </AudioClientHelper>
        </div>
      </FullScreenContainer>
    </ThemeProvider>
  );
}


