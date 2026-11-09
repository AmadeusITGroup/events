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
    const roomsElement = document.getElementById('live-rooms');
    const stage = roomsElement.parentElement;
    const heading = document.getElementById('live-heading');
    const description = document.getElementById('live-description');
    const errorElement = document.getElementById('live-error');
    const clock = document.getElementById('live-clock');
    let sessions = null;
    let renderedKey = null;
    let loading = false;
    let simulatedTime = null;
    let fitFrame = null;

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
                start, end, room, title,
                type: localizedText(session['Session type']),
                level: localizedText(session.Level || session.level),
                track: localizedText(session.Track),
                speakers: (session['Speaker names'] || []).filter(Boolean).join(', ')
            };
        }).sort((left, right) => left.start - right.start || left.room.localeCompare(right.room));
    }

    function selectSessions(schedule, now) {
        const running = schedule.filter(session => session.start <= now && now < session.end);
        if (running.length) return { mode: 'running', sessions: running };
        const nextStart = Math.min(...schedule.filter(session => session.start > now).map(session => session.start));
        return { mode: 'next', sessions: schedule.filter(session => session.start === nextStart) };
    }

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
        if (session.speakers && !isNetworkingBooth) card.append(element('p', session.speakers, 'live-speakers'));
        if (session.track && !isNetworkingBooth) card.append(element('p', session.track, 'live-track'));
        return card;
    }

    function render() {
        const now = simulatedTime ?? Date.now();
        clock.dateTime = new Date(now).toISOString();
        clock.replaceChildren(
            element('span', dateFormat.format(now)),
            element('span', preciseClockFormat.format(now), 'live-clock-time')
        );
        if (sessions === null) return;

        const selected = selectSessions(sessions, now);
        const key = JSON.stringify(selected);
        if (key === renderedKey) return;
        renderedKey = key;
        roomsElement.replaceChildren();

        if (!selected.sessions.length) {
            description.hidden = false;
            heading.textContent = sessions.length ? 'The event has ended' : 'No sessions scheduled';
            description.textContent = sessions.length
                ? 'There are no more upcoming sessions. Thank you for joining us!'
                : 'Please check back later for the program.';
            return;
        }

        heading.textContent = selected.mode === 'running' ? 'On now' : 'Up next';
        description.hidden = selected.mode === 'running';
        description.textContent = selected.mode === 'running'
            ? ''
            : `No session is running now. Next sessions: ${dateFormat.format(selected.sessions[0].start)} at ${clockFormat.format(selected.sessions[0].start)}.`;

        const sortedSessions = [...selected.sessions].sort((left, right) =>
            left.room.localeCompare(right.room) || left.start - right.start);
        for (const session of sortedSessions) {
            const card = element('article', undefined, 'live-room');
            card.dataset.track = session.track;
            card.append(element('h3', session.room), sessionCard(session));
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
        if (simulatedTime !== null) {
            document.getElementById('simulation-notice').hidden = false;
            url.searchParams.delete('now');
            document.getElementById('live-mode-link').href = url.pathname + url.search + url.hash;
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
