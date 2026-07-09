export interface HeadersType {
  [key: string]: string[];
}

export interface JsonBodyType {
  type: 'json';

  payload: unknown;
}

export interface TextBodyType {
  type: 'text';

  payload: string;
}

export type BodyType = JsonBodyType | TextBodyType;
