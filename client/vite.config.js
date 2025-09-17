import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";

export default defineConfig({
  base: "./", //Use relative paths so it works at any mount path
  plugins: [
    react(),
    {
      name: 'openai-ephemeral-secret-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/openai/realtime/client_secret')) {
            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
              res.end();
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }
            try {
              let body = '';
              await new Promise((resolve) => {
                req.on('data', (chunk) => (body += chunk));
                req.on('end', resolve);
              });

              const sessionConfig = body || '{}';
              // Prefer server/.env; fallback to client env
              let apiKey = undefined;
              try {
                const envPath = path.resolve(server.config.root || process.cwd(), '..', 'server', '.env');
                if (fs.existsSync(envPath)) {
                  const text = fs.readFileSync(envPath, 'utf8');
                  for (const line of text.split(/\r?\n/)) {
                    const m = line.match(/^OPENAI_API_KEY\s*=\s*(.*)\s*$/);
                    if (m) { apiKey = m[1].replace(/^['\"]|['\"]$/g, ''); break; }
                  }
                }
              } catch {}
              if (!apiKey) {
                apiKey = process.env.OPENAI_API_KEY;
              }
              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set in client dev server env' }));
                return;
              }

              const resp = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: sessionConfig,
              });
              const json = await resp.json();
              res.statusCode = resp.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(json));
              return;
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: String(e) }));
              return;
            }
          }
          next();
        });
      },
    },
  ],
  publicDir: "public",
  server: {
    allowedHosts: true, // Allows external connections like ngrok
    proxy: {
      // Proxy /api requests to the backend server
      "/api": {
        target: "http://0.0.0.0:7860", // Replace with your backend URL
        changeOrigin: true,
      },
    },
  },
});
