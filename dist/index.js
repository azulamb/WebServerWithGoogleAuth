"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const web = require("./WebServerWithGoogleAuth");
const path = require("path");
const fs = require("fs");
exports.Server = web.Server;
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
    function ToAbsolutePath(nowpath) {
        return path.isAbsolute(nowpath) ? nowpath : path.join(process.cwd(), nowpath);
    }
    const Config = (() => { try {
        return require(ToAbsolutePath(process.argv[2] || './config.json'));
    }
    catch (error) { } return {}; })();
    const config = { googleauth: Config.googleauth };
    if (Config.debug) {
        config.logger =
            {
                log: (...messages) => { console.log(new Date(), ...messages); },
                error: (...messages) => { console.error(new Date(), ...messages); },
            };
        config.logger.log(Config);
    }
    if (!Config.docroot) {
        Config.docroot = { public: './docs/', private: './docs_inner/' };
    }
    Config.docroot.public = ToAbsolutePath(Config.docroot.public);
    Config.docroot.private = ToAbsolutePath(Config.docroot.private);
    const server = new web.Server(config);
    server.on('public', StaticServer(Config.docroot.public));
    server.on('private', StaticServer(Config.docroot.private));
    server.setServer().listen(Config.port, () => { if (config.logger) {
        config.logger.log('Start.');
    } });
}
