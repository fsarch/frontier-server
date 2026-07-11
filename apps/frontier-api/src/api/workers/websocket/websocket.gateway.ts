import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway
} from '@nestjs/websockets';
import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocket } from "ws";
import { ModuleConfigurationService } from '@fsarch/server/configuration';
import { ConfigWorkersType } from "../../../types/config.type.js";
import { WorkerBootstrapService, WorkerConfigSnapshot } from '../worker-bootstrap.service.js';

type WebSocketResponseMessage<T> = {
  replyTo: string;
  payload: T;
};

@WebSocketGateway({
  transports: 'websocket',
  path: '/api/workers/websocket'
})
export class WebsocketGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly clients = new Set<WebSocket>();
  private configVersion = 0;
  private configChecksum = '';
  private configCheckInterval: NodeJS.Timeout;
  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(
    @Inject('WORKERS_CONFIG')
    private readonly workersConfigService: ModuleConfigurationService<ConfigWorkersType>,
    private readonly bootstrapService: WorkerBootstrapService,
  ) {
  }

  private get configCheckIntervalMs() {
    return this.workersConfigService.get('websocket').config_check_interval_ms;
  }

  private get workerAuthToken() {
    return this.workersConfigService.get('websocket').auth_token;
  }

  public onModuleInit() {
    this.syncAndBroadcastConfig(false)
      .catch(() => null);

    this.configCheckInterval = setInterval(() => {
      this.syncAndBroadcastConfig(false)
        .catch(() => null);
    }, this.configCheckIntervalMs);
  }

  public onModuleDestroy() {
    if (this.configCheckInterval) {
      clearInterval(this.configCheckInterval);
    }
  }

  private async syncAndBroadcastConfig(force: boolean): Promise<void> {
    if (this.clients.size === 0 && !force) {
      return;
    }

    const snapshot = await this.bootstrapService.buildSnapshot();
    const checksum = this.bootstrapService.getSnapshotChecksum(snapshot);

    if (!force && checksum === this.configChecksum) {
      return;
    }

    this.configChecksum = checksum;
    this.configVersion += 1;

    const message = JSON.stringify({
      type: 'CONFIG_SNAPSHOT',
      version: this.configVersion,
      checksum,
      payload: snapshot,
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public handleConnection(client: WebSocket) {
    const unauthorized = () => {
      client.send(JSON.stringify({
        event: 'UNAUTHORIZED',
      }));
      client.close();
    };

    const timeout = setTimeout(() => {
      unauthorized();
    }, 5000);

    const handleMessage = (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data?.event !== 'auth' || data?.data !== this.workerAuthToken) {
          unauthorized();
          return;
        }

        clearTimeout(timeout);
        client.off('message', handleMessage);
        this.clients.add(client);
      } catch {
        unauthorized();
      }
    };

    client.on('message', handleMessage);

    client.on('close', () => {
      this.clients.delete(client);
      client.off('message', handleMessage);
      clearTimeout(timeout);
    });
  }

  @SubscribeMessage('bootstrap')
  async handleMessage(client: any, payload: { id: string }): Promise<WebSocketResponseMessage<{
    version: number;
    checksum: string;
    snapshot: WorkerConfigSnapshot;
  }>> {
    try {
      const snapshot = await this.bootstrapService.buildSnapshot();
      const checksum = this.bootstrapService.getSnapshotChecksum(snapshot);

      if (checksum !== this.configChecksum) {
        this.configChecksum = checksum;
        this.configVersion += 1;
      }

      return {
        payload: {
          version: this.configVersion,
          checksum: this.configChecksum,
          snapshot,
        },
        replyTo: payload.id,
      };
    } catch (e) {
      this.logger.error('error while handling bootstrap message', e);
    }
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: any, payload: { id: string }) {
    return {
      replyTo: payload.id,
      payload: {
        ok: true,
        serverTime: Date.now(),
      },
    };
  }
}
