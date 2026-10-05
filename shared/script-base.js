// ===================================
// Amadeus Events - Shared Base JavaScript
// Dark mode, mobile menu, scroll animations
// ===================================

(function () {
    'use strict';

    // Dark Mode Toggle (dark is the default)
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;

    const currentTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', currentTheme);

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = html.getAttribute('data-theme');
            const newTheme = current === 'light' ? 'dark' : 'light';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    // Mobile Menu Toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            });
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.navbar')) {
                navLinks.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        });
    }

    // Global click handler for links (delegated)
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href) return;

        // 1. Handle Smooth Scroll for Internal Anchors
        if (href.startsWith('#') && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                let offsetTop = target.offsetTop - 80;
                if (href === '#schedule') {
                    const dateHeading = target.querySelector('.day-header h2');
                    if (dateHeading) {
                        const navbar = document.querySelector('.navbar');
                        const filtersSection = document.querySelector('.filters-section');
                        const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 80;
                        const stickyFiltersHeight = filtersSection && !filtersSection.classList.contains('filters-not-sticky')
                            ? filtersSection.getBoundingClientRect().height
                            : 0;
                        const dateDocumentTop = window.scrollY + dateHeading.getBoundingClientRect().top;
                        offsetTop = dateDocumentTop - navbarBottom - stickyFiltersHeight - 8;
                    }
                }
                window.scrollTo({ top: offsetTop, behavior: 'smooth' });
            }
        }

        // 2. Handle External Links (Open in New Tab if not specified)
        if (href.startsWith('http') && !href.includes(window.location.hostname)) {
            if (!anchor.target) {
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
            }
        }

        // 3. Preserve URL parameters on internal event navigation
        const params = new URLSearchParams(window.location.search);
        const hasSimpleView = params.has('simpleView');
        const dateParam = params.get('date');
        
        if ((hasSimpleView || dateParam) && !href.startsWith('http') && !href.startsWith('#')) {
            // Check if link is to index.html or program.html (not ../index.html which is all events)
            if ((href === 'index.html' || href === 'program.html' || href.endsWith('/index.html') || href.endsWith('/program.html')) && !href.includes('../')) {
                e.preventDefault();
                const baseUrl = href.split('?')[0];
                const newParams = new URLSearchParams();
                
                // Preserve simpleView
                if (hasSimpleView) {
                    newParams.set('simpleView', '');
                }
                
                // Preserve date parameter
                if (dateParam) {
                    newParams.set('date', dateParam);
                }
                
                const newHref = baseUrl + (newParams.toString() ? '?' + newParams.toString() : '');
                window.location.href = newHref;
            }
        }
    });

    // Scroll Animation for Elements
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Navbar shadow on scroll
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 100) {
                navbar.style.boxShadow = '0 4px 20px rgba(38, 0, 90, 0.2)';
            } else {
                navbar.style.boxShadow = '0 2px 10px rgba(38, 0, 90, 0.1)';
            }
        });
    }

    const scrollCue = document.querySelector('.scroll-cue');
    const hero = document.querySelector('.hero');

    if (scrollCue && hero) {
        const updateScrollCueVisibility = () => {
            const heroRect = hero.getBoundingClientRect();
            const isAtPageTop = window.scrollY <= 1;
            const isHeroFullyVisible = heroRect.bottom <= window.innerHeight;
            scrollCue.classList.toggle('is-hidden', !(isAtPageTop && isHeroFullyVisible));
        };

        updateScrollCueVisibility();
        window.addEventListener('scroll', updateScrollCueVisibility, { passive: true });
        window.addEventListener('resize', updateScrollCueVisibility);
    }

    // Easter egg: yellow control can cancel the ongoing compile animation.
    const codeWindow = document.querySelector('.code-window');
    const redControl = document.querySelector('.window-controls span:nth-child(1)');
    const yellowControl = document.querySelector('.window-controls span:nth-child(2)');
    let compileAdvanceTimerId = null;
    let compileCleanupTimerId = null;

    const clearCompileTimers = () => {
        if (compileAdvanceTimerId !== null) {
            window.clearTimeout(compileAdvanceTimerId);
            compileAdvanceTimerId = null;
        }

        if (compileCleanupTimerId !== null) {
            window.clearTimeout(compileCleanupTimerId);
            compileCleanupTimerId = null;
        }
    };

    const cancelCompileAction = () => {
        if (!codeWindow) return;

        clearCompileTimers();
        const overlay = codeWindow.querySelector('.compile-overlay');
        if (overlay) {
            overlay.remove();
        }
        codeWindow.classList.remove('is-compiling');
    };

    // Red button: clear the date filter and navigate to the base URL
    if (redControl) {
        redControl.style.cursor = 'pointer';
        redControl.setAttribute('role', 'button');
        redControl.setAttribute('tabindex', '0');
        redControl.setAttribute('aria-label', 'Clear date filter');

        const clearDateFilter = () => {
            const url = new URL(window.location.href);
            url.searchParams.delete('date');
            window.location.href = url.toString();
        };

        redControl.addEventListener('click', clearDateFilter);
        redControl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clearDateFilter();
            }
        });
    }

    if (codeWindow && yellowControl) {
        yellowControl.setAttribute('role', 'button');
        yellowControl.setAttribute('tabindex', '0');
        yellowControl.setAttribute('aria-label', 'Cancel code window action');

        yellowControl.addEventListener('click', cancelCompileAction);
        yellowControl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                cancelCompileAction();
            }
        });
    }

    // Green button: toggle simpleView parameter
    const greenControl = document.querySelector('.window-controls span:nth-child(3)');
    if (greenControl) {
        greenControl.style.cursor = 'pointer';
        greenControl.setAttribute('role', 'button');
        greenControl.setAttribute('tabindex', '0');
        greenControl.setAttribute('aria-label', 'Toggle simple view');

        const toggleSimpleView = () => {
            const url = new URL(window.location.href);
            if (url.searchParams.has('simpleView')) {
                url.searchParams.delete('simpleView');
            } else {
                url.searchParams.set('simpleView', '');
            }
            window.location.href = url.toString();
        };

        greenControl.addEventListener('click', toggleSimpleView);
        greenControl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleSimpleView();
            }
        });
    }

    if (codeWindow) {
        const compileMessages = [
            'Initializing conference chaos module...',
            'Linting slide decks for missing semicolons...',
            'Defragmenting timetable to avoid lunch-time keynotes...',
            'Reprinting signage after "minor" branding tweak...',
            'Verifying Wi-Fi can survive live demos...',
            'Locking speaker lineup and hiding the edit button...'
        ];

        const runCompileEasterEgg = () => {
            if (codeWindow.classList.contains('is-compiling')) return;

            codeWindow.classList.add('is-compiling');

            const overlay = document.createElement('div');
            overlay.className = 'compile-overlay';
            overlay.innerHTML = [
                '<div class="compile-title">EVENT BUILD PIPELINE</div>',
                '<div class="compile-status" aria-live="polite">Compiling talks...</div>',
                '<div class="compile-bar"><span></span></div>',
                '<div class="compile-percent">0%</div>'
            ].join('');

            codeWindow.appendChild(overlay);

            const statusEl = overlay.querySelector('.compile-status');
            const barEl = overlay.querySelector('.compile-bar span');
            const percentEl = overlay.querySelector('.compile-percent');

            const stageCount = compileMessages.length;
            const stageDelayMs = 1200;
            let stageIndex = 0;

            if (statusEl) statusEl.textContent = compileMessages[stageIndex];
            if (barEl) barEl.style.width = '0%';
            if (percentEl) percentEl.textContent = '0%';

            const advanceStage = () => {
                stageIndex += 1;

                if (stageIndex < stageCount) {
                    const progress = Math.round((stageIndex / stageCount) * 100);
                    if (statusEl) statusEl.textContent = compileMessages[stageIndex];
                    if (barEl) barEl.style.width = `${progress}%`;
                    if (percentEl) percentEl.textContent = `${progress}%`;

                    compileAdvanceTimerId = window.setTimeout(advanceStage, stageDelayMs);
                    return;
                }

                if (barEl) barEl.style.width = '100%';
                if (percentEl) percentEl.textContent = '100%';

                if (statusEl) statusEl.textContent = 'Build complete. Schedule shipped, sanity pending.';

                compileCleanupTimerId = window.setTimeout(() => {
                    overlay.remove();
                    codeWindow.classList.remove('is-compiling');
                    clearCompileTimers();
                }, 5000);
            };

            compileAdvanceTimerId = window.setTimeout(advanceStage, stageDelayMs);
        };

        codeWindow.addEventListener('dblclick', runCompileEasterEgg);
    }
})();

// ============================================================================
// Global URL Parameter & Date Filter Utilities (available to all pages)
// ============================================================================

function getDateParam() {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    return dateParam ? dateParam.trim() : null;
}

function isValidEventDate(dateStr) {
    if (!dateStr) return false;
    // Check if it's 2026-11-10 or 2026-11-11
    return dateStr === '2026-11-10' || dateStr === '2026-11-11';
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

// Initialize global date filter from URL
window.currentDateFilter = getDateParam();

// ============================================================================
// simpleView Parameter Handler
// ============================================================================

function initSimpleViewParameter() {
    const params = new URLSearchParams(window.location.search);
    const simpleView = params.has('simpleView');
    
    if (simpleView) {
        // Hide event date selector (in index.html)
        const eventDateSelector = document.querySelector('.event-date-selector');
        if (eventDateSelector) {
            eventDateSelector.style.display = 'none';
        }
        
        // Hide day filter and its label (in program.html)
        const dayFilterLabel = document.querySelector('label[for="day-filter"]');
        if (dayFilterLabel) {
            dayFilterLabel.style.display = 'none';
        }
        
        const dayFilter = document.getElementById('day-filter');
        if (dayFilter) {
            dayFilter.style.display = 'none';
        }
        
        // Hide date cards used for day selection (in program.html hero)
        const dateCards = document.querySelectorAll('.selector-buttons .date-card, .program-dates .date-card');
        dateCards.forEach(card => {
            card.style.display = 'none';
        });
        
        // Use MutationObserver to hide dynamically created date cards
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) { // Element node
                            // Check if this node or any of its descendants are date cards
                            if (node.classList && node.classList.contains('date-card')) {
                                node.style.display = 'none';
                            }
                            const newDateCards = node.querySelectorAll ? node.querySelectorAll('.date-card') : [];
                            newDateCards.forEach(card => {
                                card.style.display = 'none';
                            });
                        }
                    });
                }
            });
        });
        
        // Observe the entire document for dynamically added date cards
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

// Run on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimpleViewParameter);
} else {
    // If script loads after DOMContentLoaded, run immediately
    initSimpleViewParameter();
}
