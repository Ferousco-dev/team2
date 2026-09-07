import { test, expect } from '@playwright/test';

// Fixtures mirror the deployed PHP/PostgreSQL response contract, without live writes.
const opportunities = [
    { id: 1, type: 'Internship', title: 'Software Engineering Intern', company: 'Google', location: 'Mountain View, CA', category: 'Tech', description: 'Join our software team.', deadline: '2026-12-31', requirements: ['Enrollment in CS degree\\nProficiency in Python or Java\\nStrong problem-solving skills'], stipend: '$5000/month' },
    { id: 2, type: 'Full-time', title: 'Junior Frontend Developer', company: 'Meta', location: 'Remote', category: 'Tech', description: 'Build responsive interfaces.', deadline: '2026-11-30', requirements: ['Experience with React', 'Strong CSS skills'], stipend: '$80,000/year' },
    { id: 3, type: 'Internship', title: 'Marketing Intern', company: 'Nike', location: 'Portland, OR', category: 'Marketing', description: 'Work on brand marketing.', deadline: '2026-10-15', requirements: ['Creative thinking'], stipend: 'Travel expenses covered' },
    { id: 4, type: 'Full-time', title: 'Data Analyst', company: 'Amazon', location: 'Seattle, WA', category: 'Data Science', description: 'Analyze customer data.', deadline: '2026-12-15', requirements: ['Proficiency in SQL'], stipend: '$90,000/year' }
];
const user = { fullname: 'Test Student', email: 'student@example.test', course: 'Computer Science', phone: '1234567890' };
const errors = new WeakMap();

test.beforeEach(async ({ page }) => {
    errors.set(page, []);
    page.on('pageerror', error => errors.get(page).push(error.message));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function mockApi(page, options = {}) {
    const calls = [];
    await page.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const headers = await request.allHeaders();
        calls.push({ url, method: request.method(), headers, body: request.postData() });
        const reply = (data, status = 200, extraHeaders = {}) => route.fulfill({
            status, contentType: 'application/json', headers: extraHeaders, body: JSON.stringify(data)
        });
        if (url.pathname.endsWith('opportunities.php')) {
            if (options.failOpportunities) return reply({ success: false, message: '<img src=x onerror=alert(1)> Backend unavailable.' }, 500);
            const id = Number(url.searchParams.get('id'));
            if (id) {
                const opportunity = opportunities.find(item => item.id === id);
                return reply(opportunity ? { success: true, opportunity } : { success: false, message: 'Opportunity not found' });
            }
            const keyword = (url.searchParams.get('keyword') || '').toLowerCase();
            const type = url.searchParams.get('type');
            const location = url.searchParams.get('location');
            const result = options.empty ? [] : opportunities.filter(item =>
                (!keyword || `${item.title} ${item.company} ${item.description}`.toLowerCase().includes(keyword)) &&
                (!type || item.type === type) && (!location || item.location.includes(location))
            );
            return reply({ success: true, opportunities: result });
        }
        if (url.pathname.endsWith('auth.php')) {
            const action = url.searchParams.get('action');
            if (action === 'me') {
                const loggedIn = options.loggedIn || headers.cookie?.includes('PHPSESSID=test-session');
                return reply(loggedIn ? { loggedIn: true, user } : { loggedIn: false });
            }
            if (options.authError) return reply({ success: false, message: options.authError });
            return reply({ success: true, message: action === 'register' ? 'Registration successful' : 'Login successful' }, 200, {
                'Set-Cookie': 'PHPSESSID=test-session; Path=/; HttpOnly; SameSite=Lax'
            });
        }
        if (url.pathname.endsWith('applications.php')) {
            if (options.submitGate) await options.submitGate;
            if (options.expired) return reply({ success: false, message: 'Please log in.' }, 401);
            return reply({ success: true, message: 'Application submitted successfully!' });
        }
        return reply({ success: false, message: 'Unexpected test endpoint.' }, 404);
    });
    return calls;
}

async function fillApplication(page) {
    await page.getByLabel('Why are you interested?').fill('I want to build useful software and develop my skills while contributing to your team.');
    await page.getByLabel('Resume / CV').setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest resume only.\n') });
}

test('homepage featured/latest cards and statistics come from the API', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/');
    await expect(page.locator('#featuredOpportunity')).toContainText('Software Engineering Intern');
    await expect(page.locator('#opportunityCount')).toHaveText('4');
    await expect(page.locator('#categoryCount')).toHaveText('3');
    await expect(page.locator('#latestOpportunities .opportunity-card')).toHaveCount(3);
    await expect(page.locator('#latestOpportunities h3').first()).toHaveText('Data Analyst');
    expect(calls).toHaveLength(1);
    expect(calls[0].url.origin).toBe(new URL(page.url()).origin);
});

test('home search, API-derived filter options, filtering and clear all work', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/');
    await page.getByLabel('Search opportunities').fill('frontend');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/opportunities\.html\?keyword=frontend$/);
    await expect(page.locator('#resultCount')).toHaveText('1 opportunity found');
    await expect(page.locator('#opportunityList')).toContainText('Junior Frontend Developer');
    await expect(page.locator('#type option')).toHaveText(['All types', 'Full-time', 'Internship']);
    await expect(page.locator('#location option')).toContainText(['All locations', 'Mountain View, CA', 'Portland, OR', 'Remote', 'Seattle, WA']);
    expect(calls.some(call => call.url.searchParams.get('keyword') === 'frontend')).toBe(true);
    await page.getByLabel('Type', { exact: true }).selectOption('Full-time');
    await page.getByLabel('Location', { exact: true }).selectOption('Remote');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('#opportunityList .opportunity-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('#opportunityList .opportunity-card')).toHaveCount(4);
    await page.getByLabel('Keyword', { exact: true }).fill('no-such-opportunity');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page.locator('#resultCount')).toHaveText('0 opportunities found');
    await expect(page.locator('#opportunityList')).toContainText('No opportunities match your search.');
});

test('details normalize escaped newlines and link to the correct application', async ({ page }) => {
    await mockApi(page);
    await page.goto('/details.html?id=1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Software Engineering Intern');
    await expect(page.locator('#opportunityDetails li')).toHaveText(['Enrollment in CS degree', 'Proficiency in Python or Java', 'Strong problem-solving skills']);
    await expect(page.getByRole('link', { name: 'Apply now' })).toHaveAttribute('href', 'apply.html?id=1');
    await page.goto('/details.html?id=999');
    await expect(page.locator('#opportunityDetails')).toContainText('Opportunity not found');
    await page.goto('/details.html?id=invalid');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Opportunity not found');
});

test('failed requests are escaped and a retry can recover', async ({ page }) => {
    const options = { failOpportunities: true };
    await mockApi(page, options);
    await page.goto('/opportunities.html');
    await expect(page.locator('#opportunityList')).toContainText('Backend unavailable');
    await expect(page.locator('#opportunityList img')).toHaveCount(0);
    await expect(page.locator('#resultCount')).toHaveText('');
    options.failOpportunities = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('#opportunityList .opportunity-card')).toHaveCount(4);
});

test('an empty API does not leave stale homepage placeholders', async ({ page }) => {
    await mockApi(page, { empty: true });
    await page.goto('/');
    await expect(page.locator('#opportunityCount')).toHaveText('0');
    await expect(page.locator('#categoryCount')).toHaveText('0');
    await expect(page.locator('#latestOpportunities')).toContainText('No opportunities are available yet');
    await expect(page.locator('#featuredOpportunity')).toContainText('No featured opportunity');
});

test('registration sends the PHP payload and keeps the session across pages', async ({ page }) => {
    const calls = await mockApi(page);
    await page.goto('/register.html');
    await page.getByLabel('Full name', { exact: true }).fill('  Test Student  ');
    await page.getByLabel('Email address').fill('STUDENT@example.test');
    await page.getByLabel('Course / Programme').fill('Computer Science');
    await page.getByLabel('Phone number').fill('1234567890');
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByLabel('Confirm password').fill('test-only-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/opportunities\.html$/);
    const register = calls.find(call => call.url.searchParams.get('action') === 'register');
    expect(register.method).toBe('POST');
    expect(register.headers['content-type']).toBe('application/json');
    expect(JSON.parse(register.body)).toEqual({ fullName: 'Test Student', email: 'student@example.test', course: 'Computer Science', phone: '1234567890', password: 'test-only-password' });
    await page.goto('/apply.html?id=1');
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Test Student');
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeEnabled();
});

test('login returns to an application, prefills the session and submits a CV once', async ({ page }) => {
    let release;
    const options = { submitGate: new Promise(resolve => { release = resolve; }) };
    const calls = await mockApi(page, options);
    await page.goto('/apply.html?id=2');
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled();
    await page.locator('#applicationMessage').getByRole('link', { name: 'log in' }).click();
    await page.getByLabel('Email address').fill('STUDENT@example.test');
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/apply\.html\?id=2$/);
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Test Student');
    await expect(page.getByLabel('Email address')).toHaveValue('student@example.test');
    await expect(page.getByLabel('Course / Programme')).toHaveValue('Computer Science');
    await fillApplication(page);
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    await page.locator('#applicationForm').evaluate(form => form.requestSubmit());
    release();
    await expect(page.locator('#applicationMessage')).toHaveText('Application submitted successfully!');
    await expect(page.getByRole('button', { name: 'Application submitted' })).toBeDisabled();
    const submissions = calls.filter(call => call.url.pathname.endsWith('applications.php'));
    expect(submissions).toHaveLength(1);
    expect(submissions[0].method).toBe('POST');
    expect(submissions[0].headers.cookie).toContain('PHPSESSID=test-session');
    expect(submissions[0].headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(submissions[0].body).toContain('name="opportunityId"\r\n\r\n2');
    expect(submissions[0].body).toContain('filename="resume.pdf"');
    expect(submissions[0].body).toContain('%PDF-1.4');
});

test('login errors remain visible and do not leave the form disabled', async ({ page }) => {
    const calls = await mockApi(page, { authError: 'Invalid email or password' });
    await page.goto('/login.html');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.locator('#loginEmailError')).toContainText('Enter a valid email');
    expect(calls).toHaveLength(0);
    await page.getByLabel('Email address').fill('student@example.test');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page.locator('#loginMessage')).toHaveText('Invalid email or password');
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeEnabled();
});

test('invalid resumes never reach the backend, and expired sessions require login', async ({ page }) => {
    const calls = await mockApi(page, { loggedIn: true, expired: true });
    await page.goto('/apply.html?id=1');
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeEnabled();
    await fillApplication(page);
    await page.getByLabel('Resume / CV').setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('not a CV') });
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.locator('#resumeError')).toHaveText('Use PDF, DOC or DOCX.');
    expect(calls.filter(call => call.url.pathname.endsWith('applications.php'))).toHaveLength(0);
    await fillApplication(page);
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.locator('#applicationMessage')).toHaveText('Please log in before submitting an application.');
    await expect(page.getByRole('button', { name: 'Submit application' })).toBeDisabled();
});

test('post-login destinations cannot redirect to another origin', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login.html?next=https%3A%2F%2Funtrusted.example');
    await page.getByLabel('Email address').fill('student@example.test');
    await page.getByLabel('Password', { exact: true }).fill('test-only-password');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/opportunities\.html$/);
});
