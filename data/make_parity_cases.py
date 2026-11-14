"""Write app/src/engine/parity_cases.json: random and boundary cases scored by data/score_reference.py.

app/src/engine/rules.test.ts checks that the TypeScript engine gives the same status for every case.
Re-run after any change to data/knowledge.json or data/score_reference.py:

    python data/make_parity_cases.py
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))
import score_reference as ref  # noqa: E402

# type -> (value range, mean range, spread range, decimals, boundary values)
RANGES = {
    "sleep_hours": ((2, 10), (6, 9), (0, 2), 1, [6, 7, 6.0, 7.0]),
    "mood": ((1, 5), (3, 5), (0, 1), 0, [2, 3, 4]),
    "reaction_time_median": ((200, 500), (250, 350), (0, 40), 0, [330, 345, 360]),
    "lapses": ((0, 6), (0, 2), (0, 1.5), 0, [0, 1, 2, 3]),
    "sway_rms": ((0.01, 0.1), (0.02, 0.06), (0, 0.02), 3, [0.041, 0.051, 0.056]),
    "lab_glucose": ((30, 300), (60, 100), (0, 25), 0, [53, 54, 65, 99, 100, 249, 250]),
}

rng = random.Random(20261114)
cases = []
for t, ((lo, hi), (mlo, mhi), (slo, shi), dp, edges) in RANGES.items():
    assert t in ref.KNOWLEDGE, f"{t} missing from knowledge.json"
    for i in range(120):
        n = rng.randint(1, 4)
        hist = [rng.choice(edges) if rng.random() < 0.3 else round(rng.uniform(lo, hi), dp) for _ in range(n)]
        if dp == 0:
            hist = [int(round(v)) for v in hist]
        if i % 4 == 0:
            mean = spread = None  # no baseline yet
        else:
            mean, spread = round(rng.uniform(mlo, mhi), 3), round(rng.uniform(slo, shi), 3)
        cases.append({"type": t, "history": hist, "mean": mean, "spread": spread,
                      "expected": ref.score(t, hist, mean, spread)})

out = ROOT / "app" / "src" / "engine" / "parity_cases.json"
out.write_text(json.dumps({"generated_by": "data/make_parity_cases.py", "cases": cases}, indent=0) + "\n")
counts = {s: sum(c["expected"] == s for c in cases) for s in ("green", "amber", "red")}
print(f"Wrote {out.name}: {len(cases)} cases {counts}")
