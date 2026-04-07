import WebSocket from 'ws';

export class WebSocketClient {
  private readonly promises: Record<string, { resolve: (data: unknown) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = {};
  private webSocket: WebSocket;

  public readonly ready: Promise<void>;

  constructor(
    private readonly url = process.env.FRONTIER_CONTROL_PLANE_URL ?? 'ws://localhost:3000/api/workers/websocket',
    private readonly token = process.env.FRONTIER_WORKER_AUTH_TOKEN ?? 'Test',
  ) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      this.webSocket = new WebSocket(this.url);

      this.webSocket.once('open', () => {
        this.webSocket.send(JSON.stringify({ event: 'auth', data: this.token }));
        resolve();
      });

      this.webSocket.on('message', (event) => {
        const parsedData = JSON.parse(event.toString());

        if (!parsedData.replyTo || !this.promises[parsedData.replyTo]) {
          return;
        }

        const pending = this.promises[parsedData.replyTo];
        clearTimeout(pending.timeout);
        pending.resolve(parsedData.payload);
        delete this.promises[parsedData.replyTo];
      });

      this.webSocket.once('error', (error) => {
        reject(error);
      });
    });
  }

  public async sendWithReply(name: string, payload: unknown) {
    await this.ready;
    const id = crypto.randomUUID();

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        delete this.promises[id];
        reject(new Error(`Timeout waiting for ${name}`));
      }, 5000);

      this.promises[id] = { resolve, reject, timeout };

      this.webSocket.send(JSON.stringify({
        event: name,
        data: {
          id,
          payload,
        },
      }));
    });
  }
}
