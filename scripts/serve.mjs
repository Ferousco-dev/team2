import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const DEFAULT_API_BASE_URL = 'https://opportunity-hub-web.onrender.com/api/';
const root = fileURLToPath(new URL('../', import.meta.url));
const pages = new Set(['index.html', 'opportunities.html', 'details.html', 'apply.html', 'login.html', 'register.html']);
const endpoints = new Set(['opportunities.php', 'auth.php', 'applications.php']);
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const hopByHop = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

function jsonError(response, status, message) {
    if (response.headersSent || response.destroyed) return;
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ success: false, message }));
}

function proxyRequest(request, response, target) {
    // Only same-origin browser requests should use this session-aware proxy.
    if (request.headers.origin) {
        let origin;
        try { origin = new URL(request.headers.origin); } catch { /* Invalid/null origin is rejected below. */ }
        if (!origin || origin.host !== request.headers.host) {
            jsonError(response, 403, 'Cross-origin requests are not allowed.');
            return;
        }
    }

    const headers = { ...request.headers, host: target.host };
    for (const header of hopByHop) delete headers[header];
    // The upstream request is made on behalf of this frontend, not a cross-site browser.
    if (headers.origin) headers.origin = target.origin;
    delete headers.referer;
    const transport = target.protocol === 'https:' ? https : http;
    const upstream = transport.request(target, { method: request.method, headers }, incoming => {
        const responseHeaders = { ...incoming.headers, 'cache-control': 'no-store' };
        for (const header of hopByHop) delete responseHeaders[header];
        // Bind backend session cookies to the frontend host (including the preview host).
        if (responseHeaders['set-cookie']) {
            responseHeaders['set-cookie'] = responseHeaders['set-cookie'].map(cookie =>
                cookie.replace(/;\s*Domain=[^;]+/gi, '').replace(/;\s*Path=[^;]+/gi, '; Path=/')
            );
        }
        response.writeHead(incoming.statusCode, responseHeaders);
        incoming.on('error', () => response.destroy());
        incoming.pipe(response);
    });
    upstream.setTimeout(85000, () => {
        jsonError(response, 504, 'The backend is taking too long to respond. Please try again shortly.');
        upstream.destroy();
    });
    upstream.on('error', () => jsonError(response, 502, 'Unable to reach the OpportunityHub backend. Please try again shortly.'));
    request.on('aborted', () => upstream.destroy());
    request.on('error', () => upstream.destroy());
    response.on('close', () => { if (!response.writableFinished) upstream.destroy(); });
    request.pipe(upstream); // Stream JSON and multipart CV uploads without changing their bodies.
}

export function createFrontendServer({ apiBaseUrl = process.env.API_BASE_URL || DEFAULT_API_BASE_URL } = {}) {
    const baseUrl = new URL(apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
        throw new Error('API_BASE_URL must be an HTTP(S) API directory URL without credentials, a query or a fragment.');
    }

    return http.createServer(async (request, response) => {
        let url;
        try { url = new URL(request.url, 'http://frontend'); }
        catch { return jsonError(response, 400, 'Invalid request URL.'); }
        if (url.pathname.startsWith('/api/')) {
            const endpoint = url.pathname.slice('/api/'.length);
            if (!endpoints.has(endpoint)) return jsonError(response, 404, 'API endpoint not found.');
            if (!['GET', 'HEAD', 'POST', 'OPTIONS'].includes(request.method)) return jsonError(response, 405, 'Method not allowed.');
            const target = new URL(endpoint, baseUrl);
            target.search = url.search;
            proxyRequest(request, response, target);
            return;
        }

        if (!['GET', 'HEAD'].includes(request.method)) return jsonError(response, 405, 'Method not allowed.');
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        // Never serve PHP source, credentials, uploaded resumes or repository internals.
        if (!pages.has(file) && !/^(?:css|js)\/[\w-]+\.(?:css|js)$/.test(file)) {
            return jsonError(response, 404, 'Page not found.');
        }
        try {
            const body = await readFile(path.join(root, file));
            response.writeHead(200, {
                'Content-Type': contentTypes[path.extname(file)],
                'Content-Length': body.length,
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch {
            jsonError(response, 404, 'Page not found.');
        }
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const port = Number(process.env.PORT || 3000);
    const server = createFrontendServer();
    server.listen(port, '0.0.0.0', () => {
        console.log(`OpportunityHub frontend listening on 0.0.0.0:${server.address().port}`);
        console.log(`Proxying /api/ to ${process.env.API_BASE_URL || DEFAULT_API_BASE_URL}`);
    });
}
