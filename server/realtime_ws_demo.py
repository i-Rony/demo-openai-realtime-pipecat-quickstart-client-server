import json
import os
import threading
import time

import websocket  # type: ignore
from dotenv import load_dotenv  # type: ignore


def main():
    # Load env from server/.env if present
    load_dotenv(override=True)
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("Set OPENAI_API_KEY in your environment")

    url = "wss://api.openai.com/v1/realtime?model=gpt-realtime"
    headers = ["Authorization: Bearer " + api_key]

    def on_open(ws):  # noqa: ANN001
        def run():
            # Configure the session
            ws.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": {
                            "type": "realtime",
                            "model": "gpt-realtime",
                            "audio": {"output": {"voice": "marin"}},
                            "instructions": "You are a helpful assistant.",
                        },
                    }
                )
            )

            # Create a user message in the conversation
            ws.send(
                json.dumps(
                    {
                        "type": "conversation.item.create",
                        "item": {
                            "type": "message",
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": "Say hello in one short sentence.",
                                }
                            ],
                        },
                    }
                )
            )

            # Ask the server to generate a response
            ws.send(json.dumps({"type": "response.create"}))

        threading.Thread(target=run, daemon=True).start()

    partial_text = []

    def on_message(ws, message):  # noqa: ANN001, ANN201
        try:
            data = json.loads(message)
        except Exception:  # noqa: BLE001
            print(message)
            return

        event_type = data.get("type")

        if event_type == "response.output_text.delta":
            partial_text.append(data.get("delta", ""))
        elif event_type == "response.output_text.done":
            print("\nAssistant:", "".join(partial_text))
            partial_text.clear()
        elif event_type == "response.completed":
            # Optionally close after the first response
            ws.close()
        elif event_type == "error":
            print("Error:", json.dumps(data, indent=2))
        else:
            # Uncomment to inspect all events
            # print(json.dumps(data, indent=2))
            pass

    def on_error(ws, error):  # noqa: ANN001, ANN201
        print("WebSocket error:", error)

    def on_close(ws, code, reason):  # noqa: ANN001, ANN201
        print("Closed:", code, reason)

    ws = websocket.WebSocketApp(
        url,
        header=headers,
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
    )

    # Keepalive ping/pong
    def ping_loop():
        while True:
            try:
                ws.send(json.dumps({"type": "ping", "timestamp": int(time.time())}))
            except Exception:
                break
            time.sleep(15)

    threading.Thread(target=ping_loop, daemon=True).start()
    ws.run_forever()


if __name__ == "__main__":
    main()


