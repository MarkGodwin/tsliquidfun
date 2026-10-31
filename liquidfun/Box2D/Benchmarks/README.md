# Particle benchmark tools

For the changes tried, measurements and retained design, see the repository-level
[particle physics optimisation history](../../../docs/particle-optimisation.md).
This guide covers the tools supported by the current source.

## Measuring the engine

Run commands from the repository root. Configure an optimised native build with
benchmarks enabled and instrumentation disabled when measuring whole-step time:

```sh
cmake -S liquidfun/Box2D -B build \
  -DCMAKE_BUILD_TYPE=Release -DBOX2D_BUILD_EXAMPLES=OFF \
  -DBOX2D_BUILD_BENCHMARKS=ON -DBOX2D_BUILD_UNITTESTS=ON \
  -DBOX2D_PROFILE_PARTICLES=OFF -DBOX2D_PROFILE_PARTICLE_PROXY_ONLY=OFF \
  -DBOX2D_VALIDATE_PARTICLE_PROXY_SORT=OFF
cmake --build build --config Release
```

Visual Studio places `ParticleSortBenchmark.exe` under `build/Benchmarks/Release/`;
single-configuration generators normally place it under `build/Benchmarks/`.
Run unit tests from `liquidfun/Box2D/Unittests/` so their baseline paths resolve.

`ParticleSortBenchmark --mode world` measures complete world steps using the
current cached-position engine. It accepts `--scene`, `--count`, `--iterations`,
`--seed`, `--warmup`, `--steps` and `--output`. Scenes are `settled`, `falling`,
`shear`, `separated`, `churn` and `teleport`. The output prefix's parent directory
must exist. `--sorter` can be omitted or set to `cached` in world mode.

The matrix runner creates its output directory and repeats the selected cases:

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK \
  --mode world --output measurements/world \
  --counts 1000 3000 5000 --iterations 1 2 --runs 3 --warmup 300 --steps 600
```

Each measured step excludes rendering and scene steering performed outside the
world step. Use repeated runs, compare complete physics time and keep particle
iterations identical between comparisons. Use a fresh output directory for each
measurement. The matrix includes timing summaries, configuration and available
device-state information; fields unavailable on the host are left empty.

## Profiling and Testbed

Enable `BOX2D_BUILD_EXAMPLES=ON` to compile Testbed, then enable **Particle
Timings** in its UI. All scenes use cached proxy positions. The overlay totals
all particle systems and substeps, and retains the last sample while paused.
There are no experimental particle-storage or contact-order switches.

| CMake option | Purpose |
|---|---|
| `BOX2D_PROFILE_PARTICLES=ON` | Detailed cumulative stage timings and counters. |
| `BOX2D_PROFILE_PARTICLE_PROXY_ONLY=ON` | Combined proxy-update time only; overrides detailed instrumentation. |
| `BOX2D_VALIDATE_PARTICLE_PROXY_SORT=ON` | Shadow-check sorted proxy membership and cached positions; disable for timing. |

Read cumulative statistics with `GetParticleProfile()` and reset them with
`ResetParticleProfile()`. `classifyMs` includes fused tag computation and
classification; `orderMs` includes overflow sorting and final position-emitting
merge. Both are included in `proxyMs`, which is itself part of total physics time.
Do not add nested measurements together as separate costs. With both profiling
options off, particle instrumentation is disabled; use that configuration for
whole-step performance comparisons.

## Comparing historical sort algorithms

Replay mode compares precomputed index/tag keys. `reference` performs a full
comparison sort; `pair` uses directional streams and pairwise merges;
`two-stream` uses residents and overflow. These historical implementations are
in [ParticleProxyReplaySort.h](ParticleProxyReplaySort.h) and are not engine
runtime modes.

```sh
python3 liquidfun/Box2D/Benchmarks/run_matrix.py PATH_TO_BENCHMARK \
  --mode replay --baseline pair --candidate two-stream \
  --output measurements/replay --counts 1000 3000 5000 \
  --iterations 1 --runs 3 --warmup 300 --steps 600
```

Replay alternates algorithm order and verifies sorted membership outside its
timing. It excludes tag computation, position emission and contact discovery,
so it cannot measure the benefit of cached positions or the full current sorter.
`--sorter cached` is therefore rejected in replay mode.

`--trace-out FILE` captures proxy inputs before world steps, and `--trace-in FILE`
loads them in replay mode. Captures may contain pending newborns/zombies and do
not include later substeps. Capturing changes cache behaviour; omit it from
whole-step timing comparisons.

The `LFPS0001` format is little-endian: a frame count, then a count, sorted-prefix
length and history-valid flag for each frame, followed by `(index, oldTag,
newTag)` triples. All fields are 32-bit unsigned integers; newborn old tags are
unused. For external traces, scene settings that cannot be inferred are unknown.

The Pi Zero W requires an ARMv6/VFP-compatible toolchain. It cannot use the
NEON contact implementation. Desktop results do not establish Pi performance.
