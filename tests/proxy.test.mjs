import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { createFrontendServer, DEFAULT_API_BASE_URL } from '../scripts/serve.mjs';

async function listen(t, server) {
    await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
    t.after(() => new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
    }));
    return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t, respond = (_request, response) => response.end('{"success":true}')) {
    const requests = [];
    const backend = http.createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const captured = { method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks) };
        requests.push(captured);
        response.setHeader('Content-Type', 'application/json');
        respond(captured, response);
    });
    const backendUrl = await listen(t, backend);
    const frontend = await listen(t, createFrontendServer({ apiBaseUrl: `${backendUrl}/backend/api` }));
    return { frontend, backendUrl, requests };
}

test('the default proxy target is the supplied Render API', () => {
    assert.equal(DEFAULT_API_BASE_URL, 'https://opportunity-hub-web.onrender.com/api/');
    for (const value of ['file:///api/', 'https://user:pass@example.test/api/', 'https://example.test/api/?key=value']) {
        assert.throws(() => createFrontendServer({ apiBaseUrl: value }));
    }
});

test('serves frontend pages and scripts, not PHP, uploads, secrets or git internals', async t => {
    const { frontend, requests } = await fixture(t);
    assert.match(await (await fetch(frontend)).text(), /js\/api\.js/);
    const script = await fetch(`${frontend}/js/api.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    for (const path of ['/api/db.php', '/.env', '/.git/config', '/uploads/resume.pdf', '/package.json', '/README.md', '/scripts/serve.mjs', '/api/']) {
        assert.equal((await fetch(`${frontend}${path}`)).status, 404, path);
    }
    assert.equal(requests.length, 0);
});

test('forwards encoded filters and preserves the backend API directory', async t => {
    const { frontend, requests } = await fixture(t);
    const response = await fetch(`${frontend}/api/opportunities.php?keyword=C%2B%2B&type=Full-time&location=Remote`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(requests[0].url, '/backend/api/opportunities.php?keyword=C%2B%2B&type=Full-time&location=Remote');
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('JSON login and session cookies survive a full proxy round trip', async t => {
    const { frontend, requests } = await fixture(t, (request, response) => {
        if (request.url.includes('action=login')) {
            response.setHeader('Set-Cookie', 'PHPSESSID=test-session; Domain=backend.example; Path=/backend/api; HttpOnly; SameSite=Lax');
            response.end('{"success":true}');
        } else response.end(JSON.stringify({ loggedIn: request.headers.cookie === 'PHPSESSID=test-session' }));
    });
    const payload = { email: 'student@example.test', password: 'test-only-password' };
    const login = await fetch(`${frontend}/api/auth.php?action=login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: frontend }, body: JSON.stringify(payload)
    });
    assert.equal(login.status, 200);
    assert.deepEqual(JSON.parse(requests[0].body), payload);
    assert.equal(requests[0].headers['content-type'], 'application/json');
    const cookie = login.headers.get('set-cookie');
    assert.equal(cookie, 'PHPSESSID=test-session; Path=/; HttpOnly; SameSite=Lax');
    const me = await fetch(`${frontend}/api/auth.php?action=me`, { headers: { Cookie: cookie.split(';')[0] } });
    assert.deepEqual(await me.json(), { loggedIn: true });
});

test('multipart CV contents, field names, boundary and cookies are forwarded intact', async t => {
    const { frontend, requests } = await fixture(t);
    const data = new FormData();
    data.append('opportunityId', '2');
    data.append('name', 'Test Student');
    data.append('resume', new Blob(['%PDF-1.4\nTest resume\n'], { type: 'application/pdf' }), 'resume.pdf');
    const response = await fetch(`${frontend}/api/applications.php`, {
        method: 'POST', headers: { Cookie: 'PHPSESSID=test-session', Origin: frontend }, body: data
    });
    assert.equal(response.status, 200);
    assert.equal(requests[0].headers.cookie, 'PHPSESSID=test-session');
    const contentType = requests[0].headers['content-type'];
    assert.match(contentType, /^multipart\/form-data; boundary=/);
    const boundary = contentType.split('boundary=')[1];
    const body = requests[0].body.toString();
    assert.ok(body.startsWith(`--${boundary}`));
    assert.match(body, /name="opportunityId"\r\n\r\n2/);
    assert.match(body, /name="resume"; filename="resume.pdf"/);
    assert.match(body, /%PDF-1.4\nTest resume\n/);
});

test('preserves backend HTTP errors and JSON messages', async t => {
    const { frontend } = await fixture(t, (_request, response) => {
        response.statusCode = 401;
        response.end('{"success":false,"message":"Please log in."}');
    });
    const response = await fetch(`${frontend}/api/applications.php`, { method: 'POST' });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { success: false, message: 'Please log in.' });
});

test('rejects cross-origin requests before forwarding credentials', async t => {
    const { frontend, requests } = await fixture(t);
    const response = await fetch(`${frontend}/api/auth.php?action=login`, {
        method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}'
    });
    assert.equal(response.status, 403);
    assert.equal(requests.length, 0);
});

test('accepts same-origin API requests on an HTTPS preview host', async t => {
    const { frontend, requests } = await fixture(t);
    const response = await new Promise((resolve, reject) => {
        const request = http.request(`${frontend}/api/auth.php?action=login`, {
            method: 'POST', headers: { Host: '3000-sandbox.e2b.app', Origin: 'https://3000-sandbox.e2b.app' }
        }, response => { response.resume(); response.on('end', () => resolve(response)); });
        request.on('error', reject);
        request.end('{}');
    });
    assert.equal(response.statusCode, 200);
    assert.equal(requests.length, 1);
});

test('an unavailable backend returns an actionable JSON gateway error', async t => {
    const closed = http.createServer();
    await new Promise(resolve => closed.listen(0, '0.0.0.0', resolve));
    const port = closed.address().port;
    await new Promise(resolve => closed.close(resolve));
    const frontend = await listen(t, createFrontendServer({ apiBaseUrl: `http://127.0.0.1:${port}/api/` }));
    const response = await fetch(`${frontend}/api/opportunities.php`);
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /Unable to reach/);
});
