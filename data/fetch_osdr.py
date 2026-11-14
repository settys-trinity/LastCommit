"""Download the two Inspiration4 clinical files from NASA OSDR into data/raw/ and verify them.

Run on a laptop with internet:  python data/fetch_osdr.py
Then rebuild baselines:          python data/build_baselines.py

Study pages:
  OSD-575 (serum CMP)       https://osdr.nasa.gov/bio/repo/data/studies/OSD-575
  OSD-569 (whole-blood CBC) https://osdr.nasa.gov/bio/repo/data/studies/OSD-569

The URLs below were checked in a browser on 2026-11-14. This script itself has not been
run against NASA from the build environment (it has no access to osdr.nasa.gov), so if it
fails, open the URL in a browser and save the file into data/raw/ by hand.
"""
import hashlib
from pathlib import Path
from urllib.request import Request, urlopen

BASE = "https://osdr.nasa.gov/geode-py/ws/studies/{osd}/download?source=datamanager&file={name}"
FILES = [
    ("OSD-575", "LSDS-8_Comprehensive_Metabolic_Panel_CMP.upload_SUBMITTED.csv",
     "dab247eb794edab59aaaa683c85fd1f2dbf4ae3684872739338e10ead4192a0c"),
    ("OSD-569", "LSDS-7_Complete_Blood_Count_CBC.upload_SUBMITTED.csv",
     "10a878b009eb2ea11a13fe92ad698098858639e8ed02f5ee849431313b9457d3"),
]

raw = Path(__file__).parent / "raw"
raw.mkdir(exist_ok=True)
for osd, name, want in FILES:
    print(f"Downloading {osd}/{name}")
    req = Request(BASE.format(osd=osd, name=name), headers={"User-Agent": "farside-hackathon/1.0"})
    data = urlopen(req, timeout=60).read()
    got = hashlib.sha256(data).hexdigest()
    (raw / name).write_bytes(data)
    status = "checksum OK" if got == want else f"CHECKSUM DIFFERS (got {got[:12]}..., NASA may have updated the file; rerun validate.py)"
    print(f"  saved {raw / name} ({len(data)} bytes) - {status}")
