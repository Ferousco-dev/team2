let opportunities = [];

async function fetchOpportunities(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`api/opportunities.php${query ? `?${query}` : ''}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Unable to load opportunities.');
    opportunities = data.opportunities || (data.opportunity ? [data.opportunity] : []);
    return data;
}

function createOpportunityCard(o) {
    return `<article class="opportunity-card"><p class="tag">${o.type}</p><h3>${escapeHtml(o.title)}</h3><p class="company">${escapeHtml(o.company)}</p><p class="opportunity-meta">${escapeHtml(o.location)} &bull; ${escapeHtml(o.category)}</p><p>${escapeHtml(o.description)}</p><p class="opportunity-meta"><strong>Deadline:</strong> ${escapeHtml(o.deadline)}</p><footer class="card-footer"><a class="button" href="details.html?id=${o.id}">View details</a></footer></article>`;
}

function renderOpportunityList(list) {
    const c = document.getElementById('opportunityList');
    if (!c) return;
    c.innerHTML = list.length ? list.map(createOpportunityCard).join('') : '<p>No opportunities match your search.</p>';
    const n = document.getElementById('resultCount');
    if (n) n.textContent = `${list.length} opportunit${list.length === 1 ? 'y' : 'ies'} found`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

async function loadOpportunityList() {
    const list = document.getElementById('opportunityList');
    if (!list) return;
    try {
        const form = document.getElementById('filterForm');
        const params = form ? {
            keyword: document.getElementById('keyword')?.value.trim() || '',
            type: document.getElementById('type')?.value || '',
            location: document.getElementById('location')?.value || ''
        } : {};
        const data = await fetchOpportunities(params);
        renderOpportunityList(data.opportunities);
    } catch (error) {
        list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
    }
}

async function renderDetails() {
    const c = document.getElementById('opportunityDetails');
    if (!c) return;
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (!id) { c.innerHTML = '<h1>Opportunity not found</h1>'; return; }
    try {
        const data = await fetchOpportunities({ id });
        const o = data.opportunity || opportunities[0];
        c.innerHTML = `<section class="details-grid"><section><p class="tag">${escapeHtml(o.type)}</p><h1>${escapeHtml(o.title)}</h1><p class="company">${escapeHtml(o.company)} &bull; ${escapeHtml(o.location)}</p><h2>About the opportunity</h2><p>${escapeHtml(o.description)}</p><h2>Requirements</h2><ul>${o.requirements.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul><a class="button" href="apply.html?id=${o.id}">Apply now</a></section><aside class="details-sidebar"><dl><dt>Company</dt><dd>${escapeHtml(o.company)}</dd><dt>Type</dt><dd>${escapeHtml(o.type)}</dd><dt>Location</dt><dd>${escapeHtml(o.location)}</dd><dt>Category</dt><dd>${escapeHtml(o.category)}</dd><dt>Deadline</dt><dd>${escapeHtml(o.deadline)}</dd><dt>Stipend / Salary</dt><dd>${escapeHtml(o.stipend)}</dd></dl></aside></section>`;
    } catch (error) {
        c.innerHTML = `<h1>Unable to load opportunity</h1><p>${escapeHtml(error.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadOpportunityList();
    renderDetails();
    const urlParams = new URLSearchParams(location.search);
    if (document.getElementById('keyword') && urlParams.has('keyword')) document.getElementById('keyword').value = urlParams.get('keyword') || '';
    document.getElementById('filterForm')?.addEventListener('submit', e => { e.preventDefault(); loadOpportunityList(); });
    document.getElementById('clearFilters')?.addEventListener('click', () => { document.getElementById('filterForm').reset(); loadOpportunityList(); });
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        const m = document.getElementById('main-menu');
        const b = document.querySelector('.menu-toggle');
        m?.classList.toggle('open');
        b?.setAttribute('aria-expanded', String(m?.classList.contains('open')));
    });
});
