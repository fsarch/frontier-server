export interface HeadersType {
  [key: string]: string[];
}

export interface JsonBodyType {
  type: 'json';

  payload: unknown;
}

export type BodyType = JsonBodyType;
