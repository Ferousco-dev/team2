document.addEventListener('DOMContentLoaded', async () => {
    const searchForm = document.getElementById('homeSearchForm');
    searchForm?.addEventListener('submit', e => {
        e.preventDefault();
        const keyword = document.getElementById('homeKeyword').value.trim();
        location.href = `opportunities.html?keyword=${encodeURIComponent(keyword)}`;
    });

    const latest = document.getElementById('latestOpportunities');
    if (!latest) return;
    try {
        const data = await fetchOpportunities();
        latest.innerHTML = data.opportunities.slice(0, 3).map(createOpportunityCard).join('');
    } catch (error) {
        latest.innerHTML = `<p class="form-message">${error.message}</p>`;
    }
});
