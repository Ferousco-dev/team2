async function getCurrentUser() {
    const response = await fetch('api/auth.php?action=me');
    return response.json();
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('applicationForm');
    if (!form) return;
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!id) { applicationOpportunity.textContent = 'Opportunity not found.'; return; }

    try {
        const [opportunityResponse, userResponse] = await Promise.all([
            fetch(`api/opportunities.php?id=${id}`), getCurrentUser()
        ]);
        const opportunityData = await opportunityResponse.json();
        const userData = userResponse;
        if (!opportunityData.success) throw new Error(opportunityData.message);
        const o = opportunityData.opportunity;
        applicationOpportunity.textContent = `Applying for: ${o.title} at ${o.company}`;
        if (userData.loggedIn && userData.user) {
            applicantName.value = userData.user.fullName || '';
            applicantEmail.value = userData.user.email || '';
            applicantCourse.value = userData.user.course || '';
            applicantPhone.value = userData.user.phone || '';
        } else {
            applicationMessage.textContent = 'Please log in before submitting an application.';
        }
    } catch (error) { applicationMessage.textContent = error.message; }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        document.querySelectorAll('.error').forEach(x => x.textContent = '');
        const file = resume.files[0];
        const motivationText = motivation.value.trim();
        let valid = true;
        if (applicantName.value.trim().length < 3) { applicantNameError.textContent = 'Enter your full name.'; valid = false; }
        if (!/^\S+@\S+\.\S+$/.test(applicantEmail.value.trim())) { applicantEmailError.textContent = 'Enter a valid email.'; valid = false; }
        if (applicantCourse.value.trim().length < 2) { applicantCourseError.textContent = 'Enter your course.'; valid = false; }
        if (applicantPhone.value.trim().length < 7) { applicantPhoneError.textContent = 'Enter a valid phone number.'; valid = false; }
        if (motivationText.length < 50) { motivationError.textContent = 'Please write at least 50 characters.'; valid = false; }
        if (!file) { resumeError.textContent = 'Please select your CV.'; valid = false; }
        else if (file.size > 5 * 1024 * 1024) { resumeError.textContent = 'File must not exceed 5MB.'; valid = false; }
        else if (!/\.(pdf|doc|docx)$/i.test(file.name)) { resumeError.textContent = 'Use PDF, DOC or DOCX.'; valid = false; }
        if (!valid) return;

        const formData = new FormData();
        formData.append('opportunityId', id);
        formData.append('name', applicantName.value.trim());
        formData.append('email', applicantEmail.value.trim().toLowerCase());
        formData.append('course', applicantCourse.value.trim());
        formData.append('phone', applicantPhone.value.trim());
        formData.append('motivation', motivationText);
        formData.append('resume', file);

        try {
            const response = await fetch('api/applications.php', {method: 'POST', body: formData});
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Application failed.');
            applicationMessage.className = 'form-message status-success';
            applicationMessage.textContent = data.message;
            form.reset();
        } catch (error) { applicationMessage.className = 'form-message'; applicationMessage.textContent = error.message; }
    });
});
