# Particle proxy sort experiment

The reference sorter remains the default. To opt in, set
`b2ParticleSystemDef::proxySortMode = b2_adaptiveRowProxySort`, or call
`system->SetProxySortMode(b2_adaptiveRowProxySort)` outside world callbacks.
Initial desktop measurements and validation are recorded in `RESULTS.md`.

Three experimental modes are retained for comparison:

| API mode | Benchmark name | Algorithm |
|---|---|---|
| `b2_adaptiveRowProxySort` | `adaptive` | Original classify, repair, lazy merge |
| `b2_insertionProxySort` | `insertion` | Insert in order during classification, with the same shift budget |
| `b2_overflowProxySort` | `overflow` | Three ordered streams, one adjacent swap at most, sorted overflow |
| `b2_scanMergeProxySort` | `scan` | Same construction as overflow; select the smallest of four heads each time |
| `b2_pairMergeProxySort` | `pair` | Same construction; merge the two shortest incoming streams, then the third, then residents |
| `b2_twoStreamProxySort` | `two-stream` | Send every Y-band mover to overflow; merge only residents and sorted overflow |

The new merge experiments preserve overflow classification and one-swap repair.
`scan` bulk-copies the tail when only one stream remains. `pair` uses ordinary
two-way merges with bulk tail copies, temporary output storage, and one extra
reusable N-slot buffer. Its fresh scratch capacity is 40 bytes per slot versus
32 for the overflow baseline. `two-stream` is a separate classification
experiment: residents still receive one-swap repair, while all movers, newborns
and larger inversions go to `std::sort`. It requires 16 bytes per slot in a fresh
sorter. Allocated buffers are retained when switching modes.

Compare directly against the previous winner with `--baseline overflow`:

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK --baseline overflow --candidate scan --output benchmark-results/merge-scan
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK --baseline overflow --candidate pair --output benchmark-results/merge-pair
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK --baseline overflow --candidate two-stream --output benchmark-results/merge-two-stream
```

Add `--mode replay` for identical reference-generated input snapshots. The
`baseline` and `candidate` CSV columns identify the compared algorithms;
legacy `reference_*` columns contain the selected baseline's measurements.
The Testbed Variant list exposes these as **Overflow: direct merge**,
**Overflow: pairwise merge**, and **All movers to overflow**. No winner is
automatically selected.

The separate Windows build at
`build-adaptive-merge-testbed/Testbed/Release/Testbed.exe` contains these controls
with light profiling enabled. It avoids overwriting a running older Testbed.
Experiment outputs are saved under `benchmark-results/merge-{world,replay}-{scan,pair,two-stream}`:
1,000/3,000/5,000 particles, settled/shear/churn scenes, one particle iteration,
three repetitions, 300 warm-up and 600 measured steps. These output files have
not been interpreted or used to select a winner. A pre-existing Testbed instance
was left running, so desktop load was not controlled.

Use `--candidate insertion` or `--candidate overflow` with `run_matrix.py`.
Each run still alternates the candidate with `reference`; the CSV `candidate`
column identifies the variant (legacy `adaptive_*` columns contain its values).
The original algorithm description below applies to `adaptive` and `insertion`.

The adaptive sorter retains the previously sorted prefix; newly created
particles form a separate tail. It classifies old particles into north,
resident, and south streams, repairs horizontal order within each old row,
and sorts the newborn batch. Each directional stream is globally ordered
because its source rows were ordered. A lazy merge combines those streams
without repeatedly comparing mover heads while emitting residents.

All streams are staged before output. This deliberately replaces rolling
in-place compaction: arbitrary newborn destinations can otherwise overwrite
unread old proxies. No persistent row table or linked lists are required.
Two reusable proxy buffers cost 16 bytes per allocated particle slot, with
geometric capacity growth. The old proxy array and updated scratch remain
intact until classification/repair succeeds. No steady-state allocations
are needed when particle count stays within the established capacity.

Fallback uses the original `std::sort` when history is invalid, old tags are
unordered, any existing particle moves more than one row, or insertion repair
exceeds eight shifts per particle across the update. Creation alone does not
invalidate history. Deletion maintains the sorted-prefix length; radius
changes invalidate history. Equal-tag order can differ from `std::sort`, so
bit-identical long-running trajectories are not promised.

The overflow variant allocates three full-capacity streams, eliminating the
initial counting pass. It reuses the consumed portion of the updated-tag buffer
for rejected particles, jumps and newborns, so writing overflow never overtakes
unread input. A global monotonic-order check on each stream and at most one
adjacent swap guarantee sorted streams even if old history is unordered.
Invalid history sends everything through overflow sorting; this variant has no
repair budget or separate fallback path. Work is O(N + K log K), where K is the
overflow count. A sequence blocked by multiple large values can still make K
large. Detailed profiling records `overflowParticles` and `localSwaps`.

Overflow uses 32 bytes of scratch per capacity slot, compared with 16 for the
other two variants. Buffers grow geometrically and stay allocated when switching
modes; switching to overflow can allocate once even at a fixed particle count.
Its merge remains lazy, so this experiment changes stream construction and
capacity, not the merge strategy.

## Build and correctness checks

From the repository root, on Linux/Pi:

```sh
cmake -S liquidfun/Box2D -B build-adaptive-check \
  -DCMAKE_BUILD_TYPE=Release -DBOX2D_BUILD_EXAMPLES=OFF \
  -DBOX2D_BUILD_BENCHMARKS=ON -DBOX2D_PROFILE_PARTICLES=ON \
  -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=ON
cmake --build build-adaptive-check -j2
cd liquidfun/Box2D/Unittests
./ParticleProxySortTests
```

Unit-test output follows the repository's existing convention: Unix single
configuration builds normally put executables in `Unittests/`; Visual Studio
uses `Unittests/Release/`. Run all `*Tests` executables from `Unittests/` so
baseline paths resolve. `ParticleProxySortTests` includes randomized sorting,
fallbacks, newborns, contact equivalence, and group lifecycle regression tests.

For Windows use a Visual Studio generator, `--config Release`, and
`cmake --build ... -- /m:1 /nr:false`. Modern MSVC uses Google Test's bundled
tuple implementation rather than the removed `std::tr1` implementation.

## Performance builds

### Interactive Testbed

Configure with `BOX2D_BUILD_EXAMPLES=ON`, `BOX2D_PROFILE_PARTICLES=ON`,
`BOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF`, and `BOX2D_TEST_ADAPTIVE_DEFAULT=OFF`.
Build the `Testbed` target in Release. For example on Windows:

For fair combined **update + sort** comparisons, also enable
`BOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON`. It overrides detailed profiling and
compiles out all nested particle timers and counters, retaining only one timer
around the complete proxy update/order operation for either sorter. The Testbed
then shows the combined measurement and total world-step time. Set it OFF to
restore detailed breakdowns. Light-mode zeros in detailed CSV fields mean
unmeasured, not zero work. Replay excludes tag generation and remains a sort-only
measurement even in this mode.

```powershell
cmake -S liquidfun/Box2D -B build-adaptive-testbed -DBOX2D_BUILD_EXAMPLES=ON -DBOX2D_BUILD_UNITTESTS=OFF -DBOX2D_PROFILE_PARTICLES=ON -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF -DBOX2D_TEST_ADAPTIVE_DEFAULT=OFF
cmake --build build-adaptive-testbed --config Release --target Testbed -- /m:1 /nr:false
.\build-adaptive-testbed\Testbed\Release\Testbed.exe
```

Toggle **Adaptive Particle Sort** to switch every particle system in the active
scene; the **Variant** list chooses original adaptive, insertion, or overflow.
**Draw → Particle Timings** shows current-frame physics time, particle
solve time, tag generation, ordering (including fallback), particle/body contact
generation, collision, filters/listeners, remaining particle solve time, and
fallback counts. Measurements reset before every world step and sum all systems
and particle substeps; they exclude rendering and scene setup/emission outside
the step. Pause holds the last measured step with an explicit label, so Single
Step results remain readable. Switching sorter while paused clears the held
sample. The existing **Profile** panel provides rigid-body stage timings.

Totals include their components; do not add proxy time to tags/order or particle
solve time to its stages. Profiling adds overhead to both sorters. Restart the
scene for repeatable comparisons and keep particle iterations/flags unchanged;
switching modes does not rewind the simulation. Use trace replay for identical
inputs. Builds without profiling show an explicit disabled message, and shadow
validation builds show an overhead warning.

### Headless measurements

Disable shadow validation for every performance run:

```sh
cmake -S liquidfun/Box2D -B build-adaptive-profile \
  -DCMAKE_BUILD_TYPE=Release -DBOX2D_BUILD_EXAMPLES=OFF \
  -DBOX2D_BUILD_UNITTESTS=OFF -DBOX2D_BUILD_BENCHMARKS=ON \
  -DBOX2D_PROFILE_PARTICLES=ON -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF
cmake --build build-adaptive-profile -j2
python3 liquidfun/Box2D/Benchmarks/run_matrix.py \
  build-adaptive-profile/Benchmarks/ParticleSortBenchmark \
  --output benchmark-results/profile
```

Make a second build with `BOX2D_PROFILE_PARTICLES=OFF` and repeat the matrix
for final world-step timings. The same executable supports both sorters.
Keep compiler options, index width, timestep, flags, and iterations identical.
Copy `Benchmarks/build-info-Release.txt` from each build into its results.
The Zero W has an ARM1176 CPU; use its native ARMv6/VFP toolchain, never NEON
flags. If explicitly tuning GCC for a hard-float Raspberry Pi OS toolchain,
use `-mcpu=arm1176jzf-s -mfpu=vfp -mfloat-abi=hard` consistently with its ABI.

The full default matrix is intentionally substantial. A short smoke run is:

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py \
  build-adaptive-profile/Benchmarks/ParticleSortBenchmark \
  --counts 1000 --iterations 1 --scenes settled churn --runs 2 --steps 120 --warmup 30
```

Default benchmarks use 1/60-second steps, 8/3 rigid-body iterations, water
particles of radius 0.05, seed 1, 300 warm-up steps, and 3,000 measured steps.
The runner compares 1,000/3,000/5,000 particles, 1/2/4 particle iterations,
six scenes, and five repetitions with alternating sorter order. Scene steering
and particle creation occur before the measured world step. Falling liquid is
periodically lifted to maintain activity; teleport is explicitly a fallback
stress case. Capture device state before and after each run; inspect frequency,
temperature and `get_throttled` before interpreting results.

## Replay identical inputs

```sh
build-adaptive-profile/Benchmarks/ParticleSortBenchmark \
  --mode replay --scene shear --sorter reference --trace-out shear.lfps --output reference
build-adaptive-profile/Benchmarks/ParticleSortBenchmark \
  --mode replay --trace-in shear.lfps --sorter adaptive --output adaptive
```

Without `--trace-in`, replay captures up to 120 pre-step proxy snapshots from a
reference-driven simulation after warm-up. These precede lifetime/deletion
processing and can include pending zombies; they do not capture later substeps.
It reuses that corpus for the
requested warm-up and measurement iterations. Tag calculation, input copying,
trace I/O, and exact output verification are outside replay timing; all work
inside the sorting algorithm, including fallback, is timed. Use full-world
measurements to assess tag calculation and simulation impact. Replay keeps
at most 1,000 frames and 30,000 particles per loaded frame.

The trace format is little-endian: eight-byte magic `LFPS0001`, uint32 frame
count, then for each frame uint32 particle count, sorted-prefix length, valid
history flag, and `(uint32 index, uint32 oldTag, uint32 newTag)` per proxy in
old slot order. Newborn old tags are unused. `--trace-out` also works in world
mode, but capture allocates and affects caches: do not use capture runs as
final timing evidence. The benchmark-only capture helper demonstrates how to
record application inputs; the library has no file-I/O callback.
External traces report their maximum proxy count and `external_trace` scene;
unknown capture iterations and seed are reported as zero. Keep capture-run
metadata alongside traces. Generated-scene summaries report the requested
particle count; `.steps.csv` reports actual per-sample counts.

## Interpreting results

Each run produces `.steps.csv`, `.summary.csv`, and `.metadata.txt`.
The Python runner adds `.machine.json`, `matrix.csv`, and `comparisons.csv`.
Its matrix includes median proxy/order/contact times, fallback fractions, and
maximum scratch capacity; component timings require profiling to be enabled.
Positive improvement percentages mean faster adaptive sorting. Preserve
individual repetitions and their range rather than reporting only an average.

Detailed profiling is cumulative per particle system; reset with
`ResetParticleProfile()` and read with `GetParticleProfile()`. Disabled builds
return zeros and compile out detailed clocks/counters. Total solve, proxy,
and order times are inclusive; reference-sort time is a component of order
time. Remaining solver time is a residual, not an additional nested timer.
`particles` accumulates processed proxies, whereas the CSV `count` is the live
population after a step. Candidate/accepted contacts are counted before contact
filtering. Comparison/shift counters describe insertion repair only.

Proposed promotion gate: at least 10% lower median combined proxy update/order
time at 3,000 and 5,000 particles, beyond repetition noise, without over 3%
regression in median or p95 full-world time on representative scenes. Report
fallback stress cases separately. The 16.67-ms column is the physics budget
alone; it does not include rendering. Keep the optimization opt-in until Pi
measurements support a default change. Desktop results cannot establish this.

To exercise the existing suites with adaptive sorting, rebuild the correctness
configuration with `-DBOX2D_TEST_ADAPTIVE_DEFAULT=ON` and run all tests again.
This test-only option changes the definition constructor's default; leave it
OFF in production and performance builds. Shadow validation checks sortedness
and exact proxy membership at every adaptive update, allowing equal-tag ties.
