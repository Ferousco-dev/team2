# OpportunityHub — PHP/PostgreSQL + JavaScript

SEN106/SEN216 Web Technologies project: Internship/Job Opportunity Portal.

## Run the frontend against the deployed backend

The backend is **https://opportunity-hub-web.onrender.com/api/**.
It exposes PHP endpoints, not an index page: opening `/api/` itself may return 403.

With **Node.js 20+** installed:

```sh
npm install
npm start
```

Open **http://localhost:3000**. The server binds to `0.0.0.0`, so hosted previews also work.
No local PHP installation or database is needed for this mode.

All pages use `js/api.js` for requests. The browser calls relative `api/` URLs,
and `scripts/serve.mjs` forwards them to the Render backend. The proxy preserves
PHP session cookies, HTTP errors, query strings, JSON bodies and multipart CV
uploads. Keeping requests on the frontend origin avoids CORS and third-party
cookie issues with login and applications; no wildcard CORS policy is needed.

To use another backend or port, set environment variables before starting:

```sh
API_BASE_URL=https://opportunity-hub-web.onrender.com/api/ PORT=3000 npm start
```

`API_BASE_URL` must include the API directory; a trailing slash is optional. It is
server-side configuration, not a browser URL. The default already points to the
Render backend above. An `.env` file is not automatically loaded.

**This mode uses the real backend.** Registrations and submitted applications
will be stored there. Render cold starts can take a while; the UI shows loading
states, handles failures and allows up to 90 seconds for requests.

## Connected frontend features

- Homepage featured/latest opportunities and counts from the API (no sample cards).
- Server-side keyword, type and location filtering; choices come from API data.
- Opportunity details and requirements, including the deployed seed's escaped newlines.
- Registration and login with PHP session cookies, pending states and error messages.
- Session-based application form prefill, including PostgreSQL's `fullname` field.
- Return to the selected application after login or registration.
- Authenticated multipart CV submission with PDF/DOC/DOCX and 5 MB client validation.

| Endpoint (under `/api/`) | Method | Frontend use |
| --- | --- | --- |
| `opportunities.php` | GET | Lists; optional `keyword`, `type`, `location` or `id` |
| `auth.php?action=register` | POST JSON | `fullName`, `email`, `course`, `phone`, `password` |
| `auth.php?action=login` | POST JSON | `email`, `password` |
| `auth.php?action=me` | GET | `{ loggedIn, user }` session check |
| `applications.php` | POST multipart | `opportunityId`, `name`, `email`, `course`, `phone`, `motivation`, `resume` |

## Deployment

- **Existing Render PHP service:** the `Dockerfile` serves HTML, JS and `/api/`
  together. Deploy this checkout to update that frontend; it uses its co-hosted
  PHP API directly. Keep the PostgreSQL `DB_*` variables in `render.yaml` configured.
  The Docker image also configures PHP for 5 MB CV uploads (6 MB total POST size);
  redeploy the backend to pick up that upload-limit setting.
- **Separate Node frontend:** use `npm start`, set `PORT` as required by the host,
  and optionally set `API_BASE_URL`. The backend remains on Render.
- **Static-only hosting:** configure a same-origin `/api/` reverse proxy to the
  Render API, including cookie forwarding. A static file server alone cannot
  run PHP or proxy requests. Do not open pages through `file://`.

## Run the PHP backend locally (optional)

The database schema and PHP driver use **PostgreSQL**, not MySQL/phpMyAdmin.
Use PHP 8+ with `pdo_pgsql` and a PostgreSQL database. Import
`database/opportunityhub.sql` once into an empty database (rerunning its seed
inserts creates duplicate opportunities).

Configure these environment variables for PHP:

- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `5432`)
- `DB_NAME` (default `opportunityhub`)
- `DB_USER` (default `postgres`)
- `DB_PASSWORD`

Then run from the repository root:

```sh
php -S 0.0.0.0:8000
```

Open `http://localhost:8000`. The frontend automatically uses that server's local
`api/` endpoints. Ensure `uploads/` is writable and PHP's `upload_max_filesize`
and `post_max_size` allow the advertised 5 MB uploads.

## Verification

```sh
npm test                       # API client and real HTTP proxy tests; no external calls
npx playwright install chromium
npm run test:e2e                # Browser flows with a mocked API; no production writes
python3 test_endpoints.py       # Read-only smoke checks against the real Render API
```

The smoke script also accepts `--base-url URL` (or `API_BASE_URL`) and `--timeout SECONDS`.
It checks HTTP status and response shape, rather than treating every JSON error as success.

## Security awareness

Passwords are hashed by PHP and database queries use prepared statements. The
frontend proxy exposes only public page/assets and the three API endpoints;
it does not serve PHP source, `.git`, credentials or uploaded CVs. Before treating
this student project as production-ready, add stricter server-side validation,
MIME checks, CSRF protection, rate limiting, secure session settings and private,
persistent CV storage. Local browser validation is not a security boundary.
