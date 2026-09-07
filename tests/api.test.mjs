import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../js/api.js', import.meta.url), 'utf8');

function client(fetch, overrides = {}) {
    const context = {
        window: {}, document: { baseURI: 'https://3000-preview.e2b.app/index.html' },
        URL, AbortController, setTimeout, clearTimeout, fetch, ...overrides
    };
    vm.runInNewContext(source, context);
    return context.window.OpportunityHubApi;
}

const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' }
});

test('API requests stay on the frontend origin and encode filter parameters', async () => {
    const api = client(async (url, options) => {
        assert.equal(url.origin, 'https://3000-preview.e2b.app');
        assert.equal(url.pathname, '/api/opportunities.php');
        assert.equal(url.searchParams.get('keyword'), 'C++ & design');
        assert.equal(url.searchParams.get('location'), 'Mountain View, CA');
        assert.equal(url.searchParams.has('type'), false);
        assert.equal(options.credentials, 'include');
        assert.equal(options.cache, 'no-store');
        assert.equal(options.headers.Accept, 'application/json');
        return jsonResponse({ success: true, opportunities: [] });
    });
    const data = await api.request('opportunities.php', { query: { keyword: 'C++ & design', location: 'Mountain View, CA', type: '' } });
    assert.equal(data.success, true);
});

test('co-hosted PHP installations in a subdirectory retain their API path', async () => {
    const api = client(async url => {
        assert.equal(url.href, 'https://example.test/OpportunityHub/api/auth.php?action=me');
        return jsonResponse({ loggedIn: false });
    }, { document: { baseURI: 'https://example.test/OpportunityHub/apply.html?id=1' } });
    assert.equal((await api.request('auth.php', { query: { action: 'me' } })).loggedIn, false);
});

test('authentication sends JSON with session credentials', async () => {
    const payload = { email: 'student@example.test', password: 'test-only-password' };
    const api = client(async (url, options) => {
        assert.equal(url.searchParams.get('action'), 'login');
        assert.equal(options.method, 'POST');
        assert.equal(options.headers['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(options.body), payload);
        assert.equal(options.credentials, 'include');
        return jsonResponse({ success: true });
    });
    await api.request('auth.php', { method: 'POST', query: { action: 'login' }, json: payload });
});

test('CV uploads preserve FormData without overriding its multipart content type', async () => {
    const body = new FormData();
    body.append('opportunityId', '1');
    body.append('resume', new Blob(['%PDF-1.4\nTest CV']), 'resume.pdf');
    const api = client(async (_url, options) => {
        assert.equal(options.body, body);
        assert.equal(options.headers['Content-Type'], undefined);
        assert.equal(options.credentials, 'include');
        return jsonResponse({ success: true, message: 'Application submitted successfully!' });
    });
    await api.request('applications.php', { method: 'POST', body });
});

test('HTTP and application-level failures preserve safe API messages', async () => {
    for (const status of [200, 401, 500]) {
        const api = client(async () => jsonResponse({ success: false, message: 'Please log in.' }, status));
        await assert.rejects(api.request('applications.php'), error => error.message === 'Please log in.' && error.status === status);
    }
});

test('an HTTP error is never treated as success even if the body says success', async () => {
    const api = client(async () => jsonResponse({ success: true }, 503));
    await assert.rejects(api.request('opportunities.php'), /HTTP 503/);
});

test('HTML error pages and malformed JSON become readable errors without leaking HTML', async () => {
    const api = client(async () => new Response('<h1>Forbidden</h1>', { status: 403 }));
    await assert.rejects(api.request('opportunities.php'), /server is unavailable \(HTTP 403\)/);
    const malformed = client(async () => new Response('{broken-json'));
    await assert.rejects(malformed.request('opportunities.php'), /invalid response/);
});

test('invalid JSON response shapes are rejected', async () => {
    for (const data of [null, [], 'unexpected']) {
        const api = client(async () => jsonResponse(data));
        await assert.rejects(api.request('auth.php'), /invalid response/);
    }
});

test('network errors are actionable', async () => {
    const api = client(async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(api.request('opportunities.php'), /Unable to reach the server/);
});

test('cold-start timeouts are reported and timers are cleaned up', async () => {
    let cleared = false;
    const api = client((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
    }), {
        setTimeout: callback => setTimeout(callback, 1),
        clearTimeout: timer => { cleared = true; clearTimeout(timer); }
    });
    await assert.rejects(api.request('opportunities.php'), /taking too long/);
    assert.equal(cleared, true);
});

test('all pages load the shared client before page scripts', async () => {
    for (const page of ['index', 'opportunities', 'details', 'apply', 'login', 'register']) {
        const html = await readFile(new URL(`../${page}.html`, import.meta.url), 'utf8');
        const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
        assert.equal(scripts[0], 'js/api.js', page);
        assert.equal(scripts.filter(script => script === 'js/api.js').length, 1, page);
    }
});
