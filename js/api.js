// Keep browser requests on the frontend origin so PHP session cookies work.
// `npm start` proxies this path to the Render API; the PHP deployment serves it directly.
window.OpportunityHubApi = (() => {
    const baseUrl = new URL('api/', document.baseURI);
    const timeoutMs = 90000; // Allow time for the Render service to wake up.

    async function request(endpoint, { method = 'GET', query = {}, json, body } = {}) {
        const url = new URL(endpoint, baseUrl);
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
        }

        const headers = { Accept: 'application/json' };
        if (json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(json);
        }
        // Do not set Content-Type for FormData: the browser supplies its multipart boundary.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        let data;
        try {
            response = await fetch(url, {
                method, headers, body, credentials: 'include', cache: 'no-store', signal: controller.signal
            });
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(response.ok
                    ? 'The server returned an invalid response. Please try again.'
                    : `The server is unavailable (HTTP ${response.status}). Please try again shortly.`);
            }
        } catch (error) {
            if (controller.signal.aborted) {
                throw new Error('The server is taking too long to respond. Please try again in a moment.');
            }
            if (!response || error instanceof TypeError) {
                throw new Error('Unable to reach the server. Please check your connection and try again.');
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('The server returned an invalid response. Please try again.');
        }
        if (!response.ok || data.success === false) {
            const error = new Error(typeof data.message === 'string' && data.message
                ? data.message : `Request failed (HTTP ${response.status}). Please try again.`);
            error.status = response.status;
            throw error;
        }
        return data;
    }

    return Object.freeze({ request });
})();
