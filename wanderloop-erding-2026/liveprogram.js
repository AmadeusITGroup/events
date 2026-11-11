(function () {
    'use strict';

    const timeZone = 'Europe/Berlin';
    const clockFormat = new Intl.DateTimeFormat('en-GB', {
        timeZone, hour: '2-digit', minute: '2-digit', hour12: false
    });
    const preciseClockFormat = new Intl.DateTimeFormat('en-GB', {
        timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const dateFormat = new Intl.DateTimeFormat('en-GB', {
        timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const dateKeyFormat = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const roomsElement = document.getElementById('live-rooms');
    const stage = roomsElement.parentElement;
    const heading = document.getElementById('live-heading');
    const description = document.getElementById('live-description');
    const errorElement = document.getElementById('live-error');
    const clock = document.getElementById('live-clock');
    const fullProgramLink = document.getElementById('full-program-link');
    const previousButton = document.getElementById('live-previous');
    const nextButton = document.getElementById('live-next');
    const navigationElement = previousButton.parentElement;
    const simulationNotice = document.getElementById('simulation-notice');
    const simulationLabel = document.getElementById('simulation-label');
    const feedbackDisabledTypes = new Set([
        'lunch', 'break', 'introduction', 'welcome', 'afterwork', 'networking booth', 'closing'
    ]);
    let sessions = null;
    let renderedKey = null;
    let loading = false;
    let simulatedTime = null;
    let browsingTime = null;
    let browsingReferenceTime = null;
    let fitFrame = null;
    let showFeedback = false;
    let feedbackBaseUrl = '';

    const currentParams = new URLSearchParams(window.location.search);
    const dateParam = currentParams.get('date')?.trim() || null;
    const hasSimpleView = [...currentParams.keys()].some(key => key.toLowerCase() === 'simpleview');
    const fullProgramParams = new URLSearchParams();
    if (dateParam) fullProgramParams.set('date', dateParam);
    if (hasSimpleView) fullProgramParams.set('simpleView', '');
    if (fullProgramParams.toString()) {
        fullProgramLink.href = `program.html?${fullProgramParams}`;
    }

    function fitCards() {
        const count = roomsElement.children.length;
        const width = stage.clientWidth;
        const height = stage.clientHeight;
        if (!count || width <= 0 || height <= 0) return;

        function applyLayout(columns, scale) {
            roomsElement.style.gridTemplateColumns = `repeat(${columns}, minmax(min-content, 1fr))`;
            roomsElement.style.width = `${width / scale}px`;
            roomsElement.style.transform = `scale(${scale})`;
        }

        let bestScale = 0;
        let bestColumns = 1;
        // Fit both dimensions without squeezing words or time ranges into narrow columns.
        for (let columns = 1; columns <= count; columns++) {
            let lower = 0;
            let upper = 1;
            for (let step = 0; step < 12; step++) {
                const scale = (lower + upper) / 2;
                applyLayout(columns, scale);
                if (roomsElement.scrollWidth <= roomsElement.clientWidth
                    && roomsElement.getBoundingClientRect().height <= height - 2) {
                    lower = scale;
                } else {
                    upper = scale;
                }
            }
            if (lower > bestScale) {
                bestScale = lower;
                bestColumns = columns;
            }
        }
        applyLayout(bestColumns, bestScale);
    }

    function scheduleFit() {
        if (fitFrame !== null) cancelAnimationFrame(fitFrame);
        fitFrame = requestAnimationFrame(() => {
            fitFrame = null;
            fitCards();
        });
    }

    function parseSimulationTime(value) {
        if (value === null) return null;
        // URLSearchParams decodes an unescaped positive offset's plus sign as a space.
        value = value.replace(/ (?=\d{2}:\d{2}$)/, '+');
        const format = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
        const time = Date.parse(value);
        const localTime = Date.parse(`${value.slice(0, 19)}Z`);
        if (!format.test(value) || !Number.isFinite(time) || !Number.isFinite(localTime)
            || new Date(localTime).toISOString().slice(0, 19) !== value.slice(0, 19)) {
            throw new Error('Invalid simulated time. Use an ISO timestamp with seconds and a timezone, for example ?now=2026-11-11T11:40:00+01:00.');
        }
        return time;
    }

    function localizedText(value) {
        return typeof value === 'string' ? value : value?.en || '';
    }

    function parseSessions(data) {
        if (!Array.isArray(data)) throw new Error('Expected a sessions array.');
        return data.map((session, index) => {
            const start = Date.parse(session?.Start);
            const end = Date.parse(session?.End);
            const room = localizedText(session?.Room);
            const title = session?.['Proposal title'];
            if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !room || !title) {
                throw new Error(`Invalid schedule information for session ${index + 1}.`);
            }
            return {
                id: session?.ID || session?.id || '',
                start, end, room, title,
                type: localizedText(session['Session type']),
                level: localizedText(session.Level || session.level),
                track: localizedText(session.Track),
                speakers: (session['Speaker names'] || []).filter(Boolean),
                description: session.Description || session.description || ''
            };
        }).sort((left, right) => left.start - right.start || left.room.localeCompare(right.room));
    }

    function selectSessions(schedule, now) {
        const running = schedule.filter(session => session.start <= now && now < session.end);
        if (running.length) return { mode: 'running', sessions: running };
        const nextStart = Math.min(...schedule.filter(session => session.start > now).map(session => session.start));
        return { mode: 'next', sessions: schedule.filter(session => session.start === nextStart) };
    }

    function browseSessions() {
        if (!dateParam) return sessions;
        return sessions.filter(session => {
            const parts = Object.fromEntries(dateKeyFormat.formatToParts(session.start).map(part => [part.type, part.value]));
            return `${parts.year}-${parts.month}-${parts.day}` === dateParam;
        });
    }

    function navigationTimes(now) {
        const starts = [...new Set(browseSessions().map(session => session.start))];
        if (browsingTime !== null) {
            return {
                previous: starts.filter(start => start < browsingTime).at(-1),
                next: starts.find(start => start > browsingTime)
            };
        }
        const selected = selectSessions(sessions, now);
        const anchor = selected.sessions.length
            ? Math.max(...selected.sessions.map(session => session.start))
            : Infinity;
        return {
            previous: starts.filter(start => start < anchor).at(-1),
            next: starts.find(start => start > (selected.mode === 'running' ? now : anchor))
        };
    }

    function browse(direction) {
        if (sessions === null) return;
        const now = browsingReferenceTime ?? simulatedTime ?? Date.now();
        const target = navigationTimes(now)[direction];
        if (target === undefined) return;
        browsingReferenceTime = now;
        browsingTime = target;
        simulationLabel.textContent = 'Browse mode';
        simulationNotice.hidden = false;
        render();
    }

    previousButton.addEventListener('click', () => browse('previous'));
    nextButton.addEventListener('click', () => browse('next'));

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function sessionCard(session) {
        const isNetworkingBooth = session.type.trim().toLowerCase() === 'networking booth';
        const card = element('section', undefined, 'live-session');
        card.dataset.track = session.track;
        const time = element('p', undefined, 'live-time');
        const start = element('time', clockFormat.format(session.start));
        start.dateTime = new Date(session.start).toISOString();
        const end = element('time', clockFormat.format(session.end));
        end.dateTime = new Date(session.end).toISOString();
        time.append(start, element('span', '\u2014', 'live-time-separator'), end);
        const badges = element('div', undefined, 'live-badges');
        for (const [className, value] of [
            ['live-type', session.type], ['live-level', session.level]
        ]) {
            if (value) badges.append(element('span', value, className));
        }
        card.append(time);
        if (badges.children.length) card.append(badges);
        card.append(element('h4', session.title));
        if (session.speakers.length && !isNetworkingBooth) {
            card.append(element('p', session.speakers.join(', '), 'live-speakers'));
        }
        if (session.track && !isNetworkingBooth) card.append(element('p', session.track, 'live-track'));
        return card;
    }

    function openSessionModal(session, trigger) {
        const overlay = element('div', undefined, 'live-modal-overlay');
        const dialog = element('div', undefined, 'live-modal');
        dialog.dataset.track = session.track;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'live-modal-title');
        dialog.tabIndex = -1;

        const header = element('div', undefined, 'live-modal-header');
        const headerRow = element('div', undefined, 'live-modal-header-row');
        const badges = element('div', undefined, 'live-modal-badges');
        if (session.track) badges.append(element('span', session.track, 'live-modal-track'));
        if (session.level) badges.append(element('span', session.level, 'live-modal-level'));
        headerRow.append(badges);
        header.append(headerRow);
        const title = element('h2', session.title, 'live-modal-title');
        title.id = 'live-modal-title';
        header.append(title);

        const meta = element('div', undefined, 'live-modal-meta');
        const day = element('span', dateFormat.format(session.start));
        const time = element('span',
            `${clockFormat.format(session.start)} \u2192 ${clockFormat.format(session.end)} (${Math.round((session.end - session.start) / 60000)} min)`);
        meta.append(day, time);
        if (session.type) meta.append(element('span', session.type));
        header.append(meta);

        const closeButton = element('button', '\u00d7', 'live-modal-close');
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Close session details');
        headerRow.append(closeButton);

        const bodyWrap = element('div', undefined, 'live-modal-body-wrap');
        const body = element('div', undefined, 'live-modal-body');
        if (session.speakers.length) {
            const speakers = element('div', undefined, 'live-modal-speakers');
            for (const speaker of session.speakers) {
                speakers.append(element('span', speaker, 'live-modal-speaker'));
            }
            body.append(speakers);
        }
        const descriptionContent = element('div', undefined, 'live-modal-description');
        const paragraphs = String(session.description || 'No description available.')
            .split('\n').map(paragraph => paragraph.trim()).filter(Boolean);
        for (const paragraph of paragraphs) descriptionContent.append(element('p', paragraph));
        body.append(descriptionContent);
        const fade = element('div', undefined, 'live-modal-fade is-hidden');
        fade.setAttribute('aria-hidden', 'true');
        bodyWrap.append(body, fade);

        const footer = element('div', undefined, 'live-modal-footer');
        const sessionType = session.type.trim().toLowerCase();
        if (showFeedback && feedbackBaseUrl && session.id && !feedbackDisabledTypes.has(sessionType)) {
            const feedbackLink = element('a', 'Give Feedback', 'live-modal-button live-modal-button-primary');
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('stroke-width', '2');
            icon.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
            icon.append(path);
            feedbackLink.prepend(icon);
            const dayKey = new Date(session.start).toISOString().slice(0, 10);
            feedbackLink.href = `${feedbackBaseUrl.replace(/\/$/, '')}/${dayKey}/${encodeURIComponent(session.id)}`;
            feedbackLink.target = '_blank';
            feedbackLink.rel = 'noopener';
            footer.append(feedbackLink);
        }
        if (session.room) footer.append(element('span', `\u{1F4CD} ${session.room}`, 'live-modal-room'));

        dialog.append(header, bodyWrap, footer);
        overlay.append(dialog);
        document.body.append(overlay);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            dialog.focus();
            updateScrollState();
        });

        function updateScrollState() {
            fade.classList.toggle('is-hidden', body.scrollTop + body.clientHeight >= body.scrollHeight - 2);
        }
        body.addEventListener('scroll', updateScrollState, { passive: true });
        const resizeObserver = new ResizeObserver(updateScrollState);
        resizeObserver.observe(body);

        function close() {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
            resizeObserver.disconnect();
            window.setTimeout(() => overlay.remove(), 200);
            if (trigger.isConnected) trigger.focus();
        }
        function handleEscape(event) {
            if (event.key === 'Escape') close();
            if (event.key !== 'Tab') return;

            const focusable = [...dialog.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )].filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true'
                && element.getClientRects().length > 0);
            if (!focusable.length) {
                event.preventDefault();
                dialog.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (document.activeElement === dialog) {
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
            } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        }

        closeButton.addEventListener('click', close);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });
        document.addEventListener('keydown', handleEscape);
    }

    async function loadFeedbackConfig() {
        try {
            const response = await fetch('config.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Event config request failed (${response.status}).`);
            const config = await response.json();
            showFeedback = Boolean(config.showFeedback);
            feedbackBaseUrl = typeof config.openFeedbackBaseUrl === 'string'
                ? config.openFeedbackBaseUrl.trim()
                : '';
        } catch (error) {
            console.error('Unable to load live program feedback settings:', error);
        }
    }

    function render() {
        const now = browsingTime ?? simulatedTime ?? Date.now();
        clock.dateTime = new Date(now).toISOString();
        clock.replaceChildren(
            element('span', dateFormat.format(now)),
            element('span', preciseClockFormat.format(now), 'live-clock-time')
        );
        if (sessions === null) return;

        const navigation = navigationTimes(now);
        previousButton.disabled = navigation.previous === undefined;
        nextButton.disabled = navigation.next === undefined;
        previousButton.hidden = previousButton.disabled;
        nextButton.hidden = nextButton.disabled;
        navigationElement.hidden = previousButton.hidden && nextButton.hidden;
        const selected = browsingTime === null
            ? selectSessions(sessions, now)
            : { mode: 'running', sessions: sessions.filter(session => session.start <= now && now < session.end) };
        const key = JSON.stringify([selected, browsingTime, browsingReferenceTime]);
        if (key === renderedKey) return;
        renderedKey = key;
        roomsElement.replaceChildren();

        if (!selected.sessions.length) {
            description.hidden = false;
            heading.textContent = browsingTime !== null ? 'No sessions at this time'
                : sessions.length ? 'The event has ended' : 'No sessions scheduled';
            description.textContent = browsingTime !== null
                ? `No sessions are scheduled on ${dateFormat.format(browsingTime)} at ${clockFormat.format(browsingTime)} (Erding time).`
                : sessions.length
                ? 'There are no more upcoming sessions. Thank you for joining us!'
                : 'Please check back later for the program.';
            return;
        }

        if (browsingTime !== null) {
            const nextStart = browseSessions().find(session => session.start > browsingReferenceTime)?.start;
            heading.textContent = browsingTime <= browsingReferenceTime
                ? 'Previously'
                : browsingTime === nextStart ? 'Up next' : 'Soon';
            description.hidden = false;
            description.textContent = `Sessions in progress on ${dateFormat.format(browsingTime)} at ${clockFormat.format(browsingTime)} (Erding time).`;
        } else {
            heading.textContent = selected.mode === 'running' ? 'On now' : 'Up next';
            description.hidden = selected.mode === 'running';
            description.textContent = selected.mode === 'running'
                ? ''
                : `No session is running now. Next sessions: ${dateFormat.format(selected.sessions[0].start)} at ${clockFormat.format(selected.sessions[0].start)}.`;
        }

        const sortedSessions = [...selected.sessions].sort((left, right) =>
            left.room.localeCompare(right.room) || left.start - right.start);
        for (const session of sortedSessions) {
            const card = element('article', undefined, 'live-room');
            card.dataset.track = session.track;
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.setAttribute('aria-haspopup', 'dialog');
            card.setAttribute('aria-label', `View details for ${session.title}`);
            card.append(element('h3', session.room), sessionCard(session));
            card.addEventListener('click', () => openSessionModal(session, card));
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openSessionModal(session, card);
                }
            });
            roomsElement.append(card);
        }
        scheduleFit();
    }

    async function loadSessions() {
        if (loading) return;
        loading = true;
        try {
            const response = await fetch('sessions.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`Sessions request failed (${response.status}).`);
            sessions = parseSessions(await response.json());
            errorElement.hidden = true;
            render();
        } catch (error) {
            console.error('Unable to load the live program:', error);
            sessions = null;
            renderedKey = null;
            previousButton.disabled = true;
            nextButton.disabled = true;
            previousButton.hidden = true;
            nextButton.hidden = true;
            navigationElement.hidden = true;
            roomsElement.replaceChildren();
            heading.textContent = 'Live program unavailable';
            description.hidden = false;
            description.textContent = 'Please check your connection and reload, or wait for the automatic retry.';
            errorElement.textContent = 'Could not load the schedule. Retrying automatically every 10 seconds.';
            errorElement.hidden = false;
        } finally {
            loading = false;
        }
    }

    try {
        const url = new URL(window.location.href);
        simulatedTime = parseSimulationTime(url.searchParams.get('now'));
        url.searchParams.delete('now');
        document.getElementById('live-mode-link').href = url.pathname + url.search + url.hash;
        if (simulatedTime !== null) {
            simulationNotice.hidden = false;
        }
    } catch (error) {
        console.error('Unable to configure the live program clock:', error);
        heading.textContent = 'Invalid simulated time';
        description.textContent = 'Correct the now parameter or remove it to return to live time.';
        errorElement.textContent = error.message;
        errorElement.hidden = false;
        return;
    }

    render();
    loadFeedbackConfig();
    loadSessions();
    new ResizeObserver(scheduleFit).observe(stage);
    document.fonts.ready.then(scheduleFit);
    window.setInterval(render, 1000);
    window.setInterval(loadSessions, 10000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            render();
            loadSessions();
        }
    });
})();
