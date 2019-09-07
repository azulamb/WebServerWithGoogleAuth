/// <reference types="node" />
import * as http from 'http';
export declare type HeadersInit = http.OutgoingHttpHeaders;
export declare type BodyInit = Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string;
export interface Body {
    json(): Promise<any>;
    text(): Promise<string>;
}
export interface Headers {
    [Symbol.iterator](): IterableIterator<[string, string]>;
    entries(): IterableIterator<[string, string]>;
    keys(): IterableIterator<string>;
    values(): IterableIterator<string>;
}
export interface Request extends Body {
    readonly headers: Headers;
    readonly method: string;
    readonly url: string;
}
export interface Response extends Body {
}
export declare type RequestInfo = string | Request;
export interface RequestInit {
    body?: BodyInit | null;
    headers?: HeadersInit;
    method?: string;
    mode?: RequestMode;
}
export declare function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
