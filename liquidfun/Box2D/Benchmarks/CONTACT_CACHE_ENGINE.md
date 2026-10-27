# Cached-proxy selection and historical engine measurements

The engine now always caches positions in `Proxy`. Sorting operates on 8-byte
`b2ParticleProxyKey` records, computing tags during classification, and gathers
positions only while emitting the final merged
16-byte proxy array. This happens on every contact update / particle substep,
even when tags have not changed. See [README.md](README.md) for current build,
Testbed and benchmark commands.

The temporary indexed-position variant, spare buffer, conversion code, engine
mode API and Testbed mode controls have been removed. Bounds enumeration now
has one concrete proxy type. The existing scalar and compile-time NEON contact
implementations both obtain their position inputs from the merge snapshot.
AABB/ray geometry still reads current positions from the authoritative buffer.

The tables below are historical results from the temporary A/B engine, before
this cleanup. The old comparison commands and runtime modes are intentionally
unavailable in the current engine. Generated measurements remain on disk for
reference; they are not measurements of the final single-layout cleanup.

## Desktop whole-step measurements, 27 October 2026

MSVC 19.51.36260.0, x64 Release `/O2 /Ob2`, profiling and shadow validation off.
Each result aggregates three alternating baseline/candidate runs, each with
300 warmup steps followed by 900 measured complete world steps. Scenes use
water particles and static walls; separated also uses particle groups.

| Scene | 3,000 / 1 iteration | 3,000 / 2 iterations | 5,000 / 1 iteration | 5,000 / 2 iterations |
|---|---:|---:|---:|---:|
| settled | 4.4% | 1.6% | 4.0% | 3.6% |
| falling | 3.1% | 3.2% | 4.3% | 3.8% |
| shear | 4.1% | 3.9% | 4.0% | 4.0% |
| separated | 2.8% | 2.2% | 3.8% | 2.7% |
| churn | 3.6% | 3.5% | 3.8% | 3.8% |
| teleport | 3.8% | 3.5% | 4.0% | 3.7% |

Entries are reductions in median complete physics-step time; positive is faster.
All 24 combinations improved, ranging from 1.6% to 4.4%, with a median
reduction of 3.8%. For example, settled at 5,000 particles and one iteration
changed from 0.7664 ms to 0.7357 ms (4.0%). These gains are smaller than
the isolated tag/sort/contact-stage result, as expected.

Raw per-step CSVs, per-run metadata, compiler configuration and aggregated
`matrix.csv` / `comparisons.csv` are in
`benchmark-results/contact-cache-engine/world-final/` (ignored generated output).

For these historical measurements, the original indexed `AddContact` implementation was preserved. An early shared
wrapper changed compiler inlining and inflated the apparent benefit; those
partial runs in `benchmark-results/contact-cache-engine/world/` are discarded.
Only `world-final/` data belongs to the accepted historical comparison.

These results include sorting, contacts, body queries, collisions and the rest
of the world step. They exclude rendering, emission/setup outside the step and
mode-conversion cost (each timed run starts in its selected mode). CPU frequency
and temperature were not captured. Repeat on the Pi before choosing the final
layout; desktop results do not establish target-device gains.

## Typed-enumerator timing recheck

At 5,000 particles and one particle iteration, three alternating runs per
mode (300 warmup / 900 measured steps) produced these whole-step results:

| Scene | Compact (ms) | Cached (ms) | Cached time reduction |
|---|---:|---:|---:|
| settled | 0.7901 | 0.7565 | 4.3% |
| shear | 0.8968 | 0.8644 | 3.6% |
| separated | 0.7572 | 0.7318 | 3.4% |
| churn | 0.7870 | 0.7597 | 3.5% |

Raw data is in `benchmark-results/contact-cache-engine/typed-bounds/`.
That recheck retained a compact/cached comparison before the engine cleanup;
different run times prevent attributing any change from the earlier matrix
specifically to removing the layout branch.

## Current validation

The regression suite retains raw compact-key algorithm comparisons and checks
position emission against current particle data. Engine tests cover unchanged
tags, every particle substep, independent all-pairs contact equivalence,
lifetime/zombie/newborn handling, group snapshot/join/split, current-position
AABB/ray queries, early ray termination and barrier confinement. No simulation
baselines were changed.

Final cleanup validation: 258 tests across 14 executables pass in both Release
and Debug (with detailed profiling and shadow validation). The single-layout
Testbed was built and visually checked, including its paused timing overlay;
the final screenshot is `benchmark-results/cached-only/testbed.png`. A 24-case
world smoke matrix and pair/two-stream replay matrix passed. These smoke runs
are functional checks, not a new performance comparison.

## Fused classification follow-up

The production sorter is now concrete, with one resident key buffer and one
overflow key buffer. Its classification pass computes each new key directly
from the old proxy index and current position, reads the previous tag and
routes the key immediately. Newborns form an adjacent tail traversal that never
reads their old tags. Thus every proxy is visited once for classification,
without the previous full updated-key write/read pass. Final merge still
refreshes positions once per substep.

The historical key-only replay helper is confined to the benchmark directory;
it no longer determines the engine's types, buffers or algorithm selection.
The native source is registered in CMake, the JavaScript Makefile and both iOS
project source lists (Android enumerates the Particle directory automatically).

Detailed profiling reports `classifyMs` (`classify_ms` in CSV) for fused tag
calculation/classification, and `orderMs` for overflow sorting/final merge.
The previous tag-only timing is removed. State hashes in benchmark metadata
cover final particle positions, velocities and flags and are computed outside
timed world steps.

The before/after comparison used separate saved executables, five alternating
process pairs per case, 300 warmup steps and 900 measured steps with two
particle iterations. Whole-step measurements disabled profiling; separate
detailed builds measured combined proxy time. Positive values mean less time.

| Scene | Particles | Whole-step reduction | Proxy-stage reduction |
|---|---:|---:|---:|
| settled | 3000 | -0.8% | 6.2% |
| settled | 5000 | 0.1% | 3.3% |
| shear | 3000 | -0.2% | -11.2% |
| shear | 5000 | -0.0% | -5.4% |
| churn | 3000 | -0.5% | 2.9% |
| churn | 5000 | -0.1% | 4.1% |
| teleport | 3000 | 0.0% | 1.0% |
| teleport | 5000 | 0.1% | -0.3% |

On this MSVC desktop build there is no material whole-step improvement.
Proxy-stage results are mixed, with shear slower. The refactor removes one
full key-buffer write/read pass (16 bytes of logical traffic per particle)
and simplifies the production sorter, but that does not establish a speedup.
Target-Pi measurements are still needed.

All 160 before/after runs ended with identical particle-state hashes.
Per-frame classification/contact counts also matched on the profiled cases.
All 258 tests pass in Release and Debug with shadow validation. The random
sorter regression checks exact order against the prior two-stream algorithm,
including equal tags, invalid history, newborns, jumps and inversions.

Raw data, comparison CSVs and saved executables are in
`benchmark-results/fused-classify/` (ignored generated results).

The fused Testbed overlay was visually checked; evidence is saved as
`benchmark-results/fused-classify/testbed.png`. Historical trace replay also
passes. JavaScript and iOS source registrations were updated, but those
targets were not built because their toolchains are unavailable here.

## Shared scratch follow-up

Residents and overflow now share one key buffer. Residents grow forwards,
overflow grows backwards, and the ranges meet after classification. Only the
overflow suffix is sorted before merging into the proxy output. Scratch storage
is now 8 bytes per capacity slot rather than 16; growth remains geometric.

Overflow insertion reverses its input order. Equal-tag order may differ from
the previous sorter, so cross-version final-state hashes are no longer an
acceptance criterion. Randomized regression checks sorted tags, complete key
membership, cached positions and exact repeatability with cold and reused
scratch; equal-tag cases cover all-resident, mixed, all-newborn and invalid
history inputs. Same-build repeat runs of all six world scenes (1000 particles,
two iterations, 50 warmup and 150 measured steps) produced identical final
position/velocity/flag hashes. These are correctness checks, not performance
measurements. Cross-platform tie ordering is not guaranteed by std::sort.

The earlier old/new comparison executables are preserved. The shared-buffer
Testbed is built separately at benchmark-results/shared-proxy-scratch/Testbed.exe.
