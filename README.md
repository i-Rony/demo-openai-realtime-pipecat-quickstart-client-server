# Client/Server Web Example

Learn how to build web applications using Pipecat's client/server architecture. This approach separates your bot logic from your user interface, giving you full control over the client experience while maintaining real-time voice communication.

This example demonstrates:

- Server-side bot running with Pipecat
- React client using [Pipecat's client SDK](https://docs.pipecat.ai/client/introduction)
- Real-time voice communication between client and server
- UI components from [voice-ui-kit](https://github.com/pipecat-ai/voice-ui-kit) for common voice interface patterns

This is the recommended architecture for web applications that need custom interfaces or client-side functionality.

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) package manager installed
- `npm` installed
- AI Service API keys:
  - For default pipeline: [Deepgram](https://console.deepgram.com/signup), [OpenAI](https://auth.openai.com/create-account), and [Cartesia](https://play.cartesia.ai/sign-up)
  - For OpenAI Realtime Beta S2S page: only [OpenAI](https://auth.openai.com/create-account) is required

## Setup

This example requires running both a server and client in **two separate terminal windows**.

### Clone this repository

```bash
git clone https://github.com/pipecat-ai/pipecat-quickstart-client-server.git
cd pipecat-quickstart-client-server
```

### Terminal 1: Server Setup

1. Configure environment variables

   Create a `.env` file:

   ```bash
   cp env.example .env
   ```

   Then, add your API keys:

   ```
   DEEPGRAM_API_KEY=your_deepgram_api_key
   OPENAI_API_KEY=your_openai_api_key
   CARTESIA_API_KEY=your_cartesia_api_key
   ```

   You can optionally provide a DAILY_API_KEY for using the DailyTransport when running locally.

2. Set up a virtual environment and install dependencies

   ```bash
   uv sync
   ```

3. Run your server bot

   ```bash
   # classic pipeline (Deepgram + OpenAI + Cartesia)
   PIPELINE_MODE=classic uv run bot.py

   # OpenAI Realtime Beta basic (integrated S2S)
   PIPELINE_MODE=realtime-basic uv run bot.py

   # OpenAI Realtime Beta advanced (tools + transcripts + context)
   PIPELINE_MODE=realtime-advanced uv run bot.py
   ```

   > 💡 First run note: The initial startup may take ~15 seconds as Pipecat downloads required models, like the Silero VAD model.

### Terminal 2: Client Setup

1. Open a new terminal window and navigate to the `client` folder:

   From the `pipecat-quickstart-client-server` directory, run:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm i
   ```

3. Run the client:

   ```bash
   npm run dev
   ```

### Connect and test

**Open http://localhost:5173 in your browser**

- Default console: click `Connect` to start talking
- OpenAI Realtime Beta (basic): click "Go to OpenAI Realtime Beta demo →" or `#/realtime`
- OpenAI Realtime Beta (advanced): click "Go to Realtime Advanced demo →" or `#/realtime-advanced`
 - OpenAI Realtime Direct (no Pipecat): click "Go to OpenAI Realtime Direct (no Pipecat) →" or `#/realtime-direct`
 - OpenAI Realtime WebSocket (browser): click "Go to OpenAI Realtime WebSocket (browser) →" or `#/realtime-ws`

> 💡 **Tip**: Check your server terminal for debug logs showing Pipecat's internal workings.

## Deploy to Pipecat Cloud

You can deploy your bot to Pipecat Cloud. For guidance, follow the steps outlining in the [pipecat-quickstart's Deployment section](https://docs.pipecat.ai/getting-started/quickstart#step-2%3A-deploy-to-production).

## Troubleshooting

- **Browser permissions**: Make sure to allow microphone access when prompted by your browser.
- **Connection issues**: If the WebRTC connection fails, first try a different browser. If that fails, make sure you don't have a VPN or firewall rules blocking traffic. WebRTC uses UDP to communicate.
- **Audio issues**: Check that your microphone and speakers are working and not muted.
 - **Direct Realtime (dev server secret)**: The `#/realtime-direct` page mints an ephemeral client secret via the Vite dev server at `/api/openai/realtime/client_secret`. The dev server automatically reads `OPENAI_API_KEY` from `server/.env`. Optionally, you can set `OPENAI_API_KEY` in the client dev environment if you prefer. The secret endpoint is only for local development. Do not deploy your API key with the client.
 - **Browser WebSocket page**: The `#/realtime-ws` page also uses the same ephemeral secret endpoint to authenticate the WebSocket connection.

## Next Steps

- **Explore the client SDK**: Learn more about [Pipecat's client SDKs](https://docs.pipecat.ai/client/introduction) for web, mobile, and other platforms
- **Learn about the voice-ui-kit**: Explore [voice-ui-kit](https://github.com/pipecat-ai/voice-ui-kit) to simplify your front end development
- **Advanced examples**: Check out [pipecat-examples](https://github.com/pipecat-ai/pipecat-examples) for more complex client/server applications
- **Join Discord**: Connect with other developers on [Discord](https://discord.gg/pipecat)

### OpenAI Realtime WebSocket demo (server-to-server)

This repo includes a minimal Python WebSocket example that connects directly to OpenAI Realtime without Pipecat.

Run it with your OpenAI key:

```bash
cd server
uv sync
OPENAI_API_KEY=sk-... uv run realtime_ws_demo.py
```

It will:

- Open a WebSocket to `wss://api.openai.com/v1/realtime?model=gpt-realtime`
- Send `session.update` to configure the session
- Create a user message and request a response
- Print the assistant text as it streams (`response.output_text.delta/done`)

To extend this to audio, follow the Realtime conversations guide to send/receive base64-encoded audio events.

### OpenAI Realtime Beta details

The server supports the OpenAI Realtime Beta Speech-to-Speech service using `OpenAIRealtimeBetaLLMService` with two modes:

- Basic: end-to-end speech with turn detection
- Advanced: function calling, transcripts and context aggregation

See the Pipecat docs for configuration options and advanced usage: [OpenAI Realtime Beta service docs](https://docs.pipecat.ai/server/services/s2s/openai).
