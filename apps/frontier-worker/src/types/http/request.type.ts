import type { BodyType, HeadersType } from "./shared.type.js";

export interface QueryParams {
  [key: string]: string[];
}

export interface RequestUrl {
  scheme: string;
  host: string;
  path: string;
  port: number;
  query: QueryParams;
}

export interface RequestType {
  type: 'request';
  method: string;
  url: RequestUrl;
  headers: HeadersType;
  body: BodyType | null;
}

