import type { BodyType, HeadersType } from "./shared.type.js";

export interface ResponseType {
    statusCode: number;
    statusText: string;
    headers: HeadersType;
    body: BodyType;
}
