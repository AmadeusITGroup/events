# Amadeus Events

Multi-event website for Amadeus tech conferences and community events, hosted on GitHub Pages.

**Live site:** https://amadeusitgroup.github.io/events/

<!-- EVENTS_LIST_START -->
## Upcoming Events
- [Wanderloop Erding 2026](wanderloop-erding-2026/index.html) - 10-11 November 2026

## Past Events
- [Engineering Days 2026](engineering-days-2026/index.html) - 29-30 April 2026
<!-- EVENTS_LIST_END -->

---

## 🤖 AI Commands (Copilot Chat)

| Command | What it does |
|---------|-------------|
| **`/create-event`** | Create a new event website (with or without sessions JSON) |
| **`/update-event`** | Update an existing event with finalized program data (from pretalx JSON or manually entered talks) |
| **`/remove-event`** | Remove an event (runs `scripts/events/remove_event.py` interactively) |

Just open Copilot Chat and use the command or describe what you want.  
Prompt files live in `.github/prompts/`.

---

## 🖥️ CLI Commands (Terminal)

```bash
# Create a new event (with sessions)
python3 scripts/events/create_event.py sessions.json --name "My Event 2027" --slug "my-event-2027"

# Create a new event (CFP mode — no sessions yet)
python3 scripts/events/create_event.py --name "My Event 2027" --slug "my-event-2027" --dates "15-16 June 2027" --locations "Nice FR, London UK"

# Update an event with finalized program
python3 scripts/events/update_event.py sessions.json --slug "my-event-2027"

# If you don't have a pretalx JSON yet, build one manually first
python3 scripts/events/build_sessions_json.py --out sessions-manual.json
python3 scripts/events/update_event.py sessions-manual.json --slug "my-event-2027"

# Remove an event (interactive)
python3 scripts/events/remove_event.py
```

See [CREATING_AN_EVENT.md](CREATING_AN_EVENT.md) for full details and options.

---

## ✏️ Manual Edits (no code needed)

Each event has a `config.json` file that controls what's displayed on the website.  
**Non-technical users can edit this file directly** — changes appear on the next page load.

### Editable fields in `<event-folder>/config.json`:

| Field | What it controls | Example |
|-------|-----------------|---------|
| `eventName` | Event title shown everywhere | `"Amadeus Engineering Days 2026"` |
| `tagline` | Short subtitle in the hero section | `"Code. Share. Inspire."` |
| `description` | About section paragraph | `"Welcome to our annual..."` |
| `dates.display` | Date string shown on the page | `"29-30 April 2026"` |
| `locations` | Array of hosting sites | `["Nice FR", "London UK"]` |
| `tracks[]` | Track cards (icon, name, description) | `{"icon": "🤖", "name": "AI & Data", "description": "..."}` |
| `sessionTypes[]` | Session type cards (`name`, optional `tag`, optional `highlight`, `description`) | `{"name": "Closing cocktail", "tag": "Exclusive", "highlight": true, "description": "..."}` |
| `stats[]` | Stat cards in the about section | `{"icon": "🎤", "number": "126+", "label": "Sessions"}` |
| `organizer` | Team name in nav/footer | `"DevRel"` |
| `contact` | Contact email for mailto links | `"devrel@amadeus.com"` |
| `colors` | Brand color overrides | `{"primary": "#26005a", "secondary": "#b650ff", "accent": "#ff58ac"}` |
| `showCfp` | Show/hide the "Submit a talk" CFP link | `true` |
| `showFeedback` | Show/hide the feedback links and modal feedback button on `program.html` | `false` |
| `cfpUrl` | Where the CFP link/button points to | `"https://forms.cloud.microsoft/e/xxx"` |
| `useLiveProgramStats` | Once `sessions.json` is populated, switch Sessions/Speakers counts and the displayed dates from the static advertised numbers to values computed live from the real program (Attendees/Partners/Sites always stay static) | `false` |

> **Tip:** In CFP mode, tracks and session types are pre-filled with examples. Replace them with your real ones, or wait until you run `/update-event` with the sessions JSON.

## Repository Structure

```
/
├── index.html                          # Landing page (links to all events)
├── events.json                         # Event registry (rendered by the landing page)
├── scripts/                            # Automation & CI tooling
│   ├── events/                         # Event lifecycle scripts
│   │   ├── create_event.py             # 🚀 Create event (one command → full event)
│   │   ├── update_event.py             # 🔄 Update event with finalized program
│   │   ├── remove_event.py             # 🗑️  Remove an event (interactive)
│   │   └── build_sessions_json.py      # ✍️  Build a sessions JSON by hand
│   ├── ci/
│   │   └── build.py                    # 🏗️  CI build: regenerate data + validate JSON
│   └── dev/
│       └── serve.py                    # 🌐 Serve the site locally for preview
├── shared/                             # Shared assets used by all events
│   ├── styles-base.css                 # Common CSS (variables, nav, footer, buttons)
│   └── script-base.js                  # Common JS (dark mode, mobile menu, scroll)
├── engineering-days-2026/              # Example: Engineering Days 2026
│   ├── index.html                      # Event homepage
│   ├── program.html                    # Program with dynamic session loading
│   ├── styles.css                      # Event-specific styles
│   ├── script.js                       # Event-specific JS
│   ├── sessions.json                   # Session data (loaded at runtime)
│   ├── config.json                     # Event configuration/metadata
│   └── generate_openfeedback.py        # OpenFeedback integration (openfeedback.json is generated at deploy, not committed)
├── _template/                          # Reference template (used by script)
├── .github/
│   ├── copilot-instructions.md         # AI instructions for this repo
│   ├── prompts/
│   │   └── create-event.prompt.md      # Reusable Copilot skill for event creation
│   └── workflows/
│       └── deploy.yml                  # GitHub Pages auto-deployment (runs the CI build)
├── CREATING_AN_EVENT.md                # Detailed event creation guide
└── README.md                           # This file
```

## How It Works

- **No runtime build** — pages are pure HTML/CSS/JS, served as static files (a lightweight CI build only regenerates data and validates JSON before publishing)
- **Dynamic programs** — `program.html` loads sessions from `sessions.json` at runtime with filters (day, track, type, room)
- **Responsive program view** — Timeline view is the default on laptops/desktops; Grid view is the default on mobile/tablet, with the filter bar hiding on scroll down
- **Wanderloop short sessions** — Timeline cards for sessions lasting 20 minutes or less stay compact by default; hovering reveals the full title, metadata, and speaker names. Click a card for full details on any device.
- **Wanderloop live program** — [Live room cards](wanderloop-erding-2026/liveprogram.html) show all running sessions, or all sessions at the next start time when none are running. Missing details are hidden. All selection logic runs in browser JavaScript, using Europe/Berlin times. The browser fetches `sessions.json` every 10 seconds without reloading the page; only static hosting (such as GitHub Pages) is needed.
- **TV-friendly room cards** — The live program uses the full screen width, large responsive typography, track-colored room headers, and colored type/level badges. Each session has its own card, even when several sessions share a room. Session details display values only, without field labels.
- **Automatic screen fitting** — The live view measures card content in both dimensions and chooses the largest grid layout that fits below the header and above the footer. Time ranges stay on one line, and room names and titles wrap between words rather than splitting words. Cards scale down together when necessary, and refit on screen resizing, font loading, or session changes.
- **Networking booths** — Live cards hide speaker names and track labels for networking booths. Session types are displayed for all sessions when specified.
- **Emulating time** — Add `?now=2026-11-10T14:30:00Z` to the live program URL to freeze its clock (15:30 in Erding). Supply an ISO timestamp with seconds and an explicit timezone, e.g. `?now=2026-11-11T11:40:00+01:00`. Positive offsets accept either a literal `+` or its URL-encoded form `%2B`. Session data still refreshes every 10 seconds, but the simulated instant stays fixed. A banner links back to live time; removing `now` also restores the real clock. Invalid timestamps show an error instead of silently falling back to live time.
- **Live vs. static stats** — the `useLiveProgramStats` config toggle lets Sessions/Speakers/dates switch from static advertised numbers to values computed live from `sessions.json` once the program is official
- **Self-contained events** — each event folder can be deleted cleanly without affecting others
- **Automated generation** — `create_event.py` parses pretalx data and generates everything

## Development

```bash
# Local preview (serves the repo root and opens a browser)
python3 scripts/dev/serve.py
# Options: --port 9000, --host 0.0.0.0, --no-browser

# Or use the plain stdlib server from the repo root
python3 -m http.server 8000
```

Then open http://localhost:8000/ (the pages must be served over HTTP — opening
`index.html` via `file://` won't work because they fetch `config.json`/`sessions.json`).

## Deployment

Pushing to `main` triggers automatic deployment via GitHub Actions → GitHub Pages.
Before publishing, the workflow runs `scripts/ci/build.py`, which regenerates
OpenFeedback data for any event that provides a generator and validates that
every JSON file parses. A malformed JSON file fails the deploy instead of
shipping a broken site.

## Brand

| Token | Color | Usage |
|-------|-------|-------|
| Primary | `#26005a` | Deep purple — headings, navbar, hero backgrounds |
| Secondary | `#b650ff` | Bright purple — accents, hover states, highlights |
| Accent | `#ff58ac` | Pink — CTAs, badges, emphasis |

Dark mode is supported via `[data-theme="dark"]` selectors.
