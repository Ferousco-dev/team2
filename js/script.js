document.addEventListener('DOMContentLoaded', async () => {
    const searchForm = document.getElementById('homeSearchForm');
    searchForm?.addEventListener('submit', event => {
        event.preventDefault();
        const keyword = document.getElementById('homeKeyword').value.trim();
        window.location.href = `opportunities.html?keyword=${encodeURIComponent(keyword)}`;
    });

    const latest = document.getElementById('latestOpportunities');
    const featured = document.getElementById('featuredOpportunity');
    if (!latest) return;
    latest.textContent = 'Loading opportunities…';
    latest.setAttribute('aria-busy', 'true');
    try {
        const { opportunities } = await fetchOpportunities();
        document.getElementById('opportunityCount').textContent = opportunities.length;
        document.getElementById('categoryCount').textContent = new Set(opportunities.map(o => o.category).filter(Boolean)).size;
        const newest = [...opportunities].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id));
        latest.innerHTML = newest.length ? newest.slice(0, 3).map(createOpportunityCard).join('') : '<p>No opportunities are available yet. Please check back soon.</p>';
        const opportunity = opportunities[0];
        featured.innerHTML = opportunity
            ? `<section><p class="tag">${escapeHtml(opportunity.type)}</p><h3>${escapeHtml(opportunity.title)}</h3><p class="company">${escapeHtml(opportunity.company)}</p><p>${escapeHtml(opportunity.description)}</p></section><a class="button" href="details.html?id=${encodeURIComponent(opportunity.id)}">View opportunity</a>`
            : '<p>No featured opportunity is available yet.</p>';
    } catch (error) {
        latest.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
        featured.textContent = 'Featured opportunity is currently unavailable.';
    } finally {
        latest.setAttribute('aria-busy', 'false');
    }
});
