import { WebSocketClient } from "./utils/websocket-client.utils";

const webSocketClient = new WebSocketClient();

async function bootstrap() {
  const res = await webSocketClient.sendWithReply('bootstrap', null);

  console.log('start worker', res);
}

bootstrap();
