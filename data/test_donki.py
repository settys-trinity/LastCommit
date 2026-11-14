"""Smoke test for NASA DONKI FLR and SEP, with fallback to the CCMC host."""
import os

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("NASA_API_KEY")
if not API_KEY:
    # DEMO_KEY is NASA's public key, rate-limited to ~30 requests/hour per IP.
    print("NASA_API_KEY not set in .env, using DEMO_KEY")
    API_KEY = "DEMO_KEY"

DATES = {"startDate": "2024-05-01", "endDate": "2024-05-31"}
HOSTS = [
    ("api.nasa.gov", "https://api.nasa.gov/DONKI", {**DATES, "api_key": API_KEY}),
    # The CCMC host needs no key, so it is not sent there.
    ("kauai.ccmc.gsfc.nasa.gov", "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get", DATES),
]


def fetch(base, endpoint, params):
    """Return (status, events) or raise on network error, 5xx or bad JSON."""
    r = requests.get(f"{base}/{endpoint}", params=params, timeout=20)
    r.raise_for_status()
    events = r.json() if r.text.strip() else []  # DONKI returns an empty body when no events
    return r.status_code, events


failed = []
for ep in ("FLR", "SEP"):  # each endpoint falls back on its own, so one broken endpoint can't hide the other
    print(f"\n== {ep} ==")
    for host, base, params in HOSTS:
        try:
            status, events = fetch(base, ep, params)
        except (requests.RequestException, ValueError) as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            print(f"{host}: failed (status {status}): {str(e).replace(API_KEY, '***')}")  # error URLs contain the key
            continue
        print(f"{host}: HTTP {status}, {len(events)} events")
        print(f"  first event keys: {sorted(events[0]) if events else 'none'}")
        print(f"  working host: {host}")
        break
    else:
        failed.append(ep)

if failed:
    print(f"\nNo host worked for: {', '.join(failed)}")
    raise SystemExit(1)
