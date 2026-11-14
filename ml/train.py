"""
FARSIDE - Part 1b (ML): train + validate the stress classifier, leaving one subject out.

Usage:
    python ml/train.py                      # random forest, demo subject S17
    python ml/train.py --model lgbm         # LightGBM instead
    python ml/train.py --demo-subject S5    # pick another held-out demo person

Reads ml/out/features.csv (from features.py). Writes:
    ml/out/loso_results.csv      accuracy / F1 per held-out subject  (put the mean on a slide)
    ml/out/stress_model.joblib   model trained on everyone EXCEPT the demo subject
    ml/out/demo_predictions.json predictions for the demo subject, for the app and Vercel
"""
import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import make_pipeline

FEATURES = ["hr_mean", "rmssd", "sdnn", "resp_rate", "temp_mean", "temp_slope", "acc_activity"]
X_COLS = [f + "_z" for f in FEATURES]   # own-baseline-scaled features
OUT = Path(__file__).parent / "out"


def make_model(kind: str):
    if kind == "lgbm":
        from lightgbm import LGBMClassifier
        clf = LGBMClassifier(n_estimators=200, learning_rate=0.05, num_leaves=15,
                             class_weight="balanced", verbose=-1, random_state=0)
    else:
        clf = RandomForestClassifier(n_estimators=300, min_samples_leaf=3,
                                     class_weight="balanced", random_state=0, n_jobs=-1)
    return make_pipeline(SimpleImputer(strategy="median"), clf)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", choices=["rf", "lgbm"], default="rf")
    ap.add_argument("--demo-subject", default="S17")
    ap.add_argument("--drop", nargs="*", default=[],
                    help="features to leave out, e.g. --drop temp_mean temp_slope acc_activity")
    ap.add_argument("--tag", default="", help="suffix for output files, e.g. physio")
    args = ap.parse_args()

    global FEATURES, X_COLS
    FEATURES = [f for f in FEATURES if f not in args.drop]
    X_COLS = [f + "_z" for f in FEATURES]
    sfx = f"_{args.tag}" if args.tag else ""
    print(f"Features used: {FEATURES}")

    df = pd.read_csv(OUT / "features.csv")
    df["y"] = (df.label == 2).astype(int)   # 1 = stress
    subjects = sorted(df.subject.unique(), key=lambda s: int(s[1:]))
    print(f"{len(df)} windows, {len(subjects)} subjects, model={args.model}\n")

    # --- leave one subject out ---
    rows = []
    for s in subjects:
        tr, te = df[df.subject != s], df[df.subject == s]
        m = make_model(args.model).fit(tr[X_COLS], tr.y)
        pred = m.predict(te[X_COLS])
        rows.append({"subject": s, "n": len(te),
                     "accuracy": accuracy_score(te.y, pred),
                     "f1_stress": f1_score(te.y, pred, zero_division=0)})
        print(f"  held out {s:>3}: acc={rows[-1]['accuracy']:.2f}  F1={rows[-1]['f1_stress']:.2f}")

    res = pd.DataFrame(rows)
    res.to_csv(OUT / f"loso_results{sfx}.csv", index=False)
    print(f"\nLOSO mean accuracy = {res.accuracy.mean():.3f} (sd {res.accuracy.std():.3f})")
    print(f"LOSO mean F1 stress = {res.f1_stress.mean():.3f} (sd {res.f1_stress.std():.3f})")
    print("Reference: WESAD paper reports up to 93% for binary stress vs non-stress.")
    if res.accuracy.mean() > 0.98:
        print("WARNING: suspiciously high - check for leakage before putting this on a slide.")

    # --- final model without the demo subject + demo predictions ---
    tr, demo = df[df.subject != args.demo_subject], df[df.subject == args.demo_subject]
    final = make_model(args.model).fit(tr[X_COLS], tr.y)
    joblib.dump({"model": final, "features": X_COLS, "demo_subject": args.demo_subject},
                OUT / f"stress_model{sfx}.joblib")

    proba = final.predict_proba(demo[X_COLS])[:, 1]
    demo_json = {
        "subject": args.demo_subject,
        "note": "Held-out WESAD subject, never in training. Replayed as a simulated Bio-Monitor feed.",
        "loso_mean_accuracy": round(float(res.accuracy.mean()), 3),
        "loso_mean_f1": round(float(res.f1_stress.mean()), 3),
        "windows": [
            {"t_start_s": round(float(r.start_s), 1), "t_end_s": round(float(r.end_s), 1),
             "true_label": r.label_name, "p_stress": round(float(p), 3),
             "predicted": "stress" if p >= 0.5 else "baseline",
             "hr_mean": None if pd.isna(r.hr_mean) else round(float(r.hr_mean), 1),
             "resp_rate": None if pd.isna(r.resp_rate) else round(float(r.resp_rate), 1)}
            for r, p in zip(demo.itertuples(), proba)
        ],
    }
    (OUT / f"demo_predictions{sfx}.json").write_text(json.dumps(demo_json, indent=2))
    print(f"\nSaved model -> {OUT / f'stress_model{sfx}.joblib'} (trained without {args.demo_subject})")
    print(f"Saved demo predictions -> {OUT / f'demo_predictions{sfx}.json'} ({len(demo)} windows)")

    # feature importance (random forest only) - nice for the slide
    clf = final[-1]
    if hasattr(clf, "feature_importances_"):
        imp = pd.Series(clf.feature_importances_, index=FEATURES).sort_values(ascending=False)
        print("\nFeature importance:\n" + imp.round(3).to_string())


if __name__ == "__main__":
    main()
