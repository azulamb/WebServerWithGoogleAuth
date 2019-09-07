import * as web from './WebServerWithGoogleAuth'
import * as path from 'path'
import * as fs from 'fs'

export const Server = web;

if ( require.main === module ) { ExecServer() }

interface ServerConfig
{
	googleauth: web.GoogleAuthConfig;
	port?: number;
	debug?: boolean;
}

function StaticServer( docroot: string )
{
	function LoadFile( filepath: string )
	{
		if ( filepath.indexOf( docroot ) !== 0 )
		{
			return Promise.reject( new Error( 'Invalid path.' ) );
		}

		return fs.promises.readFile( filepath );
	}
	return ( request: web.Request, response: web.Response ) =>
	{
		const url = ( request.url || '' ).split( '?' )[ 0 ];

		let filepath = path.join( docroot, url || '' );
		if ( filepath.match( /\/$/ ) ) { filepath += 'index.html'; }

		LoadFile( filepath ).then( ( result ) =>
		{
			response.writeHead( 200 );
			response.write( result );
			response.end();
		} ).catch( ( error ) =>
		{
			response.writeHead( 404 );
			response.end();
		} );
	};
}

function ExecServer()
{
	const configfile = process.argv[ 2 ] || './config.json';
	const Config: ServerConfig = ( () => { try { return require( path.isAbsolute( configfile ) ? configfile : path.join( process.cwd(), configfile ) ); } catch( error ) {} return {}; } )();
	const config: web.ServerConfig = { googleauth: Config.googleauth };

	if ( Config.debug )
	{
		config.logger =
		{
			log: ( ... messages: any[] ) => { console.log( new Date(), ...messages ); },
			error: ( ... messages: any[] ) => { console.error( new Date(), ...messages ); },
		};
	}

	const server = new web.Server( config );
	server.on( 'public', StaticServer( path.join( __dirname, '../docs' ) ) );
	server.on( 'private', StaticServer( path.join( __dirname, '../docs_inner' ) ) );
	server.start( Config.port );
}
