export type ConfigWorkersType = {
  websocket: ConfigWorkersWebsocketType;
};

export type ConfigWorkersWebsocketType = {
  auth_token: string;
  config_check_interval_ms: number;
};
