"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const web = require("./WebServerWithGoogleAuth");
const path = require("path");
const fs = require("fs");
exports.Server = web;
if (require.main === module) {
    ExecServer();
}
function StaticServer(docroot) {
    function LoadFile(filepath) {
        if (filepath.indexOf(docroot) !== 0) {
            return Promise.reject(new Error('Invalid path.'));
        }
        return fs.promises.readFile(filepath);
    }
    return (request, response) => {
        const url = (request.url || '').split('?')[0];
        let filepath = path.join(docroot, url || '');
        if (filepath.match(/\/$/)) {
            filepath += 'index.html';
        }
        LoadFile(filepath).then((result) => {
            response.writeHead(200);
            response.write(result);
            response.end();
        }).catch((error) => {
            response.writeHead(404);
            response.end();
        });
    };
}
function ExecServer() {
    const configfile = process.argv[2] || './config.json';
    const Config = (() => { try {
        return require(path.isAbsolute(configfile) ? configfile : path.join(process.cwd(), configfile));
    }
    catch (error) { } return {}; })();
    const config = { googleauth: Config.googleauth };
    if (Config.debug) {
        config.logger =
            {
                log: (...messages) => { console.log(new Date(), ...messages); },
                error: (...messages) => { console.error(new Date(), ...messages); },
            };
    }
    const server = new web.Server(config);
    server.on('public', StaticServer(path.join(__dirname, '../docs')));
    server.on('private', StaticServer(path.join(__dirname, '../docs_inner')));
    server.start(Config.port);
}
