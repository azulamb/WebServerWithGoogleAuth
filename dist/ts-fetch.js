"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const https = require("https");
const url_1 = require("url");
function HtRequest(input, options, callback) {
    const url = new url_1.URL(typeof input === 'string' ? input : input.url);
    return (url.protocol === 'http' ? http : https).request(url, options, callback);
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
        if (typeof input === 'string' && init) {
            if (init.method) {
                options.method = init.method;
            }
            if (init.headers) {
                options.headers = init.headers;
            }
        }
        const request = HtRequest(input, options, (response) => {
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
