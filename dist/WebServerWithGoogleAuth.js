"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const url_1 = require("url");
const ts_fetch_1 = require("./ts-fetch");
function RandString(length = 8) {
    const r = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
    let str = "";
    for (let i = length; 0 < i; --i) {
        str += r[Math.floor(Math.random() * r.length)];
    }
    return str;
}
class DefaultSession {
    constructor(secure) {
        this.secure = secure;
        this.sessions = {};
    }
    create(response, user) {
        let key;
        do {
            key = RandString(128);
        } while (this.sessions[key]);
        this.sessions[key] = user;
        response.setHeader('Set-Cookie', [
            'session=' + key,
            (this.secure ? 'Secure; ' : '') + 'HttpOnly',
        ].join('; '));
        return Promise.resolve();
    }
    searchKey(request) {
        for (let cookie of (request.headers.cookie || '').split('; ')) {
            if (cookie.indexOf('session=') !== 0) {
                continue;
            }
            return cookie.substr(8);
        }
        return '';
    }
    session(request) {
        const key = this.searchKey(request);
        const session = this.sessions[key];
        if (session) {
            return Promise.resolve(session);
        }
        return Promise.reject(new Error('No session.'));
    }
    get(request) {
        return this.session(request);
    }
    logined(request) { return this.session(request).then(() => { }); }
    remove(request) {
        delete this.sessions[this.searchKey(request)];
        return Promise.resolve();
    }
}
class NodeEvent {
    constructor() {
        this.events = {};
    }
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        for (let func of this.events[event]) {
            if (func === listener) {
                return;
            }
        }
        this.events[event].push(listener);
    }
    remove(event, listener) {
        const events = this.events[event];
        if (!events) {
            return;
        }
        for (let i = events.length - 1; 0 <= i; --i) {
            if (events[i] === listener) {
                events.splice(i, 1);
            }
        }
    }
    exec(event, ...args) {
        const events = this.events[event];
        if (!events) {
            return false;
        }
        for (let func of events) {
            func(...args);
        }
        return true;
    }
}
class Server {
    constructor(config) {
        const url = new URL(config.googleauth.baseurl);
        this.logger = config.logger || { log: () => { }, error: () => { } };
        this.server = config.server || http.createServer();
        this.session = new DefaultSession(url.protocol === 'https:');
        this.events = new NodeEvent();
        this.users = config.googleauth.users;
        this.baseurl = config.googleauth.baseurl;
        this.client_id = config.googleauth.client_id;
        this.client_secret = config.googleauth.client_secret;
        this.scope = (Array.isArray(config.googleauth.scope) ? config.googleauth.scope.join(' ') : config.googleauth.scope) || 'email profile openid';
        this.path_login = (config.googleauth.path ? config.googleauth.path.login : '') || '/login';
        this.path_logout = (config.googleauth.path ? config.googleauth.path.logout : '') || '/logout';
        this.path_callback = (config.googleauth.path ? config.googleauth.path.callback : '') || '/callback';
        this.redirect_uri = this.baseurl + this.path_callback;
        this.server.on('request', (request, response) => {
            this.logger.log(request.url);
            const url = (request.url || '').split('?')[0];
            switch (url) {
                case this.path_login: return this.login(response);
                case this.path_logout: return this.logout(request, response);
                case this.path_callback: return this.callback(request, response);
            }
            return this.logined(request).then((user) => {
                this.events.exec('private', request, response, user);
            }).catch((error) => {
                this.events.exec('public', request, response);
            });
        });
    }
    logined(request) { return this.session.get(request); }
    start(port, hostname, backlog) {
        return new Promise((resolve) => {
            this.server.listen(port, hostname, backlog, resolve);
        });
    }
    on(event, listener) {
        this.events.on(event, listener);
    }
    isMember(info) {
        return this.users.includes(info.email);
    }
    error(response, error) {
        this.logger.error('Error:', error);
        response.writeHead(400);
        response.write('Error');
        response.end();
    }
    redirect(response, url) {
        response.writeHead(302, { Location: url });
        response.end();
    }
    login(response) {
        const params = new url_1.URLSearchParams();
        params.set('client_id', this.client_id);
        params.set('response_type', 'code');
        params.set('scope', this.scope);
        params.set('redirect_uri', this.redirect_uri);
        params.set('approval_prompt', 'force');
        this.redirect(response, 'https://accounts.google.com/o/oauth2/auth?' + params.toString());
    }
    logout(request, response) {
        return this.session.remove(request).then(() => {
            this.redirect(response, this.baseurl);
        });
    }
    callback(request, response) {
        const params = new url_1.URLSearchParams((request.url || '').split('?')[1]);
        this.getToken(params.get('code')).then((result) => {
            if (!this.isMember(result)) {
                throw new Error('Invalid user.');
            }
            this.logger.log(result);
            this.session.create(response, result);
            this.redirect(response, this.baseurl);
        }).catch((error) => { this.error(response, error); });
    }
    async getToken(code) {
        const data = {
            code: code,
            client_id: this.client_id,
            client_secret: this.client_secret,
            redirect_uri: this.redirect_uri,
            grant_type: 'authorization_code',
        };
        const result = await ts_fetch_1.fetch('https://accounts.google.com/o/oauth2/token', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: Object.keys(data).map((key) => { return key + '=' + encodeURIComponent(data[key]); }).join('&'),
        }).then((response) => { return response.json(); });
        return await ts_fetch_1.fetch('https://accounts.google.com/o/oauth2/tokeninfo?id_token=' + result.id_token).then((response) => { return response.json(); });
    }
}
exports.Server = Server;
