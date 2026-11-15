"""Turn site/data/routes.json into a CSV for Newsky's schedule import (Schedules > Export / Import > Import).

Usage:  python scripts/build_newsky_schedules.py

One schedule per leg that has a flight number in data-src/network.txt. Legs still without a number are
left out of the CSV and listed at the end, so you know which callsigns are missing.
An import replaces what is in Newsky, so the CSV always holds the whole network.

Duration = estimated block time (minutes). Every day is ticked: the weekly frequency of the real
network is only shown on the website. Empty airframes = ALL (777F and A330 can both fly every leg).

Run scripts/build_routes.py first if network.txt changed.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTES = ROOT / "site" / "data" / "routes.json"
OUT = ROOT / "newsky" / "schedules-import.csv"

HEADER = ["number", "dep", "arr", "type", "duration", "mon", "tue", "wed", "thu", "fri", "sat", "sun", "airframes", "active"]


def main() -> None:
    data = json.loads(ROUTES.read_text(encoding="utf-8"))
    rows, missing, seen = [], [], set()

    for r in data["rotations"]:
        for leg in r["legs"]:
            if not leg["flight"]:
                missing.append((r["id"], leg["from"], leg["to"]))
                continue
            if leg["flight"] in seen:
                raise SystemExit(f"flight number {leg['flight']} used twice")
            seen.add(leg["flight"])
            rows.append([leg["flight"], leg["from"], leg["to"], "cargo", leg["blockMin"], *["true"] * 7, "", "true"])

    rows.sort(key=lambda row: int(row[0]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as f:
        f.write("# CMA CGM Air Cargo Virtual - schedules for Newsky import\n")
        f.write(f"# Source: {data['source']}\n")
        f.write("# Duration in minutes (estimated block). Empty airframes = ALL.\n")
        w = csv.writer(f, lineterminator="\n")
        w.writerow(HEADER)
        w.writerows(rows)

    print(f"{len(rows)} schedules -> {OUT.relative_to(ROOT)}")
    if missing:
        print(f"\n{len(missing)} legs without a flight number (not in the CSV). Add them in data-src/network.txt:")
        for rid, a, b in missing:
            print(f"  {rid:22} {a}-{b}")


if __name__ == "__main__":
    main()
