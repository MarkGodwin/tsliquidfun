# Initial desktop validation — 26 October 2026

These are historical experiments preserved in checkpoint `d4422fda`. The current
code retains only `reference`, `pair`, and `two-stream`; see `README.md` for
current commands. Earlier raw CSV schemas and experiment names are unchanged.

## Follow-up: insertion and overflow experiments

Both variants are retained alongside the original adaptive implementation.
`BOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON` measures just combined tag update and
ordering; nested timers and all detailed particle counters are compiled out.
The measurements below use that mode, Release MSVC, one particle iteration,
300 warm-up / 600 measured steps, and three alternating reference/candidate
repetitions. Scenes, compiler and desktop are as described below. These are
short desktop experiments, not target-device acceptance results.

Percentage reduction in median combined update + sort time versus reference:

| Scene | Particles | Original adaptive | Insert during classification | Overflow + one swap |
|---|---:|---:|---:|---:|
| Settled | 1,000 | -87.5% | -81.2% | 38.3% |
| Settled | 3,000 | 9.5% | 13.3% | 39.1% |
| Settled | 5,000 | 14.1% | 17.1% | 38.9% |
| Shear | 1,000 | -0.9% | 1.8% | 21.6% |
| Shear | 3,000 | 19.2% | 19.0% | 28.9% |
| Shear | 5,000 | 21.8% | 21.7% | 29.3% |
| Churn | 1,000 | -42.3% | -39.7% | 35.8% |
| Churn | 3,000 | 8.0% | 9.3% | 37.2% |
| Churn | 5,000 | 16.7% | 19.9% | 38.0% |

Each column has its own paired reference repetitions. Reference timings varied,
particularly at 1,000 particles, so small cross-column differences are uncertain.
Overflow whole-step medians improved by 1.4–12.9% in these runs. Its scratch
capacity doubles from 16 to 32 bytes per allocated proxy slot; it also combines
two changes (no counting pass and bounded-swap/overflow construction), so these
results do not isolate which change supplies the gain. The merge remains lazy.

Identical-input replay, using the final executable for all three candidates,
confirmed overflow gains of 8.6–42.4% in sorting alone. At 5,000 particles,
reference/overflow median times were 0.0585/0.0337 ms settled,
0.0699/0.0471 ms shear, and 0.0587/0.0351 ms churn. Insertion alone still lost
on the 1,000-particle settled/churn cases. No Pi measurements have been made.

Validation: all 250 Release tests pass. Sorting, contact-equivalence and group
lifecycle tests exercise all three variants; random tests cover 3,000 inputs
per variant. Additional tests cover one-swap/overflow accounting, buffer reuse
across mode changes, and light profiling. The seven sorter tests also pass in
a light-profile Debug build. A 5,000-particle teleport scene with four particle
iterations passes shadow validation using overflow sorting. The light-profile
Testbed selector and combined timing display were checked interactively.

Raw outputs are in ignored `benchmark-results/variants-{baseline,insertion,overflow}`
and `benchmark-results/replay-{adaptive,insertion,overflow}`. Reproduce with
`run_matrix.py --candidate <name> --counts 1000 3000 5000 --iterations 1
--scenes settled shear churn --runs 3 --steps 600 --warmup 300`, adding
`--mode replay` for the replay runs.

The adaptive sorter is experimental and remains opt-in. These measurements
do **not** establish a Pi Zero W speedup or a 60-fps particle limit.

## Correctness

- All 248 tests pass in Release with the reference default.
- All 248 tests pass in Release and Debug with the adaptive test default
  and shadow validation enabled.
- The new suite includes 3,000 randomized inputs, sortedness and exact
  membership checks, fallback cases, newborns, contact equivalence, deletion,
  radius changes, and group split/join/snapshot/empty-group reuse.
- The five new tests also pass with profiling disabled.
- Binary trace save/load/replay and a four-particle-iteration Debug scene pass.

## Measurement method

Windows 11 x64, AMD family 25/model 97/stepping 2, MSVC 19.51.36260.0,
Release `/O2`, this uncommitted implementation based on `a4a99e90`.
Three repetitions with alternating sorter order; 300 warm-up and 600 measured
steps per repetition; one particle iteration, water particles, seed 1.
Numbers below compare medians across repetitions. Positive percentages mean
lower elapsed time with adaptive sorting.

Whole-step and replay measurements disable profiling and shadow validation.
Replay uses identical reference-generated inputs (120 frames per scene).
Combined proxy timings come from a separate profiling-enabled run and include
tag generation plus ordering. Replay excludes tag generation and setup.
No other test/build jobs ran during these measurements. Background desktop
activity and CPU power state were not controlled; small changes may be noise.

| Scene | Particles | Replay sort improvement | Combined proxy improvement | Whole-step improvement |
|---|---:|---:|---:|---:|
| Settled | 3,000 | 4.2% | 4.3% | 1.4% |
| Settled | 5,000 | 17.0% | 13.7% | 4.6% |
| Shear | 3,000 | 18.6% | 16.0% | 2.1% |
| Shear | 5,000 | 23.5% | 20.1% | 0.5% |
| Churn | 3,000 | 6.7% | 3.9% | 2.0% |
| Churn | 5,000 | 18.0% | 14.4% | 1.3% |
| Teleport | 3,000 | 10.3% | 13.0% | -0.1% |
| Teleport | 5,000 | 22.5% | 20.1% | 2.9% |

Additional whole-step scenes: separated groups changed by -1.5% / -0.2%
at 3,000 / 5,000 particles; falling changed by -3.3% / +0.5%.
The settled 3,000-particle p95 regressed by 3.6%. These results do not meet
the proposed promotion gate consistently, even before testing target hardware.

In the profiled scenes, settled/shear/churn had no fallback updates during
measurement. Teleport fell back on 3.33% of updates, matching its deliberate
jumps every 30 steps. Scratch capacity was 48,000 bytes at 3,000 particles and
80,000 bytes at 5,000; allocation growth can increase capacity geometrically.

## Reproduction and next decision

Use the commands in `README.md`, adding:

```sh
--counts 3000 5000 --iterations 1 --runs 3 --steps 600 --warmup 300
```

Whole-step scenes: `settled shear separated churn teleport falling`.
Replay/profile scenes: `settled shear churn teleport`.
Local raw CSVs, per-run metadata, and compiler configuration are retained under
`benchmark-results/desktop-world`, `desktop-replay`, and `desktop-profile`
(ignored generated artifacts).

Run the longer default matrix on the Pi Zero W, preferably followed by traces
from the actual application. Inspect proxy time as a fraction of total physics
time before investing further in sorting. Other particle stages dominate these
desktop workloads, so a sorting gain alone produces only a modest frame gain.
