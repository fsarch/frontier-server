import type { BodyType, HeadersType } from "./shared.type.js";

export interface ResponseType {
    type: 'response';
    statusCode: number;
    statusText: string;
    headers: HeadersType;
    body: BodyType | null;
}
