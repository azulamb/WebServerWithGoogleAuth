import * as http from 'http'
import * as https from 'https'
import { URLSearchParams } from 'url';
import { fetch } from './ts-fetch';

export interface Logger
{
	log( ...messages: any[] ): void;
	error( ...messages: any[] ): void;
}

export type Request = http.IncomingMessage;
export type Response = http.ServerResponse;

export interface GoogleAuthConfig
{
	client_id: string;
	client_secret: string;
	scope?: string | string[];
	baseurl: string;
	path?: { login: string, logout: string, callback: string };
	users: string[];
}

export interface ServerConfig
{
	server?: http.Server | https.Server;
	logger?: Logger;
	googleauth: GoogleAuthConfig;
}

export interface GoogleTokenJSON
{
	access_token : string;
	expires_in : number;
	scope: string;
	token_type : string;
	id_token: string;
}

export interface GoogleTokenInfoJSON
{
	issued_id: string;
	audience: string;
	user_id: string;
	expires_in: number;
	email: string;
	verified_email: boolean;
}

export interface Session<T>
{
	create( response: Response, user: T ): Promise<void>;
	get( request: Request ): Promise<T>;
	logined( request: Request ): Promise<void>;
	remove( request: Request ): Promise<void>;
}

function RandString( length = 8 )
{
	const r = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
	let str = "";
	for ( let i = length ; 0 < i ; --i )
	{
		str += r[ Math.floor( Math.random() * r.length ) ];
	}
	return str;
}

class DefaultSession implements Session<GoogleTokenInfoJSON>
{
	private secure: boolean;
	private sessions: { [ kes: string ]: GoogleTokenInfoJSON };
	constructor( secure: boolean )
	{
		this.secure = secure;
		this.sessions = {};
	}

	public create( response: Response, user: GoogleTokenInfoJSON )
	{
		let key: string;
		do { key = RandString( 128 ); } while ( this.sessions[ key ] );
		this.sessions[ key ] = user;

		response.setHeader( 'Set-Cookie',
		[
			//'Expires=',
			//'Max-Age=',
			//'Domain=',
			//'Path=',
			'session=' + key,
			( this.secure ? 'Secure; ' : '' ) + 'HttpOnly',
		].join( '; ' ) );

		return Promise.resolve();
	}

	private searchKey( request: Request )
	{
		for ( let cookie of ( request.headers.cookie || '' ).split( '; ' ) )
		{
			if ( cookie.indexOf( 'session=' ) !== 0 ) { continue; }
			return cookie.substr( 8 );
		}
		return '';
	}

	private session( request: Request )
	{
		const key = this.searchKey( request );
		const session = this.sessions[ key ];
		if ( session ) { return Promise.resolve( session ); }
		return Promise.reject( new Error( 'No session.' ) );
	}

	public get( request: Request )
	{
		return this.session( request );
	}

	public logined( request: Request ) { return this.session( request ).then( () => {} ); }

	public remove( request: Request )
	{
		delete this.sessions[ this.searchKey( request ) ];
		return Promise.resolve();
	}
}

type EventListener = ( ... args: any[] ) => void;

class NodeEvent
{
	private events: { [ key: string ]: EventListener[] } = {};

	public on( event: string, listener: EventListener )
	{
		if ( !this.events[ event ] ) { this.events[ event ] = []; }
		for ( let func of this.events[ event ] )
		{
			if ( func === listener ) { return; }
		}
		this.events[ event ].push( listener );
	}

	public remove( event: string, listener: EventListener )
	{
		const events = this.events[ event ];
		if ( !events ) { return; }
		for ( let i = events.length - 1 ; 0 <= i ; --i )
		{
			if ( events[ i ] === listener ) { events.splice( i, 1 ); }
		}
	}

	public exec( event: string, ... args: any[] )
	{
		const events = this.events[ event ];
		if ( !events ) { return false; }
		for ( let func of events ) { func( ... args ); }
		return true;
	}
}

export class Server
{
	private logger: Logger;
	private session: Session<any>;
	private users: string[];
	private events: NodeEvent;

	private baseurl: string;
	private path_login: string;
	private path_logout: string;
	private path_callback: string;

	private client_id: string;
	private client_secret: string;
	private scope: string;
	private redirect_uri: string;

	constructor( config: ServerConfig )
	{
		const url = new URL( config.googleauth.baseurl );
		this.logger = config.logger || { log: () => {}, error: () => {} };
		this.session = new DefaultSession( url.protocol === 'https:' );
		this.events = new NodeEvent();
		this.users = config.googleauth.users;

		this.baseurl = config.googleauth.baseurl;
		this.client_id = config.googleauth.client_id;
		this.client_secret = config.googleauth.client_secret;
		this.scope = ( Array.isArray( config.googleauth.scope ) ? config.googleauth.scope.join( ' ' ) :  config.googleauth.scope ) || 'email profile openid';
		this.path_login = ( config.googleauth.path ? config.googleauth.path.login : '' ) || '/login';
		this.path_logout = ( config.googleauth.path ? config.googleauth.path.logout : '' ) || '/logout';
		this.path_callback = ( config.googleauth.path ? config.googleauth.path.callback : '' ) || '/callback';
		this.redirect_uri = this.baseurl + this.path_callback;
	}

	public setServer( server?: http.Server | https.Server )
	{
		if ( !server ) { server = http.createServer(); }
		server.on( 'request', ( request: Request, response: Response ) => { this.onRequest( request, response ); } );
		return server;
	}

	public onRequest( request: Request, response: Response )
	{
		this.logger.log( request.url );
		const url = ( request.url || '' ).split( '?' )[ 0 ];
		switch ( url )
		{
			case this.path_login: return this.login( response );
			case this.path_logout: return this.logout( request, response );
			case this.path_callback: return this.callback( request, response );
		}
		return this.logined( request ).then( ( user ) =>
		{
			try
			{
				this.events.exec( 'private', request, response, user );
			} catch ( error )
			{
				this.events.exec( 'error', request, response, user );
			}
		} ).catch( ( error ) =>
		{
			try
			{
				this.events.exec( 'public', request, response );
			} catch ( error )
			{
				this.events.exec( 'error', request, response );
			}
		} );
	}

	public logined( request: Request ) { return this.session.get( request ); }

	public on( event: 'public', listener: ( request: Request, response: Response, user: GoogleTokenInfoJSON ) => void ): void;
	public on( event: 'private', listener: ( request: Request, response: Response ) => void ): void;
	public on( event: 'error', listener: ( request: Request, response: Response, user?: GoogleTokenInfoJSON ) => void ): void;
	on( event: 'public' | 'private' | 'error', listener: ( request: Request, response: Response, user: GoogleTokenInfoJSON ) => void )
	{
		this.events.on( event, listener );
	}

	private isMember( info: GoogleTokenInfoJSON )
	{
		return this.users.includes( info.email );
	}

	private error( response: Response, error: any )
	{
		this.logger.error( 'Error:',error );
		response.writeHead( 400 );
		response.write( 'Error' );
		response.end();
	}

	private redirect( response: Response, url: string )
	{
		response.writeHead( 302, { Location: url } );
		response.end();
	}

	private login( response: Response )
	{
		const params = new URLSearchParams();
		params.set( 'client_id', this.client_id );
		params.set( 'response_type', 'code' );
		params.set( 'scope', this.scope );
		params.set( 'redirect_uri', this.redirect_uri );
		params.set( 'approval_prompt', 'force' );
		this.redirect( response, 'https://accounts.google.com/o/oauth2/auth?' + params.toString() );
	}

	private logout( request: Request, response: Response )
	{
		return this.session.remove( request ).then( () =>
		{
			this.redirect( response, this.baseurl );
		} );
	}

	private callback( request: Request, response: Response )
	{
		const params = new URLSearchParams( ( request.url || '' ).split( '?' )[ 1 ] );
		this.getToken( params.get( 'code' ) ).then( ( result ) =>
		{
			if ( !this.isMember( result ) ) { throw new Error( 'Invalid user.' ); }
			this.logger.log( result );
			this.session.create( response, result );
			this.redirect( response, this.baseurl );
		} ).catch( ( error ) => { this.error( response, error ) } );
	}

	private async getToken( code: string | null )
	{
		const data =
		{
			code: code,
			client_id: this.client_id,
			client_secret: this.client_secret,
			redirect_uri: this.redirect_uri,
			grant_type: 'authorization_code',
		};

		const result: GoogleTokenJSON = await fetch( 'https://accounts.google.com/o/oauth2/token',
		{
			method: 'POST',
			headers:
			{
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: Object.keys( data ).map( ( key ) => { return key + '=' + encodeURIComponent( (<any>data)[ key ] ); } ).join( '&' ),
		} ).then( ( response ) => { return response.json() } );

		return <GoogleTokenInfoJSON>await fetch( 'https://accounts.google.com/o/oauth2/tokeninfo?id_token=' + result.id_token ).then( ( response ) => { return response.json() } );
	}
}
