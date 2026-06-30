export type ConfigWorkersType = {
  websocket: ConfigWorkersWebsocketType;
};

export type ConfigWorkersWebsocketType = {
  auth_token: string;
  config_check_interval_ms: number;
};

export type ConfigFunctionServerType = {
  type: 'remote';
  url: string;
  auth: ConfigAuthOpenIDClientCredentialsType;
};

export type ConfigFunctionWorkerType = {
  type: 'remote';
  url: string;
  auth: ConfigAuthOpenIDClientCredentialsType;
};

export type ConfigAuthOpenIDClientCredentialsType = {
  type: 'openid-client-credentials';
  token_endpoint: string;
  client_id: string;
  client_secret: string;
};
