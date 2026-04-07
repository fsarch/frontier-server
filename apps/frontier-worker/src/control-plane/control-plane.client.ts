import WebSocket from 'ws';
import { BootstrapReply, WorkerConfigSnapshot } from '../types/worker-config.types';

type PendingMessage = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type ControlPlaneClientOptions = {
  url: string;
  authToken: string;
  heartbeatIntervalMs: number;
  onSnapshot: (version: number, snapshot: WorkerConfigSnapshot) => Promise<void> | void;
  collectHeartbeatPayload: () => Record<string, unknown>;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

export class ControlPlaneClient {
  private readonly pending = new Map<string, PendingMessage>();
  private readonly reconnectMaxDelayMs = 15_000;
  private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>;

  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly options: ControlPlaneClientOptions) {
    this.logger = this.options.logger ?? console;
  }

  public start() {
    this.stopped = false;
    this.logInfo(`starting control-plane client (url=${this.options.url})`);
    this.connect();
  }

  public stop() {
    this.stopped = true;
    this.logInfo('stopping control-plane client');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.rejectPending(new Error('control plane client stopped'));

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private connect() {
    if (this.stopped) {
      return;
    }

    this.logInfo('opening websocket connection');

    const ws = new WebSocket(this.options.url);
    this.ws = ws;

    ws.on('open', async () => {
      this.reconnectAttempt = 0;
      this.logInfo('websocket connection opened; sending auth event');
      ws.send(JSON.stringify({ event: 'auth', data: this.options.authToken }));

      try {
        this.logInfo('requesting bootstrap snapshot');
        const bootstrapReply = await this.sendWithReply<BootstrapReply>('bootstrap', null);
        this.logInfo(`received bootstrap snapshot (version=${bootstrapReply.version})`);
        await this.options.onSnapshot(bootstrapReply.version, bootstrapReply.snapshot);
        this.logInfo(`applied bootstrap snapshot (version=${bootstrapReply.version})`);
      } catch {
        this.logWarn('bootstrap request failed; closing websocket to trigger reconnect');
        ws.close();
        return;
      }

      this.logInfo(`starting heartbeat interval (${this.options.heartbeatIntervalMs}ms)`);
      this.heartbeatTimer = setInterval(() => {
        this.sendWithReply('heartbeat', this.options.collectHeartbeatPayload())
          .then(() => {
            this.logInfo('heartbeat acknowledged');
          })
          .catch(() => {
            this.logWarn('heartbeat failed');
          });
      }, this.options.heartbeatIntervalMs);
    });

    ws.on('message', async (rawMessage) => {
      try {
        const message = JSON.parse(rawMessage.toString()) as Record<string, unknown>;

        const replyTo = typeof message.replyTo === 'string' ? message.replyTo : null;

        if (replyTo && this.pending.has(replyTo)) {
          const pending = this.pending.get(replyTo)!;
          clearTimeout(pending.timeout);
          this.pending.delete(replyTo);
          pending.resolve(message.payload);
          return;
        }

        if (message.type === 'CONFIG_SNAPSHOT') {
          const version = Number(message.version ?? 0);
          const snapshot = message.payload as WorkerConfigSnapshot;

          this.logInfo(`received CONFIG_SNAPSHOT push (version=${version})`);
          await this.options.onSnapshot(version, snapshot);
          this.logInfo(`applied CONFIG_SNAPSHOT push (version=${version})`);
        }
      } catch {
        this.logWarn('received malformed websocket message; ignoring');
        return;
      }
    });

    ws.on('close', () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
      }

      this.logWarn('websocket connection closed');
      this.rejectPending(new Error('control plane websocket disconnected'));
      this.scheduleReconnect();
    });

    ws.on('error', (error) => {
      this.logError('websocket error', error);
      ws.close();
    });
  }

  private scheduleReconnect() {
    if (this.stopped) {
      return;
    }

    this.reconnectAttempt += 1;
    const delay = Math.min(1000 * (2 ** this.reconnectAttempt), this.reconnectMaxDelayMs);
    this.logWarn(`scheduling reconnect attempt ${this.reconnectAttempt} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.logInfo(`running reconnect attempt ${this.reconnectAttempt}`);
      this.connect();
    }, delay);
  }

  private async sendWithReply<T>(event: string, payload: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('websocket not connected');
    }

    const id = crypto.randomUUID();

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        this.logWarn(`request timed out (event=${event}, id=${id})`);
        reject(new Error(`timeout waiting for ${event} reply`));
      }, 5_000);

      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      this.ws?.send(JSON.stringify({
        event,
        data: {
          id,
          payload,
        },
      }));

      this.logInfo(`sent control-plane event (event=${event}, id=${id})`);
    });
  }

  private rejectPending(error: Error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private logInfo(message: string) {
    this.logger.log(`[control-plane] ${message}`);
  }

  private logWarn(message: string) {
    this.logger.warn(`[control-plane] ${message}`);
  }

  private logError(message: string, error: unknown) {
    this.logger.error(`[control-plane] ${message}`, error);
  }
}

