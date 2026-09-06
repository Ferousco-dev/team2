async function authRequest(action, payload) {
    const response = await fetch(`api/auth.php?action=${action}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || 'Request failed.');
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    registerForm?.addEventListener('submit', async e => {
        e.preventDefault();
        document.querySelectorAll('.error').forEach(x => x.textContent = '');
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const course = document.getElementById('course').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        let valid = true;
        if (fullName.length < 3) { fullNameError.textContent = 'Enter your full name.'; valid = false; }
        if (!/^\S+@\S+\.\S+$/.test(email)) { emailError.textContent = 'Enter a valid email.'; valid = false; }
        if (course.length < 2) { courseError.textContent = 'Enter your course.'; valid = false; }
        if (phone.length < 7) { phoneError.textContent = 'Enter a valid phone number.'; valid = false; }
        if (password.length < 8) { passwordError.textContent = 'Password must be at least 8 characters.'; valid = false; }
        if (password !== confirmPassword) { confirmPasswordError.textContent = 'Passwords do not match.'; valid = false; }
        if (!valid) return;
        try {
            const data = await authRequest('register', {fullName, email, course, phone, password});
            registerMessage.className = 'form-message status-success';
            registerMessage.textContent = data.message;
            setTimeout(() => location.href = 'opportunities.html', 500);
        } catch (error) {
            registerMessage.className = 'form-message';
            registerMessage.textContent = error.message;
        }
    });

    const loginForm = document.getElementById('loginForm');
    loginForm?.addEventListener('submit', async e => {
        e.preventDefault();
        loginEmailError.textContent = ''; loginPasswordError.textContent = ''; loginMessage.textContent = '';
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        let valid = true;
        if (!/^\S+@\S+\.\S+$/.test(email)) { loginEmailError.textContent = 'Enter a valid email.'; valid = false; }
        if (!password) { loginPasswordError.textContent = 'Enter your password.'; valid = false; }
        if (!valid) return;
        try {
            await authRequest('login', {email, password});
            location.href = 'opportunities.html';
        } catch (error) { loginMessage.textContent = error.message; }
    });
});
