"""
FARSIDE - Part 1b (ML): turn WESAD chest signals into one feature row per 60 s window.

Usage:
    python ml/features.py --root WESAD                 # all 15 subjects
    python ml/features.py --root WESAD --subjects S2   # quick test on one

Output: ml/out/features.csv  (one row per window)

Features (chosen to match what the CSA Bio-Monitor / Astroskin measures: ECG, breathing,
skin temperature, accelerometry - so EDA and EMG are deliberately NOT used):
    hr_mean      mean heart rate (bpm) from ECG R-peaks
    rmssd        heart-rate variability, ms
    sdnn         heart-rate variability, ms
    resp_rate    breaths per minute (dominant frequency of the breathing signal)
    temp_mean    skin temperature mean (deg C)
    temp_slope   skin temperature change (deg C per minute)
    acc_activity movement level (std of acceleration magnitude)

Also writes *_z columns: each feature scaled against that subject's OWN baseline
windows (z = (x - baseline mean) / baseline std). This matches FARSIDE's own-baseline
idea; in real use each astronaut would record a calibration session.
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt, find_peaks, welch

from wesad_windows import FS, KEEP, STEP, WIN, label_runs, load_subject

SUBJECTS = [f"S{i}" for i in range(2, 18) if i != 12]  # S1 and S12 do not exist
FEATURES = ["hr_mean", "rmssd", "sdnn", "resp_rate", "temp_mean", "temp_slope", "acc_activity"]

try:
    import neurokit2 as nk
    HAVE_NK = True
except ImportError:
    HAVE_NK = False


# ---------- ECG ----------
def r_peaks(ecg: np.ndarray) -> np.ndarray:
    """R-peak sample indices for one continuous ECG segment."""
    if HAVE_NK:
        cleaned = nk.ecg_clean(ecg, sampling_rate=FS)
        _, info = nk.ecg_peaks(cleaned, sampling_rate=FS)
        return np.asarray(info["ECG_R_Peaks"], dtype=int)
    # fallback: band-pass + simple peak finder
    b, a = butter(3, [5 / (FS / 2), 15 / (FS / 2)], btype="band")
    f = filtfilt(b, a, ecg)
    f = f if np.abs(f.max()) >= np.abs(f.min()) else -f
    peaks, _ = find_peaks(f, distance=int(0.3 * FS), height=np.percentile(f, 95) * 0.4)
    return peaks


def hrv_features(peaks_in_window: np.ndarray) -> dict:
    rr = np.diff(peaks_in_window) / FS * 1000.0           # ms
    rr = rr[(rr > 300) & (rr < 2000)]                     # 30-200 bpm, drop artefacts
    if len(rr) < 10:
        return {"hr_mean": np.nan, "rmssd": np.nan, "sdnn": np.nan}
    return {
        "hr_mean": 60000.0 / rr.mean(),
        "rmssd": float(np.sqrt(np.mean(np.diff(rr) ** 2))),
        "sdnn": float(rr.std(ddof=1)),
    }


# ---------- breathing, temperature, movement ----------
def resp_rate(resp: np.ndarray) -> float:
    x = resp[::20]                                        # 700 Hz -> 35 Hz is plenty
    f, p = welch(x - x.mean(), fs=FS / 20, nperseg=min(len(x), 35 * 30))
    band = (f >= 0.1) & (f <= 0.7)                        # 6-42 breaths/min
    return float(f[band][np.argmax(p[band])] * 60) if band.any() else np.nan


def temp_features(temp: np.ndarray) -> dict:
    x = temp[::FS]                                        # 1 Hz
    t_min = np.arange(len(x)) / 60.0
    slope = np.polyfit(t_min, x, 1)[0] if len(x) > 2 else np.nan
    return {"temp_mean": float(x.mean()), "temp_slope": float(slope)}


def acc_activity(acc: np.ndarray) -> float:
    mag = np.linalg.norm(acc, axis=1)
    return float(mag.std())


# ---------- per subject ----------
def subject_features(root: Path, subject: str) -> pd.DataFrame:
    d = load_subject(root, subject)
    chest = {k: np.asarray(v) for k, v in d["signal"]["chest"].items()}
    ecg, resp, temp, acc = (chest["ECG"].ravel(), chest["Resp"].ravel(),
                            chest["Temp"].ravel(), chest["ACC"])
    labels = np.asarray(d["label"]).ravel()

    rows = []
    for lab, s, e in label_runs(labels):
        if lab not in KEEP or e - s < WIN:
            continue
        peaks = r_peaks(ecg[s:e]) + s                      # detect once per continuous run
        for w0 in range(s, e - WIN + 1, STEP):
            w1 = w0 + WIN
            row = {"subject": subject, "label": lab, "label_name": KEEP[lab],
                   "start_s": w0 / FS, "end_s": w1 / FS}
            row.update(hrv_features(peaks[(peaks >= w0) & (peaks < w1)]))
            row["resp_rate"] = resp_rate(resp[w0:w1])
            row.update(temp_features(temp[w0:w1]))
            row["acc_activity"] = acc_activity(acc[w0:w1])
            rows.append(row)

    df = pd.DataFrame(rows)
    base = df[df.label == 1]
    for f in FEATURES:
        mu, sd = base[f].mean(), base[f].std()
        df[f + "_z"] = (df[f] - mu) / (sd if sd and sd > 1e-9 else 1.0)
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, type=Path)
    ap.add_argument("--subjects", nargs="*", default=SUBJECTS)
    args = ap.parse_args()

    print(f"ECG peaks via {'neurokit2' if HAVE_NK else 'scipy fallback'}")
    out = Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)

    frames = []
    for s in args.subjects:
        df = subject_features(args.root, s)
        nan_rows = int(df[FEATURES].isna().any(axis=1).sum())
        print(f"{s}: {len(df)} windows ({(df.label == 1).sum()} baseline, {(df.label == 2).sum()} stress), "
              f"rows with missing values: {nan_rows}")
        frames.append(df)

    all_df = pd.concat(frames, ignore_index=True)
    all_df.to_csv(out / "features.csv", index=False)
    print(f"\nSaved {len(all_df)} rows -> {out / 'features.csv'}")
    print("\nMean of each feature, baseline vs stress (sanity check: stress should usually show "
          "higher hr_mean and lower rmssd):")
    print(all_df.groupby("label_name")[FEATURES].mean().round(2).T)


if __name__ == "__main__":
    main()
