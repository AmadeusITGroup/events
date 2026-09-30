#!/usr/bin/env python3
"""Generate the OpenFeedback JSON endpoint from the published program data."""

import hashlib
import json
from pathlib import Path


EVENT_DIR = Path(__file__).resolve().parent
SESSIONS_PATH = EVENT_DIR / "sessions.json"
OUTPUT_PATH = EVENT_DIR / "openfeedback.json"
SPEAKER_PHOTO_URL = (
    "https://amadeusitgroup.github.io/events/shared/logos/speaker-placeholder.svg"
)
FEEDBACK_DISABLED_TYPES = {
    "afterwork",
    "break",
    "closing",
    "introduction",
    "lunch",
    "networking booth",
    "welcome",
}


def localized_value(value, default=""):
    """Return the English value used by the event's pretalx-shaped data."""
    if isinstance(value, dict):
        return value.get("en", default)
    return value or default


def speaker_id(name):
    """Build a stable, non-identifying key for a speaker name."""
    return hashlib.sha256(name.encode("utf-8")).hexdigest()[:12]


def generate_openfeedback_data(source_sessions):
    sessions = {}
    speakers = {}

    for source in source_sessions:
        session_type = localized_value(source.get("Session type")).strip().lower()
        if session_type in FEEDBACK_DISABLED_TYPES:
            continue

        session_id = str(source.get("ID", "")).strip()
        start_time = source.get("Start")
        if not session_id or not start_time:
            continue

        session_speaker_ids = []
        for name in filter(None, source.get("Speaker names", [])):
            generated_id = speaker_id(name)
            session_speaker_ids.append(generated_id)
            speakers.setdefault(
                generated_id,
                {
                    "id": generated_id,
                    "name": name,
                    "photoUrl": SPEAKER_PHOTO_URL,
                    "socials": [],
                },
            )

        track = localized_value(source.get("Track"))
        sessions[session_id] = {
            "id": session_id,
            "title": source.get("Proposal title", ""),
            "speakers": session_speaker_ids,
            "tags": [track] if track else [],
            "startTime": start_time,
            "endTime": source.get("End"),
            "trackTitle": localized_value(source.get("Room"), "TBD"),
        }

    return {"sessions": sessions, "speakers": speakers}


def main():
    source_sessions = json.loads(SESSIONS_PATH.read_text(encoding="utf-8"))
    data = generate_openfeedback_data(source_sessions)
    OUTPUT_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(
        f"Generated openfeedback.json with {len(data['sessions'])} sessions "
        f"and {len(data['speakers'])} speakers"
    )


if __name__ == "__main__":
    main()