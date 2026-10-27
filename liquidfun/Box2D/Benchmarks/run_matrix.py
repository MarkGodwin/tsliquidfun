#!/usr/bin/env python3
"""Measure the cached engine or compare compact sorters in replay mode."""
import argparse
import csv
import json
import pathlib
import platform
import statistics
import subprocess
import time


def machine_state():
    state = {"platform": platform.platform(), "machine": platform.machine()}
    for name, path in {
        "model": "/proc/device-tree/model",
        "governor": "/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor",
        "frequency_khz": "/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq",
        "temperature_millidegrees": "/sys/class/thermal/thermal_zone0/temp",
    }.items():
        try:
            state[name] = pathlib.Path(path).read_text().strip("\0\n")
        except OSError:
            state[name] = None
    try:
        state["throttling"] = subprocess.check_output(
            ["vcgencmd", "get_throttled"], text=True, timeout=5).strip()
    except (OSError, subprocess.SubprocessError):
        state["throttling"] = None
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("executable", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path, default=pathlib.Path("benchmark-results"))
    parser.add_argument("--counts", type=int, nargs="+", default=[1000, 3000, 5000])
    parser.add_argument("--iterations", type=int, nargs="+", default=[1, 2, 4])
    parser.add_argument("--scenes", nargs="+", default=["settled", "falling", "shear", "separated", "churn", "teleport"])
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--steps", type=int, default=3000)
    parser.add_argument("--warmup", type=int, default=300)
    parser.add_argument("--mode", choices=["world", "replay"], default="world")
    parser.add_argument("--candidate", choices=["pair", "two-stream", "cached"], default=None)
    parser.add_argument("--baseline", choices=["reference", "pair", "two-stream", "cached"], default=None)
    args = parser.parse_args()
    if args.runs < 1 or args.steps < 1 or args.warmup < 0:
        parser.error("runs and steps must be positive; warmup must be nonnegative")
    if args.mode == "world":
        if any(value not in (None, "cached") for value in (args.baseline, args.candidate)):
            parser.error("world mode has one cached-proxy implementation; sorter comparisons require replay")
        sorters = ["cached"]
    else:
        args.baseline = args.baseline or "reference"
        args.candidate = args.candidate or "two-stream"
        if "cached" in (args.baseline, args.candidate):
            parser.error("sort-only traces contain no positions")
        if args.baseline == args.candidate:
            parser.error("baseline and candidate must differ")
        sorters = [args.baseline, args.candidate]
    args.output.mkdir(parents=True, exist_ok=True)
    records = []
    for scene in args.scenes:
        for count in args.counts:
            for iterations in args.iterations:
                for run in range(args.runs):
                    for sorter in (sorters if run % 2 == 0 else list(reversed(sorters))):
                        prefix = args.output / f"{args.mode}-{scene}-{count}-{iterations}-{run}-{sorter}"
                        command = [str(args.executable.resolve()), "--mode", args.mode,
                                   "--scene", scene, "--count", str(count), "--iterations", str(iterations),
                                   "--seed", "1", "--warmup", str(args.warmup), "--steps", str(args.steps),
                                   "--sorter", sorter, "--output", str(prefix)]
                        record = {"command": command, "before": machine_state(), "started": time.time()}
                        subprocess.run(command, check=True)
                        record["after"] = machine_state()
                        prefix.with_suffix(".machine.json").write_text(json.dumps(record, indent=2))
                        with prefix.with_suffix(".summary.csv").open(newline="") as stream:
                            row = next(csv.DictReader(stream))
                        with prefix.with_suffix(".steps.csv").open(newline="") as stream:
                            samples = list(csv.DictReader(stream))
                        for metric in ("proxy_ms", "order_ms", "contacts_ms"):
                            row[f"median_{metric}"] = statistics.median(float(s[metric]) for s in samples)
                        processed = sum(int(s["processed_proxies"]) for s in samples)
                        row["overflow_fraction"] = sum(int(s["overflow_particles"]) for s in samples) / processed if processed else 0
                        row["max_scratch_bytes"] = max(int(s["scratch_bytes"]) for s in samples)
                        row["requested_count"] = count
                        row["run"] = run
                        records.append(row)
    with (args.output / "matrix.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=records[0].keys())
        writer.writeheader()
        writer.writerows(records)
    if args.mode == "world":
        return
    comparisons = []
    for scene in args.scenes:
        for count in args.counts:
            for iterations in args.iterations:
                matching = [r for r in records if r["scene"] == scene and int(r["requested_count"]) == count
                            and int(r["iterations"]) == iterations]
                comparison = {"mode": args.mode, "scene": scene, "count": count, "iterations": iterations, "candidate": args.candidate, "baseline": args.baseline}
                for metric in ("median_ms", "p95_ms", "median_proxy_ms", "median_order_ms", "median_contacts_ms"):
                    baseline = [float(r[metric]) for r in matching if r["sorter"] == args.baseline]
                    candidate = [float(r[metric]) for r in matching if r["sorter"] == args.candidate]
                    base, result = statistics.median(baseline), statistics.median(candidate)
                    comparison[f"baseline_{metric}"] = base
                    comparison[f"candidate_{metric}"] = result
                    comparison[f"improvement_percent_{metric}"] = 100 * (base - result) / base if base else 0
                    comparison[f"baseline_range_{metric}"] = max(baseline) - min(baseline)
                    comparison[f"candidate_range_{metric}"] = max(candidate) - min(candidate)
                comparisons.append(comparison)
    with (args.output / "comparisons.csv").open("w", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=comparisons[0].keys())
        writer.writeheader()
        writer.writerows(comparisons)


if __name__ == "__main__":
    main()
