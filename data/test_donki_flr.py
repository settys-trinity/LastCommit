"""Diagnose why DONKI FLR fails: try each variant in order, stop at the first that works."""
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("NASA_API_KEY") or "DEMO_KEY"
MAY = {"startDate": "2024-05-01", "endDate": "2024-05-31"}
WEEK = {"startDate": "2024-05-10", "endDate": "2024-05-17"}
NASA = "https://api.nasa.gov/DONKI/FLR"
KAUAI = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR"
UA = {"User-Agent": "Mozilla/5.0"}

# (label, url, params, headers, attempts). The kauai host needs no key, so none is sent there.
TRIES = [
    ("1 api.nasa.gov, no dates", NASA, {"api_key": API_KEY}, {}, 1),
    ("2 api.nasa.gov, May 2024, DEMO_KEY", NASA, {**MAY, "api_key": "DEMO_KEY"}, {}, 1),
    ("3 api.nasa.gov, 2024-05-10..17", NASA, {**WEEK, "api_key": API_KEY}, {}, 1),
    ("4a kauai https, no dates", KAUAI, {}, UA, 3),
    ("4b kauai https, May 2024", KAUAI, MAY, UA, 3),
    ("4c kauai https, 2024-05-10..17", KAUAI, WEEK, UA, 3),
    ("5 kauai http, May 2024", KAUAI.replace("https://", "http://"), MAY, UA, 1),
]


def attempt(url, params, headers, attempts):
    """Return (status, event_count or None, error or None) from the last attempt."""
    for n in range(attempts):
        if n:
            time.sleep(3)
        try:
            r = requests.get(url, params=params, headers=headers, timeout=20)
        except requests.RequestException as e:
            result = (None, None, str(e).replace(API_KEY, "***"))  # error URLs contain the key
            continue
        if r.status_code >= 500:
            result = (r.status_code, None, "server error")
            continue
        try:
            events = r.json() if r.text.strip() else []  # DONKI returns an empty body when no events
        except ValueError:
            return r.status_code, None, "response is not JSON"
        return r.status_code, (len(events) if isinstance(events, list) else None), None
    return result


for label, url, params, headers, attempts in TRIES:
    status, count, error = attempt(url, params, headers, attempts)
    print(f"{label}: status {status}, events {count}" + (f", error: {error}" if error else ""))
    if status == 200 and count is not None:
        print(f"\nFLR works with: {label}")
        break
else:
    print("\nFLR unreachable on every attempt")
    raise SystemExit(1)
