import * as web from './WebServerWithGoogleAuth'
import * as path from 'path'
import * as fs from 'fs'

export const Server = web.Server;

if ( require.main === module ) { ExecServer() }

interface ServerConfig
{
	googleauth: web.GoogleAuthConfig;
	port?: number;
	docroot?:
	{
		public: string;
		private: string;
	};
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
	function ToAbsolutePath( nowpath: string )
	{
		return path.isAbsolute( nowpath ) ? nowpath : path.join( process.cwd(), nowpath );
	}

	const Config: ServerConfig = ( () => { try { return require( ToAbsolutePath( process.argv[ 2 ] || './config.json' ) ); } catch( error ) {} return {}; } )();
	const config: web.ServerConfig = { googleauth: Config.googleauth };

	if ( Config.debug )
	{
		config.logger =
		{
			log: ( ... messages: any[] ) => { console.log( new Date(), ...messages ); },
			error: ( ... messages: any[] ) => { console.error( new Date(), ...messages ); },
		};
		config.logger.log( Config );
	}
	if ( !Config.docroot )
	{
		Config.docroot = { public: './docs/', private: './docs_inner/' };
	}
	Config.docroot.public = ToAbsolutePath( Config.docroot.public );
	Config.docroot.private = ToAbsolutePath( Config.docroot.private );

	const server = new web.Server( config );
	server.on( 'public', StaticServer( Config.docroot.public ) );
	server.on( 'private', StaticServer( Config.docroot.private ) );
	server.on( 'error', ( request: web.Request, response: web.Response ) => { response.writeHead( 500 ); } );

	server.setServer().listen( Config.port, () => { if ( config.logger ) { config.logger.log( 'Start.' ); } } );
}
