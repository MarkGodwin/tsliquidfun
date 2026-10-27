# Historical final-merge position cache experiment

The cached layout has been selected for the engine. Current implementation and
commands are in [README.md](README.md). The former runtime A/B selector and
standalone `ParticleContactCacheBenchmark` target have been removed. The
prototype source is preserved locally under
`benchmark-results/contact-cache-engine/archive/` with the generated results.

The initial isolated replay compared identical simulation snapshots. Sorting
kept 8-byte index/tag records; the final merge emitted 16-byte proxies with
positions. Contact output matched production exactly. These historical stage
measurements motivated the later whole-engine experiment; they are not fresh
measurements of the final cleanup.

## Desktop results, 27 October 2026

MSVC 19.51.36260.0, x64 Release `/O2 /Ob2`, all profiling and sort validation
disabled. Source base `dc3a460a`, plus this experiment. Each case uses 300 warmup
world steps, 64 captured snapshots, 30 repetitions and 11 alternating rounds.

| Scene | Particles | Baseline total (ms) | Cached total (ms) | Time reduction |
|---|---:|---:|---:|---:|
| settled | 3000 | 0.1945 | 0.1858 | 4.5% |
| settled | 5000 | 0.3447 | 0.3170 | 8.0% |
| falling | 3000 | 0.1900 | 0.1724 | 9.3% |
| falling | 5000 | 0.3435 | 0.3148 | 8.4% |
| shear | 3000 | 0.2294 | 0.2087 | 9.0% |
| shear | 5000 | 0.4172 | 0.3809 | 8.7% |
| churn | 3000 | 0.1940 | 0.1735 | 10.6% |
| churn | 5000 | 0.3431 | 0.3136 | 8.6% |

At 5,000 particles, the combined measured stage takes 8.0-8.7% less time.
The extra gather raises sort/merge cost, but contact savings exceed it in
all four scenes. Stage medians below are computed separately, so they need
not sum to the median total above.

| Scene (5,000) | Baseline sort/merge (ms) | Cached sort/merge (ms) | Baseline contacts (ms) | Cached contacts (ms) |
|---|---:|---:|---:|---:|
| settled | 0.0181 | 0.0200 | 0.3176 | 0.2858 |
| falling | 0.0206 | 0.0225 | 0.3129 | 0.2808 |
| shear | 0.0419 | 0.0441 | 0.3641 | 0.3247 |
| churn | 0.0180 | 0.0198 | 0.3151 | 0.2831 |

Raw round CSVs, machine metadata, compiler configuration and an aggregate CSV
are in `benchmark-results/contact-cache-inplace/` (ignored generated results).
Earlier out-of-place prototypes are in `benchmark-results/contact-cache/`;
they are not the final layout measured above. CPU frequency and temperature
were not captured; desktop scheduling noise is visible between rounds.

