#!/usr/bin/env python3
"""Remove duplicate codes from codes.csv, keeping the earliest occurrence."""

import argparse
import csv
from pathlib import Path


def dedupe_codes(input_path: Path, output_path: Path | None = None) -> int:
    output_path = output_path or input_path

    with input_path.open(newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        return 0

    header, *data_rows = rows
    seen: set[str] = set()
    unique_rows: list[list[str]] = []
    removed = 0

    for row in data_rows:
        if not row or not row[0].strip():
            continue

        code = row[0].strip()
        if code in seen:
            removed += 1
            continue

        seen.add(code)
        unique_rows.append([code])

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(unique_rows)

    return removed


def main() -> None:
    default_csv = Path(__file__).resolve().parent / ".." / "data" / "codes.csv"

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=default_csv,
        help=f"Input CSV file (default: {default_csv})",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output CSV file (default: overwrite input)",
    )
    args = parser.parse_args()

    removed = dedupe_codes(args.input, args.output)
    destination = args.output or args.input
    print(f"Removed {removed} duplicate(s). Wrote {destination}")


if __name__ == "__main__":
    main()
