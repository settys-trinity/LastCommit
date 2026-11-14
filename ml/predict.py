"""
FARSIDE - predict function for the bridge owner (Part 3).

    from ml.predict import predict_stress
    predict_stress({"hr_mean_z": 1.8, "rmssd_z": -1.2, ...})  ->  {"p_stress": 0.81, "label": "stress"}

Input: the 7 own-baseline-scaled features (*_z). Missing keys are allowed (imputed).
The model NEVER sets a triage tier by itself - it is one more indicator for the rules engine.
"""
from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd

MODEL_PATH = Path(__file__).parent / "out" / "stress_model_physio.joblib"


@lru_cache(maxsize=1)
def _load():
    return joblib.load(MODEL_PATH)


def predict_stress(features: dict) -> dict:
    bundle = _load()
    cols = bundle["features"]
    x = pd.DataFrame([{c: features.get(c) for c in cols}], columns=cols, dtype=float)
    p = float(bundle["model"].predict_proba(x)[0, 1])
    return {"p_stress": round(p, 3), "label": "stress" if p >= 0.5 else "baseline"}
