"""
FARSIDE - Part 1b (ML): load one WESAD subject and cut 60 s windows.

Usage:
    python ml/wesad_windows.py --root path/to/WESAD --subject S2

What it does:
  1. Loads WESAD/<subject>/<subject>.pkl (chest device, all channels 700 Hz)
  2. Prints channel shapes and label counts
  3. Keeps only baseline (1) and stress (2)
  4. Cuts 60 s windows sliding every 15 s, INSIDE each continuous run of one label,
     so no window mixes baseline and stress
  5. Prints the window counts and saves them to ml/out/<subject>_windows.npz

WESAD labels: 0 none, 1 baseline, 2 stress, 3 amusement, 4 meditation, 5-7 ignore.
"""
import argparse
import pickle
from pathlib import Path

import numpy as np

FS = 700                 # chest device sample rate (Hz)
WIN_S, STEP_S = 60, 15   # window length and slide, seconds
WIN, STEP = WIN_S * FS, STEP_S * FS
KEEP = {1: "baseline", 2: "stress"}


def load_subject(root: Path, subject: str) -> dict:
    path = root / subject / f"{subject}.pkl"
    with open(path, "rb") as f:
        return pickle.load(f, encoding="latin1")  # saved with Python 2


def label_runs(labels: np.ndarray):
    """Yield (label, start, end) for each continuous run of the same label."""
    change = np.flatnonzero(np.diff(labels)) + 1
    starts = np.concatenate(([0], change))
    ends = np.concatenate((change, [len(labels)]))
    for s, e in zip(starts, ends):
        yield int(labels[s]), int(s), int(e)


def cut_windows(labels: np.ndarray):
    """Return list of (start, end, label) windows that sit fully inside one kept run."""
    windows = []
    for lab, s, e in label_runs(labels):
        if lab not in KEEP:
            continue
        for w0 in range(s, e - WIN + 1, STEP):
            windows.append((w0, w0 + WIN, lab))
    return windows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, type=Path, help="folder that contains S2, S3, ...")
    ap.add_argument("--subject", default="S2")
    args = ap.parse_args()

    d = load_subject(args.root, args.subject)
    chest = d["signal"]["chest"]
    labels = np.asarray(d["label"]).ravel()

    print(f"== {args.subject} ==")
    for k, v in chest.items():
        print(f"  chest.{k:<5} shape={np.asarray(v).shape}")
    print(f"  labels      shape={labels.shape}  ({len(labels) / FS / 60:.1f} min)")
    vals, counts = np.unique(labels, return_counts=True)
    for v, c in zip(vals, counts):
        print(f"  label {v}: {c:>9} samples = {c / FS / 60:5.1f} min")

    wins = cut_windows(labels)
    n_base = sum(1 for w in wins if w[2] == 1)
    n_stress = sum(1 for w in wins if w[2] == 2)
    print(f"\nWindows ({WIN_S}s, step {STEP_S}s): baseline={n_base}  stress={n_stress}  total={len(wins)}")
    if n_stress:
        print(f"Class ratio baseline:stress = {n_base / n_stress:.2f} : 1  -> use class_weight='balanced'")

    out = Path(__file__).parent / "out"
    out.mkdir(exist_ok=True)
    arr = np.array(wins, dtype=np.int64).reshape(-1, 3)
    np.savez(out / f"{args.subject}_windows.npz", start=arr[:, 0], end=arr[:, 1], label=arr[:, 2])
    print(f"Saved window index -> {out / f'{args.subject}_windows.npz'}")


if __name__ == "__main__":
    main()
