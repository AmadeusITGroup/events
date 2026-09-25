// Event-specific JavaScript
// Loads config.json and renders index.html from config-driven data.

// ============================================================================
// URL Parameter & Date Filter Utilities
// ============================================================================

function getDateParam() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date') || params.get('data');
    return normalizeDateParam(dateParam);
}

function normalizeDateParam(dateParam) {
    if (!dateParam) {
        return null;
    }

    const trimmed = dateParam.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed === '10Nov') {
        return '2026-11-10';
    }
    if (trimmed === '11Nov') {
        return '2026-11-11';
    }

    return trimmed;
}

function isValidEventDate(dateStr) {
    if (!dateStr) return false;
    // Check if it's 2026-11-10 or 2026-11-11
    return dateStr === '2026-11-10' || dateStr === '2026-11-11';
}

function getCleanUrl(path, dateParam) {
    const url = new URL(path, window.location.origin);
    const currentParams = new URLSearchParams(window.location.search);
    
    if (dateParam && isValidEventDate(dateParam)) {
        url.searchParams.set('date', dateParam);
    }
    
    // Preserve simpleView parameter
    if (currentParams.has('simpleView')) {
        url.searchParams.set('simpleView', '');
    }
    
    return url.toString();
}

function redirectToCleanUrl(path) {
    const dateParam = getDateParam();
    if (!dateParam || isValidEventDate(dateParam)) {
        return; // URL is already clean
    }
    const cleanUrl = getCleanUrl(path, null);
    window.history.replaceState(null, '', cleanUrl);
}

function updateHomeLinks() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = getDateParam();
    const hasSimpleView = params.has('simpleView');
    
    if (!dateParam && !hasSimpleView) {
        return; // No parameters to preserve
    }
    
    // Build the index.html URL with parameters
    let indexUrl = 'index.html';
    if (dateParam && isValidEventDate(dateParam)) {
        indexUrl += `?date=${dateParam}`;
    }
    if (hasSimpleView) {
        indexUrl += (indexUrl.includes('?') ? '&' : '?') + 'simpleView';
    }
    
    // Update all Home links
    const homeLinks = document.querySelectorAll('a[href="index.html"]');
    homeLinks.forEach(link => {
        link.href = indexUrl;
    });
}

function filterSessionsByDate(sessions, dateStr) {
    if (!dateStr || !isValidEventDate(dateStr)) {
        return sessions; // No filter
    }
    return sessions.filter(session => {
        if (session.Start) {
            const sessionDate = session.Start.split('T')[0];
            return sessionDate === dateStr;
        }
        return false;
    });
}

function formatDateFilterDisplay(dateStr) {
    if (!isValidEventDate(dateStr)) {
        return null;
    }

    const parsedDate = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return parsedDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// ============================================================================
// Expose current date filter globally
// ============================================================================
window.currentDateFilter = getDateParam();

// ============================================================================
// Initialize & redirect if needed on page load
// ============================================================================
redirectToCleanUrl(window.location.pathname);

document.addEventListener('DOMContentLoaded', async () => {
    highlightActiveDateCard();
    updateHomeLinks();
    try {
        const response = await fetch('config.json', { cache: 'no-store' });
        const event = await response.json();
        await updateProgramLinks(event);
        renderEvent(event);
    } catch (err) {
        console.warn('Could not load config.json:', err);
    }
});

function highlightActiveDateCard() {
    const dateFilter = window.currentDateFilter;
    const nov10 = document.getElementById('toggle-nov10');
    const nov11 = document.getElementById('toggle-nov11');

    if (dateFilter === '2026-11-10') {
        if (nov10) nov10.classList.add('date-card-active');
    } else if (dateFilter === '2026-11-11') {
        if (nov11) nov11.classList.add('date-card-active');
    }
}

function renderEvent(event) {
    applyMetadata(event);
    renderStats(event);
    renderSessionTypes(event.sessionTypes);
    renderTracks(event.tracks);
    renderAboutSection(event);
    renderCodeSnippet(event);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatBoldSegments(text) {
    const escaped = escapeHtml(text || '');
    // Only allow **...** to become <strong>...</strong>; everything else remains escaped text.
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function formatBoldSegmentsWithLineBreaks(text) {
    const breakToken = '__WL_BR__';
    const withBreakTokens = String(text || '').replace(/<br\s*\/?>/gi, breakToken);
    const escaped = escapeHtml(withBreakTokens);

    // Preserve legacy <br> from config and allow only **...** for rich emphasis.
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .split(breakToken)
        .join('<br/>');
}

function applyMetadata(event) {
    if (event.eventName) {
        document.title = `${event.eventName} | Amadeus Events`;

        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle) {
            heroTitle.textContent = event.eventName;
        }

        const navLogo = document.querySelector('.nav-brand .logo-text');
        if (navLogo) {
            navLogo.textContent = event.eventName;
        }

        const footerLogo = document.querySelector('.footer-brand .logo-text');
        if (footerLogo) {
            footerLogo.textContent = event.eventName;
        }
    }

    if (event.organizer) {
        const navByline = document.querySelector('.nav-byline');
        if (navByline) {
            navByline.textContent = `by ${event.organizer}`;
        }
    }

    const dateFilter = window.currentDateFilter;
    const dateSpecificTagline = dateFilter ? event[`tagline-${dateFilter}`] : null;
    const selectedTagline = dateSpecificTagline || event.tagline;

    if (selectedTagline) {
        const heroSubtitle = document.querySelector('.hero-subtitle');
        if (heroSubtitle) {
            heroSubtitle.innerHTML = formatBoldSegments(selectedTagline);
        }

        const footerTagline = document.querySelector('.footer-tagline');
        if (footerTagline) {
            footerTagline.textContent = `An event by ${event.organizer || 'Amadeus'}`;
        }
    }

    const dateEl = document.querySelector('.date-highlight');
    const forcedDateDisplay = formatDateFilterDisplay(dateFilter);
    const liveDates = window.liveProgramStats && window.liveProgramStats.dateRangeDisplay;
    const displayDates = forcedDateDisplay || liveDates || (event.dates && event.dates.display);
    if (dateEl && displayDates) {
        dateEl.textContent = displayDates;
    }

    if (event.contact) {
        const mailto = `mailto:${event.contact}`;
        const navContact = document.getElementById('nav-contact-link');
        const ctaContact = document.getElementById('contact-cta-link');
        const footerContact = document.getElementById('footer-contact-link');

        if (navContact) {
            navContact.href = mailto;
        }
        if (ctaContact) {
            ctaContact.href = mailto;
        }
        if (footerContact) {
            footerContact.href = mailto;
        }
    }

    if (event.dates && event.dates.start) {
        const eventYear = new Date(event.dates.start).getFullYear();
        if (!Number.isNaN(eventYear)) {
            const footerYear = document.querySelector('.footer-bottom p');
            if (footerYear) {
                footerYear.textContent = `(c) ${eventYear} Amadeus. All rights reserved.`;
            }
        }
    }
}

function renderStats(event) {
    const statsGrid = document.getElementById('stats-grid');
    const stats = event.stats;
    if (!statsGrid || !Array.isArray(stats) || stats.length === 0) {
        return;
    }

    const displayStats = resolveDisplayStats(stats, window.liveProgramStats, window.currentDateFilter);

    statsGrid.innerHTML = displayStats.map(stat => `
        <div class="stat-card${stat.highlight ? ' stat-card-highlight' : ''}">
            <div class="stat-icon">${stat.icon || ''}</div>
            <div class="stat-number">${stat.number || ''}</div>
            <div class="stat-label">${stat.label || ''}</div>
            <p class="stat-description">${stat.description || ''}</p>
        </div>
    `).join('');
}

function resolveDisplayStats(stats, live, dateFilter) {
    if (!Array.isArray(stats)) {
        return [];
    }

    return stats.map(stat => {
        const label = typeof stat.label === 'string' ? stat.label.toLowerCase() : '';

        if (live && label === 'sessions') {
            return { ...stat, number: String(live.sessionsCount) };
        }
        if (live && label === 'speakers') {
            return { ...stat, number: String(live.speakersCount) };
        }
        if (live && label === 'experts & partners') {
            const configuredNumber = dateFilter && stat[`number-${dateFilter}`] !== undefined
                ? stat[`number-${dateFilter}`]
                : stat.number;
            return { ...stat, number: configuredNumber };
        }
        if (dateFilter && stat[`number-${dateFilter}`] !== undefined) {
            return { ...stat, number: stat[`number-${dateFilter}`] };
        }

        return stat;
    });
}

function getStatNumberByLabel(stats, label) {
    if (!Array.isArray(stats) || !label) {
        return 'n/a';
    }

    const stat = stats.find(item => typeof item.label === 'string' && item.label.toLowerCase() === label);
    return stat ? stat.number : 'n/a';
}

function renderSessionTypes(sessionTypes) {
    const sessionsGrid = document.getElementById('sessions-grid');
    if (!sessionsGrid || !Array.isArray(sessionTypes) || sessionTypes.length === 0) {
        return;
    }

    sessionsGrid.innerHTML = sessionTypes.map(stype => `
        <div class="session-card${stype.highlight ? ' session-card-highlight' : ''}">
            <div class="session-header">
                <h3>${stype.name || ''}</h3>
                <span class="session-duration">${stype.tag || stype.duration || (stype.count ? `${stype.count} ${stype.count === 1 ? 'session' : 'sessions'}` : '')}</span>
            </div>
            <p>${stype.description || ''}</p>
        </div>
    `).join('');
}

function renderTracks(tracks) {
    const tracksGrid = document.getElementById('tracks-grid');
    if (!tracksGrid || !Array.isArray(tracks) || tracks.length === 0) {
        return;
    }

    // Filter tracks by date if live stats are enabled
    let filteredTracks = tracks;
    if (window.liveProgramStats && window.liveProgramStats.list && Array.isArray(window.liveProgramStats.list)) {
        const sessionsTrackSet = new Set(
            window.liveProgramStats.list
                .map(s => s.Track && s.Track.en)
                .filter(Boolean)
        );
        filteredTracks = tracks.filter(track => sessionsTrackSet.has(track.name));
    }

    tracksGrid.innerHTML = filteredTracks.map(track => `
        <div class="track-card${track.highlight ? ' track-card-highlight' : ''}">
            <div class="track-icon">${track.icon || ''}</div>
            <h3>${track.name || ''}</h3>
            <p>${formatBoldSegmentsWithLineBreaks(track.description)}</p>
        </div>
    `).join('');
}

function renderAboutSection(event) {
    const descEl = document.getElementById('event-description');
    if (descEl && event.description) {
        descEl.textContent = event.description;
    }

    const locEl = document.getElementById('event-locations');
    if (locEl && Array.isArray(event.locations) && event.locations.length) {
        locEl.innerHTML = `Hosted at ${event.locations.map(location => `<strong>${location}</strong>`).join(', ')}.`;
    }
}

function renderCodeSnippet(event) {
    const codeBlock = document.querySelector('.code-content code');
    if (!codeBlock) {
        return;
    }

    const displayStats = resolveDisplayStats(event.stats, window.liveProgramStats, window.currentDateFilter);
    const sessionsValue = getStatNumberByLabel(displayStats, 'sessions');
    const speakersValue = getStatNumberByLabel(displayStats, 'speakers');
    const attendeesValue = getStatNumberByLabel(displayStats, 'attendees');
    const expertsPartnersValue = getStatNumberByLabel(displayStats, 'experts & partners');

    const datesValue = (window.liveProgramStats && window.liveProgramStats.dateRangeDisplay) || (event.dates && event.dates.display) || '';

    const status = window.eventStatus || 'coming soon';
    codeBlock.innerHTML = `<span class="code-keyword">const</span> <span class="code-variable">event</span> = {\n  <span class="code-property">name</span>: <span class="code-string">"${event.eventName || ''}"</span>,\n  <span class="code-property">date</span>: <span class="code-string">"${datesValue}"</span>,\n  <span class="code-property">sessions</span>: <span class="code-number">${sessionsValue}</span>,\n  <span class="code-property">speakers</span>: <span class="code-number">${speakersValue}</span>,\n  <span class="code-property">attendees</span>: <span class="code-number">${attendeesValue}</span>,\n  <span class="code-property">experts & partners</span>: <span class="code-number">${expertsPartnersValue}</span>,\n  <span class="code-property">status</span>: <span class="code-string">"${status}"</span>\n};`;
}

function getCfpHref(event) {
    if (event.cfpUrl) {
        return event.cfpUrl;
    }
    // Fallback to mailto if cfpUrl not provided
    const contact = event.contact || 'devrel@amadeus.com';
    const eventName = event.eventName || 'Amadeus Event';
    return `mailto:${contact}?subject=${encodeURIComponent(`Talk proposal for ${eventName}`)}`;
}

function getRegisterHref(event) {
    return event.registerUrl || 'https://forms.cloud.microsoft/e/NANjt1AJwF';
}

function setLinkAttributes(el, href) {
    if (!el) return;
    el.href = href;
    if (href.startsWith('http')) {
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
    } else {
        el.target = '';
        el.rel = '';
    }
}

function showCfpLink(cfpHref) {
    const nav = document.getElementById('cfp-nav-link');
    const hero = document.getElementById('cfp-hero-cta');
    const contact = document.getElementById('cfp-contact-cta');
    const footer = document.getElementById('cfp-footer-link');

    if (nav) {
        setLinkAttributes(nav, cfpHref);
        nav.textContent = 'Submit a talk/booth';
        nav.style.display = 'inline-block';
    }
    if (hero) {
        setLinkAttributes(hero, cfpHref);
        hero.innerHTML = 'Submit a talk/booth <span class="arrow">→</span>';
        hero.style.display = 'inline-block';
    }
    if (contact) {
        setLinkAttributes(contact, cfpHref);
        contact.innerHTML = 'Submit a talk/booth <span class="arrow">→</span>';
        contact.style.display = 'inline-block';
    }
    if (footer) {
        setLinkAttributes(footer, cfpHref);
        footer.textContent = 'Submit a talk/booth';
        footer.style.display = 'inline';
    }
}

function showRegisterLink(registerHref) {
    const nav = document.getElementById('register-nav-link');
    const hero = document.getElementById('register-hero-cta');
    const contact = document.getElementById('register-contact-cta');
    const footer = document.getElementById('register-footer-link');

    if (nav) {
        setLinkAttributes(nav, registerHref);
        nav.style.display = 'inline-block';
    }
    if (hero) {
        setLinkAttributes(hero, registerHref);
        hero.style.display = 'inline-block';
    }
    if (contact) {
        setLinkAttributes(contact, registerHref);
        contact.style.display = 'inline-block';
    }
    if (footer) {
        setLinkAttributes(footer, registerHref);
        footer.style.display = 'inline';
    }
}

function hideCfpLink() {
    const nav = document.getElementById('cfp-nav-link');
    const hero = document.getElementById('cfp-hero-cta');
    const contact = document.getElementById('cfp-contact-cta');
    const footer = document.getElementById('cfp-footer-link');

    if (nav) nav.style.display = 'none';
    if (hero) hero.style.display = 'none';
    if (contact) contact.style.display = 'none';
    if (footer) footer.style.display = 'none';
}

function hideRegisterLink() {
    const nav = document.getElementById('register-nav-link');
    const hero = document.getElementById('register-hero-cta');
    const contact = document.getElementById('register-contact-cta');
    const footer = document.getElementById('register-footer-link');

    if (nav) nav.style.display = 'none';
    if (hero) hero.style.display = 'none';
    if (contact) contact.style.display = 'none';
    if (footer) footer.style.display = 'none';
}

function showProgramLink() {
    const dateFilter = window.currentDateFilter;
    const params = new URLSearchParams(window.location.search);
    let programUrl = 'program.html';
    
    // Add date parameter if valid
    if (dateFilter && isValidEventDate(dateFilter)) {
        programUrl += `?date=${dateFilter}`;
    }
    
    // Add simpleView parameter if present
    if (params.has('simpleView')) {
        programUrl += (programUrl.includes('?') ? '&' : '?') + 'simpleView';
    }
    
    const nav = document.getElementById('program-nav-link');
    const hero = document.getElementById('program-hero-cta');
    const contact = document.getElementById('program-contact-cta');
    const footer = document.getElementById('program-footer-link');

    if (nav) {
        setLinkAttributes(nav, programUrl);
        nav.textContent = 'Program';
        nav.style.display = 'inline-block';
    }
    if (hero) {
        setLinkAttributes(hero, programUrl);
        hero.innerHTML = 'Program <span class="arrow">→</span>';
        hero.style.display = 'inline-block';
    }
    if (contact) {
        setLinkAttributes(contact, programUrl);
        contact.innerHTML = 'Program <span class="arrow">→</span>';
        contact.style.display = 'inline-block';
    }
    if (footer) {
        setLinkAttributes(footer, programUrl);
        footer.textContent = 'Program';
        footer.style.display = 'inline';
    }
}

function hideProgramLink() {
    const nav = document.getElementById('program-nav-link');
    const hero = document.getElementById('program-hero-cta');
    const contact = document.getElementById('program-contact-cta');
    const footer = document.getElementById('program-footer-link');

    if (nav) nav.style.display = 'none';
    if (hero) hero.style.display = 'none';
    if (contact) contact.style.display = 'none';
    if (footer) footer.style.display = 'none';
}

function computeStatus(hasProgramPage, showCfp) {
    if (hasProgramPage && !showCfp) return 'ready to rock';
    if (hasProgramPage && showCfp) return 'ready & accepting';
    if (!hasProgramPage && showCfp) return 'call for papers';
    return 'coming soon';
}

async function updateProgramLinks(event) {
    const cfpHref = getCfpHref(event);
    const registerHref = getRegisterHref(event);
    const showCfp = event.showCfp !== false; // defaults to true if not specified
    const dateFilter = window.currentDateFilter;

    let hasSessions = false;
    let hasProgramPage = false;
    let sessions = [];

    try {
        const sessionsResponse = await fetch('sessions.json', { cache: 'no-store' });
        if (sessionsResponse.ok) {
            sessions = await sessionsResponse.json();
            hasSessions = Array.isArray(sessions) && sessions.length > 0;
        }
    } catch (error) {
        hasSessions = false;
    }

    try {
        const programResponse = await fetch('program.html', { cache: 'no-store' });
        hasProgramPage = programResponse.ok;
    } catch (error) {
        hasProgramPage = false;
    }

    // Handle program link
    if (hasSessions && hasProgramPage) {
        showProgramLink();
    } else {
        hideProgramLink();
    }

    // Handle CFP link: hide for Nov 10, conditional visibility for Nov 11 & full event
    if (dateFilter === '2026-11-10') {
        hideCfpLink();
    } else if (showCfp) {
        showCfpLink(cfpHref);
    } else {
        hideCfpLink();
    }

    if (dateFilter === '2026-11-10' && registerHref) {
        showRegisterLink(registerHref);
    } else {
        hideRegisterLink();
    }

    // Once the program is official, useLiveProgramStats switches sessions/speakers/dates
    // from the static advertised numbers to values computed live from sessions.json.
    window.liveProgramStats = (event.useLiveProgramStats && hasSessions)
        ? computeLiveProgramStats(sessions, dateFilter)
        : null;

    // Update status in code snippet
    window.eventStatus = computeStatus(hasProgramPage, showCfp);
}

function computeLiveProgramStats(sessions, dateFilter) {
    let list = Array.isArray(sessions) ? sessions : [];
    const countableSessionTypes = new Set(['Talk', 'Breakout session']);
    const expertsPartnersSessionType = 'Networking booth';
    
    // Apply date filter if specified
    if (dateFilter && isValidEventDate(dateFilter)) {
        list = filterSessionsByDate(list, dateFilter);
    }

    const countableSessions = list.filter(session => {
        const sessionType = session && session['Session type'] && session['Session type'].en;
        return typeof sessionType === 'string' && countableSessionTypes.has(sessionType.trim());
    });
    const expertsPartnersCount = list.filter(session => {
        const sessionType = session && session['Session type'] && session['Session type'].en;
        return typeof sessionType === 'string' && sessionType.trim() === expertsPartnersSessionType;
    }).length;
    
    const sessionsCount = countableSessions.length;

    const speakerSet = new Set();
    countableSessions.forEach(session => {
        const names = session['Speaker names'];
        if (Array.isArray(names)) {
            names.forEach(name => {
                if (typeof name === 'string' && name.trim()) {
                    speakerSet.add(name.trim());
                }
            });
        }
    });

    const starts = [];
    const ends = [];
    list.forEach(session => {
        const start = session.Start ? new Date(session.Start) : null;
        const end = session.End ? new Date(session.End) : null;
        if (start && !Number.isNaN(start.getTime())) {
            starts.push(start);
        }
        if (end && !Number.isNaN(end.getTime())) {
            ends.push(end);
        }
    });

    let dateRangeDisplay = null;
    if (starts.length && ends.length) {
        const minStart = new Date(Math.min(...starts));
        const maxEnd = new Date(Math.max(...ends));
        dateRangeDisplay = formatLiveDateRange(minStart, maxEnd);
    }

    return {
        sessionsCount,
        speakersCount: speakerSet.size,
        expertsPartnersCount,
        dateRangeDisplay,
        list  // Include filtered list for track filtering
    };
}

function formatLiveDateRange(start, end) {
    const dayOpts = { day: 'numeric' };
    const fullOpts = { day: 'numeric', month: 'long', year: 'numeric' };

    if (start.toDateString() === end.toDateString()) {
        return start.toLocaleDateString('en-GB', fullOpts);
    }
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-GB', dayOpts)}-${end.toLocaleDateString('en-GB', fullOpts)}`;
    }
    return `${start.toLocaleDateString('en-GB', fullOpts)} - ${end.toLocaleDateString('en-GB', fullOpts)}`;
}
