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

  // Base64-encoded bytes. BodyType is JSON-serialized as-is when sent to the remote function
  // server (see FunctionClient.executeHook), and a raw Uint8Array/Buffer does not round-trip
  // through JSON.stringify/JSON.parse: Buffer overrides toJSON() to `{ type: 'Buffer', data:
  // [...] }` and a plain Uint8Array serializes to an index-keyed object - neither deserializes
  // back into a Uint8Array. Base64 is a plain string, so it survives the JSON boundary intact.
  // BodyUtils is the single place that converts between this wire format and real bytes.
  payload: string;
}

export type BodyType = JsonBodyType | TextBodyType | BinaryUint8ArrayBodyType;
