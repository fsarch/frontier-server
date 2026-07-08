import type { BodyType, HeadersType } from "./shared.type.js";

export interface Response {
    statusCode: number;
    statusText: string;
    headers: HeadersType;
    body: BodyType;
}
