"""Turn data-src/network.txt + data-src/airports.json into site/data/routes.json.

Usage:  python scripts/build_routes.py

Prints every rotation with its legs, distance and estimated block time, for a quick check.
"""
import json
import math
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NETWORK = ROOT / "data-src" / "network.txt"
AIRPORTS = ROOT / "data-src" / "airports.json"
OUT = ROOT / "site" / "data" / "routes.json"

# Who flies each rotation in the real world, as in the brochure map (see data-src/network.txt).
OPERATORS = {
    "cma": "CMA CGM AIR CARGO",
    "bel": "Air Belgium",
    "atlas": "Atlas Air for CMA CGM AIR CARGO",
}

# Estimated block time of a widebody freighter: great-circle distance at 470 kt, plus 35 min
# for taxi, climb and approach. Rounded to 5 minutes. Only used for display and the Newsky import.
CRUISE_KT = 470
OVERHEAD_MIN = 35


def great_circle_nm(a: dict, b: dict) -> int:
    lat1, lon1, lat2, lon2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return round(2 * 3440.065 * math.asin(math.sqrt(h)))


def block_minutes(nm: int) -> int:
    return round((nm / CRUISE_KT * 60 + OVERHEAD_MIN) / 5) * 5


def main() -> None:
    airports = {k: v for k, v in json.loads(AIRPORTS.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    rotations = []
    current = None

    for lineno, raw in enumerate(NETWORK.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] == "ROTATION":
            if len(parts) != 3 or not parts[1].isdigit() or parts[2] not in OPERATORS:
                sys.exit(f"line {lineno}: expected 'ROTATION <flights per week> <{'|'.join(OPERATORS)}>'")
            current = {"perWeek": int(parts[1]), "operator": parts[2], "legs": []}
            rotations.append(current)
            continue
        if parts[0] == "LEG":
            if current is None:
                sys.exit(f"line {lineno}: LEG before any ROTATION")
            if len(parts) != 4:
                sys.exit(f"line {lineno}: expected 'LEG <from ICAO> <to ICAO> <flight number or ->'")
            origin, dest, flight = parts[1:]
            for icao in (origin, dest):
                if icao not in airports:
                    sys.exit(f"line {lineno}: unknown airport {icao}, add it to {AIRPORTS.name}")
            if current["legs"] and current["legs"][-1]["to"] != origin:
                sys.exit(f"line {lineno}: leg starts at {origin} but the previous leg ended at {current['legs'][-1]['to']}")
            if flight != "-" and not flight.isdigit():
                sys.exit(f"line {lineno}: flight number must be digits only (e.g. 1234), or '-'")
            nm = great_circle_nm(airports[origin], airports[dest])
            current["legs"].append({
                "from": origin, "to": dest, "flight": None if flight == "-" else flight,
                "distanceNm": nm, "blockMin": block_minutes(nm),
            })
            continue
        sys.exit(f"line {lineno}: cannot parse '{line}'")

    numbers = [leg["flight"] for r in rotations for leg in r["legs"] if leg["flight"]]
    duplicates = sorted({n for n in numbers if numbers.count(n) > 1})
    if duplicates:
        sys.exit(f"flight number used on several legs: {', '.join(duplicates)}")

    for r in rotations:
        if not r["legs"]:
            sys.exit("a ROTATION has no LEG")
        stops = [r["legs"][0]["from"]] + [leg["to"] for leg in r["legs"]]
        r["id"] = "-".join(airports[s]["iata"] for s in stops)
        r["distanceNm"] = sum(leg["distanceNm"] for leg in r["legs"])
        r["blockMin"] = sum(leg["blockMin"] for leg in r["legs"])

    used = {icao for r in rotations for leg in r["legs"] for icao in (leg["from"], leg["to"])}
    out = {
        "generated": date.today().isoformat(),
        "source": "CMA CGM AIR CARGO brochure (A4_BROCHURE_CCAC.pdf)",
        "hub": "LFPG",
        "operators": OPERATORS,
        "airports": {k: v for k, v in airports.items() if k in used},
        "rotations": rotations,
        "totals": {
            "rotations": len(rotations),
            "legs": sum(len(r["legs"]) for r in rotations),
            "airports": len(used),
            "weeklyRotations": sum(r["perWeek"] for r in rotations),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    t = out["totals"]
    print(f"{t['rotations']} rotations, {t['legs']} legs, {t['airports']} airports, "
          f"{t['weeklyRotations']} rotations a week -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024 + 1} KB)")
    missing = sum(1 for r in rotations for leg in r["legs"] if not leg["flight"])
    if missing:
        print(f"{missing} legs still without a flight number")
    for r in rotations:
        print(f"\n  {r['id']:22} {r['operator']:5} {r['perWeek']}/week  {r['distanceNm']:>6} nm  "
              f"{r['blockMin'] // 60}h{r['blockMin'] % 60:02d}")
        for leg in r["legs"]:
            print(f"      {leg['from']}-{leg['to']}  {leg['flight'] or '----':>5}  {leg['distanceNm']:>5} nm  "
                  f"{leg['blockMin'] // 60:>2}h{leg['blockMin'] % 60:02d}")


if __name__ == "__main__":
    main()
