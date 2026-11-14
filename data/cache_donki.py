"""Fetch DONKI SEP events from api.nasa.gov and save them to data/donki_cache.json."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["NASA_API_KEY"]
URL = "https://api.nasa.gov/DONKI/SEP"  # the host that worked in test_donki.py
OUT = Path(__file__).with_name("donki_cache.json")

for start, end in [("2024-05-01", "2024-05-31"), ("2024-10-01", "2024-10-31")]:  # second window only if first is empty
    window = {"startDate": start, "endDate": end}
    r = requests.get(URL, params={**window, "api_key": API_KEY}, timeout=20)
    r.raise_for_status()
    events = r.json() if r.text.strip() else []  # DONKI returns an empty body when no events
    if events:
        break
else:
    raise SystemExit("No SEP events in either window")

cache = {
    "cached": True,
    "source_url": f"{URL}?{urlencode(window)}",  # built without the key, never from r.url
    "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "window": {"start": start, "end": end},
    "events": events,
}
assert API_KEY not in json.dumps(cache), "API key leaked into cache"
OUT.write_text(json.dumps(cache, indent=2), encoding="utf-8")

print(f"Saved {len(events)} events to {OUT.name} ({start} to {end})")
print(f"First event: sepID={events[0]['sepID']} eventTime={events[0]['eventTime']}")
