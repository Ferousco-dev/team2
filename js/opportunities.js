function normalizeOpportunity(opportunity) {
    const requirements = Array.isArray(opportunity.requirements)
        ? opportunity.requirements : [opportunity.requirements || ''];
    return {
        ...opportunity,
        // The deployed seed data contains literal \\n as well as actual newlines.
        requirements: requirements.flatMap(value => String(value).split(/\\r\\n|\\n|\r?\n/)).map(value => value.trim()).filter(Boolean)
    };
}

async function fetchOpportunities(params = {}) {
    const data = await OpportunityHubApi.request('opportunities.php', { query: params });
    if (data.success !== true) throw new Error('Unable to load opportunities. Please try again.');
    if (params.id) {
        if (!data.opportunity) throw new Error('Opportunity not found.');
        return { ...data, opportunity: normalizeOpportunity(data.opportunity) };
    }
    if (!Array.isArray(data.opportunities)) throw new Error('Unable to load opportunities. Please try again.');
    return { ...data, opportunities: data.opportunities.map(normalizeOpportunity) };
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

function createOpportunityCard(o) {
    return `<article class="opportunity-card"><p class="tag">${escapeHtml(o.type)}</p><h3>${escapeHtml(o.title)}</h3><p class="company">${escapeHtml(o.company)}</p><p class="opportunity-meta">${escapeHtml(o.location)} &bull; ${escapeHtml(o.category)}</p><p>${escapeHtml(o.description)}</p><p class="opportunity-meta"><strong>Deadline:</strong> ${escapeHtml(o.deadline)}</p><footer class="card-footer"><a class="button" href="details.html?id=${encodeURIComponent(o.id)}">View details</a></footer></article>`;
}

function renderOpportunityList(list) {
    const container = document.getElementById('opportunityList');
    if (!container) return;
    container.innerHTML = list.length ? list.map(createOpportunityCard).join('') : '<p>No opportunities match your search.</p>';
    document.getElementById('resultCount').textContent = `${list.length} opportunit${list.length === 1 ? 'y' : 'ies'} found`;
}

function populateFilters(opportunities) {
    for (const field of ['type', 'location']) {
        const select = document.getElementById(field);
        const selected = select.value;
        select.replaceChildren(new Option(`All ${field === 'type' ? 'types' : 'locations'}`, ''));
        const values = [...new Set(opportunities.map(opportunity => opportunity[field]).filter(Boolean))].sort();
        for (const value of values) select.add(new Option(value, value));
        select.value = values.includes(selected) ? selected : '';
    }
}

let listRequestId = 0;
let filtersLoaded = false;

async function loadOpportunityList() {
    const list = document.getElementById('opportunityList');
    if (!list) return;
    const requestId = ++listRequestId;
    list.textContent = 'Loading opportunities…';
    list.setAttribute('aria-busy', 'true');
    document.getElementById('resultCount').textContent = '';
    try {
        // Build filter choices from the backend, not hard-coded types or cities.
        let unfilteredData;
        if (!filtersLoaded) {
            unfilteredData = await fetchOpportunities();
            if (requestId !== listRequestId) return;
            populateFilters(unfilteredData.opportunities);
            filtersLoaded = true;
        }
        const params = {
            keyword: document.getElementById('keyword').value.trim(),
            type: document.getElementById('type').value,
            location: document.getElementById('location').value
        };
        const data = unfilteredData && !Object.values(params).some(Boolean)
            ? unfilteredData : await fetchOpportunities(params);
        if (requestId === listRequestId) renderOpportunityList(data.opportunities);
    } catch (error) {
        if (requestId !== listRequestId) return;
        list.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'button button-secondary';
        retry.textContent = 'Try again';
        retry.addEventListener('click', loadOpportunityList);
        list.append(retry);
    } finally {
        if (requestId === listRequestId) list.setAttribute('aria-busy', 'false');
    }
}

async function renderDetails() {
    const container = document.getElementById('opportunityDetails');
    if (!container) return;
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    if (!Number.isSafeInteger(id) || id < 1) { container.innerHTML = '<h1>Opportunity not found</h1>'; return; }
    container.textContent = 'Loading opportunity…';
    container.setAttribute('aria-busy', 'true');
    try {
        const { opportunity: o } = await fetchOpportunities({ id });
        container.innerHTML = `<section class="details-grid"><section><p class="tag">${escapeHtml(o.type)}</p><h1>${escapeHtml(o.title)}</h1><p class="company">${escapeHtml(o.company)} &bull; ${escapeHtml(o.location)}</p><h2>About the opportunity</h2><p>${escapeHtml(o.description)}</p><h2>Requirements</h2><ul>${o.requirements.map(value => `<li>${escapeHtml(value)}</li>`).join('')}</ul><a class="button" href="apply.html?id=${encodeURIComponent(o.id)}">Apply now</a></section><aside class="details-sidebar"><dl><dt>Company</dt><dd>${escapeHtml(o.company)}</dd><dt>Type</dt><dd>${escapeHtml(o.type)}</dd><dt>Location</dt><dd>${escapeHtml(o.location)}</dd><dt>Category</dt><dd>${escapeHtml(o.category)}</dd><dt>Deadline</dt><dd>${escapeHtml(o.deadline)}</dd><dt>Stipend / Salary</dt><dd>${escapeHtml(o.stipend)}</dd></dl></aside></section>`;
    } catch (error) {
        container.innerHTML = `<h1>Unable to load opportunity</h1><p>${escapeHtml(error.message)}</p>`;
    } finally {
        container.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const keyword = document.getElementById('keyword');
    if (keyword) keyword.value = new URLSearchParams(window.location.search).get('keyword') || '';
    // Apply the homepage search parameter before making the initial filtered request.
    loadOpportunityList();
    renderDetails();
    document.getElementById('filterForm')?.addEventListener('submit', event => { event.preventDefault(); loadOpportunityList(); });
    document.getElementById('clearFilters')?.addEventListener('click', () => { document.getElementById('filterForm').reset(); loadOpportunityList(); });
    document.querySelector('.menu-toggle')?.addEventListener('click', () => {
        const menu = document.getElementById('main-menu');
        const button = document.querySelector('.menu-toggle');
        menu?.classList.toggle('open');
        button?.setAttribute('aria-expanded', String(menu?.classList.contains('open')));
    });
});
