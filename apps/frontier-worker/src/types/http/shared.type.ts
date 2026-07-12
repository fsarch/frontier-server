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

export interface BinaryUint8ArrayBodyType {
  type: 'binary.uint8array';

  payload: Uint8Array;
}

export type BodyType = JsonBodyType | TextBodyType | BinaryUint8ArrayBodyType;
