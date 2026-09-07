async function getCurrentUser() {
    const data = await OpportunityHubApi.request('auth.php', { query: { action: 'me' } });
    if (typeof data.loggedIn !== 'boolean') throw new Error('Unable to check your login session. Please try again.');
    return data;
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('applicationForm');
    if (!form) return;
    const get = id => document.getElementById(id);
    const heading = get('applicationOpportunity');
    const message = get('applicationMessage');
    const button = form.querySelector('button[type="submit"]');
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    let ready = false;
    let submitting = false;
    button.disabled = true;

    function requireLogin() {
        ready = false;
        button.disabled = true;
        message.className = 'form-message';
        message.textContent = 'Please ';
        const link = document.createElement('a');
        link.href = `login.html?next=${encodeURIComponent(`apply.html?id=${id}`)}`;
        link.textContent = 'log in';
        message.append(link, ' before submitting an application.');
    }

    // Register immediately so submitting during the initial requests cannot reload the page.
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!ready || submitting) return;
        form.querySelectorAll('.error').forEach(element => element.textContent = '');
        message.className = 'form-message';
        message.textContent = '';
        const name = get('applicantName').value.trim();
        const email = get('applicantEmail').value.trim().toLowerCase();
        const course = get('applicantCourse').value.trim();
        const phone = get('applicantPhone').value.trim();
        const motivation = get('motivation').value.trim();
        const file = get('resume').files[0];
        let valid = true;
        if (name.length < 3) { get('applicantNameError').textContent = 'Enter your full name.'; valid = false; }
        if (!/^\S+@\S+\.\S+$/.test(email)) { get('applicantEmailError').textContent = 'Enter a valid email.'; valid = false; }
        if (course.length < 2) { get('applicantCourseError').textContent = 'Enter your course.'; valid = false; }
        if (phone.length < 7) { get('applicantPhoneError').textContent = 'Enter a valid phone number.'; valid = false; }
        if (motivation.length < 50) { get('motivationError').textContent = 'Please write at least 50 characters.'; valid = false; }
        if (!file) { get('resumeError').textContent = 'Please select your CV.'; valid = false; }
        else if (file.size > 5 * 1024 * 1024) { get('resumeError').textContent = 'File must not exceed 5MB.'; valid = false; }
        else if (!/\.(pdf|doc|docx)$/i.test(file.name)) { get('resumeError').textContent = 'Use PDF, DOC or DOCX.'; valid = false; }
        if (!valid) return;

        const formData = new FormData();
        for (const [key, value] of Object.entries({ opportunityId: id, name, email, course, phone, motivation })) {
            formData.append(key, value);
        }
        formData.append('resume', file);
        submitting = true;
        button.disabled = true;
        button.textContent = 'Submitting…';
        form.setAttribute('aria-busy', 'true');
        try {
            const data = await OpportunityHubApi.request('applications.php', { method: 'POST', body: formData });
            if (data.success !== true) throw new Error('Unable to confirm your application. Please try again.');
            message.className = 'form-message status-success';
            message.textContent = data.message || 'Application submitted successfully!';
            form.reset();
            ready = false; // Avoid accidentally sending the same application twice.
            button.textContent = 'Application submitted';
        } catch (error) {
            if (error.status === 401) requireLogin();
            else message.textContent = error.message;
            button.textContent = 'Submit application';
        } finally {
            submitting = false;
            button.disabled = !ready;
            form.setAttribute('aria-busy', 'false');
        }
    });

    if (!Number.isSafeInteger(id) || id < 1) {
        heading.textContent = 'Opportunity not found. Please select an opportunity first.';
        return;
    }

    try {
        const [{ opportunity }, userData] = await Promise.all([fetchOpportunities({ id }), getCurrentUser()]);
        heading.textContent = `Applying for: ${opportunity.title} at ${opportunity.company}`;
        if (userData.loggedIn && userData.user) {
            // PostgreSQL folds the deployed, unquoted fullName column to "fullname".
            get('applicantName').value = userData.user.fullName || userData.user.fullname || '';
            get('applicantEmail').value = userData.user.email || '';
            get('applicantCourse').value = userData.user.course || '';
            get('applicantPhone').value = userData.user.phone || '';
            ready = true;
            button.disabled = false;
        } else requireLogin();
    } catch (error) {
        heading.textContent = 'Unable to prepare your application.';
        message.textContent = error.message;
    }
});
