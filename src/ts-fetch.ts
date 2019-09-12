import * as http from 'http'
import * as https from 'https'
import { URL } from 'url';

export type HeadersInit = http.OutgoingHttpHeaders;//Headers | string[][] | Record<string, string>;

export type BodyInit = Blob | BufferSource | FormData | URLSearchParams | ReadableStream<Uint8Array> | string;

export interface Body
{
	//readonly body: ReadableStream<Uint8Array> | null;
	//readonly bodyUsed: boolean;
	//arrayBuffer(): Promise<ArrayBuffer>;
	//blob(): Promise<Blob>;
	//formData(): Promise<FormData>;
	json(): Promise<any>;
	text(): Promise<string>;
}

export interface Headers
{
	[Symbol.iterator](): IterableIterator<[string, string]>;
	entries(): IterableIterator<[string, string]>;
	keys(): IterableIterator<string>;
	values(): IterableIterator<string>;
/*	append(name: string, value: string): void;
	delete(name: string): void;
	get(name: string): string | null;
	has(name: string): boolean;
	set(name: string, value: string): void;
	forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void;
*/}

export interface Request extends Body
{
	//readonly cache: RequestCache;
	//readonly credentials: RequestCredentials;
	//readonly destination: RequestDestination;
	readonly headers: Headers;
	//readonly integrity: string;
	//readonly isHistoryNavigation: boolean;
	//readonly isReloadNavigation: boolean;
	//readonly keepalive: boolean;
	readonly method: string;
	//readonly mode: RequestMode;
	//readonly redirect: RequestRedirect;
	//readonly referrer: string;
	//readonly referrerPolicy: ReferrerPolicy;
	//readonly signal: AbortSignal;
	readonly url: string;
	//clone(): Request;
}

export interface Response extends Body
{
	//readonly headers: Headers;
	//readonly ok: boolean;
	//readonly redirected: boolean;
	//readonly status: number;
	//readonly statusText: string;
	//readonly trailer: Promise<Headers>;
	//readonly type: ResponseType;
	//readonly url: string;
	//clone(): Response;
}

export type RequestInfo = string | Request;

export interface RequestInit
{
	body?: BodyInit | null;
	//cache?: RequestCache;
	//credentials?: RequestCredentials;
	headers?: HeadersInit;
	//integrity?: string;
	//keepalive?: boolean;
	method?: string;
	mode?: RequestMode;
	//redirect?: RequestRedirect;
	//referrer?: string;
	//referrerPolicy?: ReferrerPolicy;
	//signal?: AbortSignal | null;
	//window?: any;
}

function HtRequest( options: http.RequestOptions, callback?: ( res: http.IncomingMessage ) => void )
{
	return ( options.protocol === 'http:' ? http : https ).request( options, callback );
}

function CreateResponse( response: http.IncomingMessage ): Response
{
	const res: Response =  <any>{};

	res.text = () =>
	{
		return new Promise( ( resolve, reject ) =>
		{
			let data = '';
			response.setEncoding( 'utf8' );
			response.on( 'data', ( d ) => { data += d; } );
			response.on( 'end', () => { resolve( data ); } );
		} );
	};

	res.json = () =>
	{
		return res.text().then( ( result ) => { return JSON.parse( result ); } );
	};

	return res;
}

export function fetch( input: RequestInfo, init?: RequestInit ): Promise<Response>
{
	return new Promise<any>( ( resolve, reject ) =>
	{
		const options: http.RequestOptions = {};
		if ( typeof input === 'string' )
		{
			try
			{
				const url = new URL( input );
				options.hostname = url.hostname;
				options.port = url.protocol === 'http:' ? 80 : 443;
				options.method = 'GET';
				options.path = url.pathname + ( url.search || '' );
			} catch( error ) { return reject( error ); }
		}
		if ( init )
		{
			if ( init.method ) { options.method = init.method; }
			if ( init.headers ) { options.headers = init.headers; }
		}

		const request = HtRequest( options, ( response ) =>
		{
			resolve( CreateResponse( response ) );
		} );
		request.on( 'timeout', reject );
		request.on( 'abort', reject );
		request.on( 'error', reject );

		if ( init )
		{
			if ( init.body !== undefined ) { request.write( init.body ); }
		}
		request.end();
	} );
}
