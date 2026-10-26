# Particle proxy sorting

The production default is `b2_twoStreamProxySort`. The reference `std::sort`
remains selectable as `b2_referenceProxySort`. Two adaptive implementations are retained:

| API mode | Benchmark name | Testbed variant |
|---|---|---|
| `b2_twoStreamProxySort` | `two-stream` | All movers to overflow |
| `b2_pairMergeProxySort` | `pair` | Separate movers + merge |

Select a mode through `b2ParticleSystemDef::proxySortMode` or call
`SetProxySortMode()` outside world callbacks. The original adaptive sorter,
insertion repair, lazy merge and direct four-way merge have been removed.
Checkpoint `d4422fda` preserves all experiments; `RESULTS.md` records historical
measurements and uses their original names. Existing generated result files
are unchanged. Experimental enum values have been renumbered; rebuild clients.

## Algorithms and memory

Both algorithms retain previously sorted proxies and track an appended newborn
tail. Each ordered stream accepts an item directly or repairs one adjacent
inversion with a single swap. Larger inversions go into overflow, alongside
newborns and particles that cannot use the ordered-stream route. Overflow is
sorted with `std::sort`.

- **Two-stream:** every Y-band mover goes to overflow. One two-way merge combines
  residents with sorted overflow, bulk-copying the remaining tail.
- **Separate movers:** movements of one band go into north/south streams.
  Larger jumps go to overflow. The two shortest incoming streams are merged,
  then the third, then residents. All merges use the same two-way helper.

There is no counting pass, insertion-sort loop, shift budget or separate fallback
path. Invalid history sends all particles through overflow sorting. A global
order check keeps each stream sorted even if old history is unordered. Radius
changes invalidate history; deletion preserves the surviving sorted-prefix
length. Equal-tag order can differ from the reference and affect later trajectories.

Scratch capacity is 16 bytes per slot for two-stream and 40 for separate movers.
Buffers grow geometrically, remain allocated across mode changes and require no
steady-state allocation once capacity is sufficient. Overflow reuses the consumed
prefix of the updated-tag buffer, so its writes never overtake unread input.

## Builds and correctness

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

Run all `*Tests` from `Unittests/` so baseline paths resolve. Visual Studio puts
executables under `Unittests/Release/`; use `--config Release` and
`-- /m:1 /nr:false` when building. The sorter suite tests both implementations,
including randomized order/membership, newborns, jumps, disorder, contact
equivalence, group lifecycle and mode-switch buffer reuse.

`BOX2D_VALIDATE_PARTICLE_PROXY_SORT` shadow-checks exact proxy membership and
ordering. Disable it for performance measurements. Existing test scenes use the
production two-stream default; the old `BOX2D_TEST_ADAPTIVE_DEFAULT` option has
been removed.

## Testbed and profiling

Build Testbed with `BOX2D_BUILD_EXAMPLES=ON`. **Adaptive Particle Sort** toggles
between reference and the selected **Variant** across every particle system.
**Particle Timings** shows per-frame measurements; paused frames retain the last
measured step, and changing modes clears that sample. Restart scenes for
repeatable comparisons. Timings cover the world step, excluding rendering and
scene emission/setup outside it.

Choose profiling at build time:

- `BOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON`: one timer around combined tag update
  and sorting. Overrides detailed profiling; nested timers and counters compile
  out. Prefer this for comparisons.
- `BOX2D_PROFILE_PARTICLES=ON`, proxy-only OFF: stage timings, overflow counts,
  swaps, contacts and scratch capacity. Timings are cumulative; reset using
  `ResetParticleProfile()` and read `GetParticleProfile()`. Totals include their
  components; remaining solver time is a residual.
- Both OFF: no particle profiling; useful for final whole-step measurements.

For example on Windows:

```powershell
cmake -S liquidfun/Box2D -B build-adaptive-clean-testbed -DBOX2D_BUILD_EXAMPLES=ON -DBOX2D_BUILD_UNITTESTS=OFF -DBOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF
cmake --build build-adaptive-clean-testbed --config Release --target Testbed -- /m:1 /nr:false
.\build-adaptive-clean-testbed\Testbed\Release\Testbed.exe
```

## Headless benchmarks

Enable `BOX2D_BUILD_BENCHMARKS=ON` with examples OFF for a headless build.
The executable supports `--sorter reference|pair|two-stream`, `--mode world|replay`,
`--count`, `--iterations`, `--warmup`, `--steps`, `--seed`, and `--output`.
Scenes are `settled`, `falling`, `shear`, `separated`, `churn`, and `teleport`.

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK \
  --baseline pair --candidate two-stream --output benchmark-results/current \
  --counts 1000 3000 5000 --iterations 1 --runs 3 --steps 600 --warmup 300
```

The runner alternates baseline/candidate order and writes per-run step/summary
CSVs, metadata, device state, `matrix.csv`, and `comparisons.csv`. Comparisons
now use `baseline_*` and `candidate_*` columns. Positive improvement means lower
candidate time. Unmeasured profile fields are zero. Copy the build's
`Benchmarks/build-info-Release.txt` into results for compiler configuration.

For identical sort inputs, add `--mode replay`, or save/load `--trace-out FILE`
and `--trace-in FILE`. Replay captures reference-generated pre-step snapshots,
which may include pending zombies and do not include later substeps. It excludes
tag calculation, copying/setup, I/O and exact output verification from timing.
Use world mode for combined update/order impact. Trace capture perturbs caches;
do not use capture runs as final world-step timing evidence.

Trace format: little-endian magic `LFPS0001`, uint32 frame count, then per frame
uint32 count/prefix/valid and `(index, oldTag, newTag)` uint32 triples. Newborn
old tags are unused. External traces report `external_trace`, maximum proxy
count and zero for unknown capture seed/iterations; retain original metadata.

The Pi Zero W requires ARMv6/VFP-compatible compilation, not NEON. Final
acceptance needs target-device measurements with stable CPU frequency and no
throttling. Desktop results alone do not establish a 60-fps particle limit.
