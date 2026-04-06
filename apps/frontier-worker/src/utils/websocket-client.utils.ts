export class WebSocketClient {
  private webSocket: WebSocket;

  public ready = Promise.resolve();

  private promises: Record<string, { resolve: (data: unknown) => void; reject: (error: Error) => void }> = {};

  constructor() {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.webSocket = new WebSocket('ws://localhost:3000/api/workers/websocket');
      this.webSocket.addEventListener('open', () => {
        resolve();

        this.webSocket.send(JSON.stringify({
          event: 'auth',
          data: 'Test',
        }));

        this.webSocket.addEventListener('message', (event) => {
          const parsedData = JSON.parse(event.data);

          if (parsedData.replyTo && this.promises[parsedData.replyTo]) {
            this.promises[parsedData.replyTo].resolve(parsedData.payload);
          }
        });
      });
    })
  }

  public async sendWithReply(name: string, payload: unknown) {
    await this.ready;

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.promises[id] = {
        resolve,
        reject,
      };

      this.webSocket.send(JSON.stringify({
        event: name,
        data: {
          id,
          payload,
        },
      }));
    })
      .finally(() => {
        delete this.promises[id];
      });
  }
}
