/// <reference types="node" />
import * as http from 'http';
import * as https from 'https';
export interface Logger {
    log(...messages: any[]): void;
    error(...messages: any[]): void;
}
export declare type Request = http.IncomingMessage;
export declare type Response = http.ServerResponse;
export interface GoogleAuthConfig {
    client_id: string;
    client_secret: string;
    scope?: string | string[];
    baseurl: string;
    path?: {
        login: string;
        logout: string;
        callback: string;
    };
    users: string[];
}
export interface ServerConfig {
    server?: http.Server | https.Server;
    logger?: Logger;
    googleauth: GoogleAuthConfig;
}
export interface GoogleTokenJSON {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token: string;
}
export interface GoogleTokenInfoJSON {
    issued_id: string;
    audience: string;
    user_id: string;
    expires_in: number;
    email: string;
    verified_email: boolean;
}
export interface Session<T> {
    create(response: Response, user: T): Promise<void>;
    get(request: Request): Promise<T>;
    logined(request: Request): Promise<void>;
    remove(request: Request): Promise<void>;
}
export declare class Server {
    private server;
    private logger;
    private session;
    private users;
    private events;
    private baseurl;
    private path_login;
    private path_logout;
    private path_callback;
    private client_id;
    private client_secret;
    private scope;
    private redirect_uri;
    constructor(config: ServerConfig);
    logined(request: Request): Promise<any>;
    start(port?: number, hostname?: string, backlog?: number): Promise<void>;
    on(event: 'public', listener: (request: Request, response: Response, user: GoogleTokenInfoJSON) => void): void;
    on(event: 'private', listener: (request: Request, response: Response) => void): void;
    private isMember;
    private error;
    private redirect;
    private login;
    private logout;
    private callback;
    private getToken;
}
