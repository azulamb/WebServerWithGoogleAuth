"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const https = require("https");
const url_1 = require("url");
function HtRequest(options, callback) {
    return (options.protocol === 'http:' ? http : https).request(options, callback);
}
function CreateResponse(response) {
    const res = {};
    res.text = () => {
        return new Promise((resolve, reject) => {
            let data = '';
            response.setEncoding('utf8');
            response.on('data', (d) => { data += d; });
            response.on('end', () => { resolve(data); });
        });
    };
    res.json = () => {
        return res.text().then((result) => { return JSON.parse(result); });
    };
    return res;
}
function fetch(input, init) {
    return new Promise((resolve, reject) => {
        const options = {};
        if (typeof input === 'string') {
            try {
                const url = new url_1.URL(input);
                options.hostname = url.hostname;
                options.port = url.protocol === 'http:' ? 80 : 443;
                options.method = 'GET';
                options.path = url.pathname + (url.search || '');
            }
            catch (error) {
                return reject(error);
            }
        }
        if (init) {
            if (init.method) {
                options.method = init.method;
            }
            if (init.headers) {
                options.headers = init.headers;
            }
        }
        const request = HtRequest(options, (response) => {
            resolve(CreateResponse(response));
        });
        request.on('timeout', reject);
        request.on('abort', reject);
        request.on('error', reject);
        if (init) {
            if (init.body !== undefined) {
                request.write(init.body);
            }
        }
        request.end();
    });
}
exports.fetch = fetch;
