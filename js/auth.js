async function authRequest(action, payload) {
    const data = await OpportunityHubApi.request('auth.php', { method: 'POST', query: { action }, json: payload });
    if (data.success !== true) throw new Error('Unable to confirm authentication. Please try again.');
    return data;
}

// Never accept an external post-login redirect from the query string.
function authDestination() {
    const next = new URLSearchParams(window.location.search).get('next') || '';
    return /^apply\.html\?id=[1-9]\d*$/.test(next) ? next : 'opportunities.html';
}

function setAuthPending(form, pending, label) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = pending;
    button.textContent = label;
    form.setAttribute('aria-busy', String(pending));
}

document.addEventListener('DOMContentLoaded', () => {
    const get = id => document.getElementById(id);
    const destination = authDestination();
    if (destination !== 'opportunities.html') {
        const alternate = document.querySelector('.auth-footer a');
        if (alternate) alternate.href += `?next=${encodeURIComponent(destination)}`;
    }

    const registerForm = get('registerForm');
    registerForm?.addEventListener('submit', async event => {
        event.preventDefault();
        if (registerForm.getAttribute('aria-busy') === 'true') return;
        registerForm.querySelectorAll('.error').forEach(element => element.textContent = '');
        const message = get('registerMessage');
        message.className = 'form-message';
        message.textContent = '';
        const fullName = get('fullName').value.trim();
        const email = get('email').value.trim().toLowerCase();
        const course = get('course').value.trim();
        const phone = get('phone').value.trim();
        const password = get('password').value;
        const confirmPassword = get('confirmPassword').value;
        let valid = true;
        if (fullName.length < 3) { get('fullNameError').textContent = 'Enter your full name.'; valid = false; }
        if (!/^\S+@\S+\.\S+$/.test(email)) { get('emailError').textContent = 'Enter a valid email.'; valid = false; }
        if (course.length < 2) { get('courseError').textContent = 'Enter your course.'; valid = false; }
        if (phone.length < 7) { get('phoneError').textContent = 'Enter a valid phone number.'; valid = false; }
        if (password.length < 8) { get('passwordError').textContent = 'Password must be at least 8 characters.'; valid = false; }
        if (password !== confirmPassword) { get('confirmPasswordError').textContent = 'Passwords do not match.'; valid = false; }
        if (!valid) return;
        setAuthPending(registerForm, true, 'Creating account…');
        try {
            const data = await authRequest('register', { fullName, email, course, phone, password });
            message.className = 'form-message status-success';
            message.textContent = data.message || 'Registration successful.';
            setTimeout(() => window.location.href = destination, 500);
        } catch (error) {
            message.textContent = error.message;
            setAuthPending(registerForm, false, 'Create account');
        }
    });

    const loginForm = get('loginForm');
    loginForm?.addEventListener('submit', async event => {
        event.preventDefault();
        if (loginForm.getAttribute('aria-busy') === 'true') return;
        get('loginEmailError').textContent = '';
        get('loginPasswordError').textContent = '';
        get('loginMessage').textContent = '';
        const email = get('email').value.trim().toLowerCase();
        const password = get('password').value;
        let valid = true;
        if (!/^\S+@\S+\.\S+$/.test(email)) { get('loginEmailError').textContent = 'Enter a valid email.'; valid = false; }
        if (!password) { get('loginPasswordError').textContent = 'Enter your password.'; valid = false; }
        if (!valid) return;
        setAuthPending(loginForm, true, 'Logging in…');
        try {
            await authRequest('login', { email, password });
            window.location.href = destination;
        } catch (error) {
            get('loginMessage').textContent = error.message;
            setAuthPending(loginForm, false, 'Login');
        }
    });
});
