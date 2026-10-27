# Particle proxies and benchmarks

The engine has one proxy layout: `Proxy` contains particle index, spatial tag
and cached position (16 bytes). The concrete
`b2ParticleProxySorter` uses `b2ParticleProxyKey` records with only index and tag
(8 bytes). Classification computes each new tag from the current position and
routes the key immediately into shared scratch: residents grow forwards
from the front and overflow grows backwards from the end. There is no
pre-populated updated-key array and no second classification traversal of it.
Overflow sorting moves only keys; final merge gathers current positions into
the proxy array.

Positions refresh once per contact update, including unchanged tags and the
remaining merge tail. `Solve()` updates contacts on every particle substep, so
multiple particle iterations each get fresh positions. Newborn proxies are
initialized at creation. Queries after integration use the authoritative
position buffer for geometry, since the cached snapshot precedes integration.

There is no non-cached engine path, spare proxy array, layout conversion,
`proxySortMode`, `SetProxySortMode()` or Testbed sorter selector. Rebuild native
clients after the layout/API change. Bounds enumeration is one concrete type
with a fixed 16-byte stride and no layout branch or virtual dispatch.

Sort history preserves the ordered prefix while appending newborns. One
adjacent swap repairs isolated inversions; larger inversions and Y-band movers
enter overflow. Invalid history sends everything through overflow sorting.
Radius changes invalidate history; deletion preserves the surviving prefix.
Scratch capacity is 8 bytes per slot (one shared key buffer), grows
geometrically and is reused without allocation after warming up. Overflow
insertion reverses its input order; equal-tag order can differ from the
previous implementation, but repeats consistently for identical replay input
within the same build. Cross-platform equal-tag order is not guaranteed by
`std::sort`.

## Build and test

```sh
cmake -S liquidfun/Box2D -B build-contact-cache \
  -DCMAKE_BUILD_TYPE=Release -DBOX2D_BUILD_EXAMPLES=OFF \
  -DBOX2D_BUILD_UNITTESTS=ON -DBOX2D_BUILD_BENCHMARKS=ON \
  -DBOX2D_PROFILE_PARTICLES=OFF -DBOX2D_PROFILE_PARTICLE_PROXY_ONLY=OFF \
  -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF
cmake --build build-contact-cache --config Release
```

Run test executables from `liquidfun/Box2D/Unittests/` so baseline paths resolve.
Visual Studio puts them in `Unittests/Release/`; Unix builds put them directly
in `Unittests/`. `ParticleProxySortTests` checks compact-key order/membership,
in-place position emission, unchanged tags, every particle substep, contacts
against an independent all-pairs reference, group lifecycle, current-position
queries and barriers.

`BOX2D_VALIDATE_PARTICLE_PROXY_SORT=ON` checks compact-key membership/order
against `std::sort` and verifies emitted positions. Disable it when timing.

## Testbed and profiling

Build with `BOX2D_BUILD_EXAMPLES=ON` and launch Testbed. All scenes use cached
positions automatically. **Particle Timings** shows physics-frame time and,
when compiled in, stage timings across all systems/substeps. The fused tag/classification stage
is `classifyMs` / `classify_ms`; `orderMs` now covers overflow sort and final merge.
A separate tag-only timing is no longer available. Pausing retains
the last measured sample. Rendering and scene setup/emission outside the world
step are excluded from the physics-frame timer.

- `BOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON`: only combined tag update/sort/position
  emission time; overrides detailed profiling.
- `BOX2D_PROFILE_PARTICLES=ON` with proxy-only OFF: detailed cumulative stage
  timings and counters. Reset with `ResetParticleProfile()` and read with
  `GetParticleProfile()`. Totals include their components.
- Both OFF: no particle instrumentation; use this for whole-step timings.

For example on Windows:

```powershell
cmake -S liquidfun/Box2D -B build-adaptive-cache-testbed -DBOX2D_BUILD_EXAMPLES=ON -DBOX2D_BUILD_UNITTESTS=OFF -DBOX2D_PROFILE_PARTICLES=ON -DBOX2D_PROFILE_PARTICLE_PROXY_ONLY=OFF -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF
cmake --build build-adaptive-cache-testbed --config Release --target Testbed -- /m:1 /nr:false
.\build-adaptive-cache-testbed\Testbed\Release\Testbed.exe
```

## Headless world measurements

`ParticleSortBenchmark --mode world` always runs the cached engine. `--sorter`
may be omitted or set to `cached`; other values are rejected in world mode.
Scenes are `settled`, `falling`, `shear`, `separated`, `churn` and `teleport`.
The executable accepts `--count`, `--iterations`, `--warmup`, `--steps`, `--seed`
and `--output`. The output prefix's parent directory must exist.

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK \
  --mode world --output benchmark-results/current \
  --counts 1000 3000 5000 --iterations 1 2 --runs 3 --steps 600 --warmup 300
```

Matrix rows keep the requested count separately from the measured count, since
replay snapshots can include pending zombies/newborns. World matrices contain
one implementation, so they write `matrix.csv` and
per-run step/summary CSVs, metadata and device state without an A/B comparisons
file. Copy the build's `Benchmarks/build-info-Release.txt` into results.
Unmeasured profile fields are zero. Use a fresh output directory per matrix.

## Sort-only replay comparisons

The old `reference`, `pair` and `two-stream` algorithms remain selectable only
for compact-key replay and historical comparisons. Their concrete implementation
is in `Benchmarks/ParticleProxyReplaySort.h`, outside the engine sorter. Replay
continues to accept precomputed tags, so it does not measure fused production
classification. Sorter tests compare the production pass with the historical
two-stream tags and membership using positions that round-trip exact tags,
and check exact repeatability across cold and reused scratch buffers. Replay
excludes tag calculation, final position emission, setup/copying, I/O and exact
output verification from its timing. It cannot measure cached contact access.

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK \
  --mode replay --baseline pair --candidate two-stream \
  --output benchmark-results/replay --counts 1000 3000 5000 \
  --iterations 1 --runs 3 --steps 600 --warmup 300
```

Replay alternates baseline/candidate order and also writes `comparisons.csv`.
Positive improvement means lower candidate time. `--sorter cached` is rejected
in replay because the trace contains no positions.

Capture/load traces with `--trace-out FILE` and `--trace-in FILE`. Captured
snapshots now come from the cached engine before a step, may include pending
zombies and do not include later substeps. Capture perturbs caches; omit it for
final world timings. The unchanged trace format is little-endian `LFPS0001`,
uint32 frame count, then per-frame uint32 count/prefix/valid and
`(index, oldTag, newTag)` uint32 triples. Newborn old tags are unused. External
traces report `external_trace`, maximum proxy count and zero for unknown
seed/iterations; retain their original metadata.

## Historical measurements

[Initial contact-cache experiment](CONTACT_CACHE.md) and
[engine measurements](CONTACT_CACHE_ENGINE.md) record why this layout was
selected. Their compact-versus-cached modes are no longer present in the engine.
Older sorting experiments are recorded in `RESULTS.md` and checkpoint `d4422fda`.

The Pi Zero W requires ARMv6/VFP-compatible compilation rather than NEON.
Desktop timing results do not establish target-device gains or particle limits.

[Discarded particle-buffer spatial reordering experiment](SPATIAL_REORDER.md)
records the implementation, correctness findings and measured regressions.
