# Particle physics optimisation history

This record describes the particle-physics changes explored in this fork during
October 2026: the reasoning behind each experiment, what the measurements showed,
and which changes remain. Instructions for the current measurement tools are in
the [benchmark guide](../liquidfun/Box2D/Benchmarks/README.md).

## Outcome

| Change | Decision | Evidence |
|---|---|---|
| Reuse the previous spatial ordering and sort only overflow | Retained | Reduced proxy work; the whole-step gain was much smaller. |
| Cache particle positions in proxies during final merge | Retained | Historical whole-step reductions of 1.6-4.4%, median 3.8%. |
| Use one concrete sorter and compute tags during classification | Retained | Simpler implementation and one less key-buffer pass; no demonstrated whole-step speedup. |
| Share scratch between ordered residents and unordered overflow | Retained | Halved key scratch from 16 to 8 bytes per capacity slot; no isolated timing gain established. |
| Gradually exchange particles into spatial order | Considered, not implemented | Small batches would repeatedly pay index-remapping costs. |
| Reorder particle storage on every substep | Rejected and reverted | Total physics time increased by approximately 5-15%. |
| Sort contacts by particle index using `std::sort` | Rejected and reverted | Total physics time increased to approximately 2.3-2.5 times the spatial-order time. |

The retained implementation is in
[b2ParticleProxySort.cpp](../liquidfun/Box2D/Box2D/Particle/b2ParticleProxySort.cpp)
and [b2ParticleSystem.cpp](../liquidfun/Box2D/Box2D/Particle/b2ParticleSystem.cpp).

These results are separate comparisons, not additive gains. The main lesson was
that improving proxy preparation affects only a small part of total physics time.
Attempts to improve locality in the remaining solver introduced more work than
they saved in the measured desktop scenes.

## How to read the results

The measurements used an optimised x64 Windows implementation with MSVC
19.51.36260.0. The early sorting trials recorded an AMD family 25, model 97,
stepping 2 processor. Whole-step comparisons disabled instrumentation and shadow
validation; separate instrumented runs were used to attribute time to stages.

The scene names describe repeatable workloads:

- **Settled:** particles settling under gravity in a container.
- **Falling:** repeated downward motion and disturbances.
- **Shear:** opposite horizontal velocities above and below a height threshold.
- **Separated:** particles in distinct groups and containers.
- **Churn:** repeated particle destruction and creation.
- **Teleport:** periodic position jumps that disrupt ordering.

A particle iteration is a solver substep. A world step with two particle
iterations performs two proxy/contact updates. Whole-step timings include all
substeps, contact discovery, body interactions and the remaining physics solver;
they exclude rendering and scene steering performed outside the world step.

Repeated comparisons alternated execution order. Tables use medians of per-run
medians unless stated otherwise. Positive *time reduction* means faster; negative
means slower. *Slowdown* columns instead use positive values for a regression.
Stage medians need not add up to the median total.

Desktop scheduling and processor power state were not fully controlled, and
frequency and temperature were not recorded. Small differences should not be
treated as established improvements. No Pi Zero W measurements were made, so
none of these results establishes a target-device speedup or particle limit.

## 1. Exploiting temporal coherence in proxy sorting

A proxy associates a particle index with a spatial tag. Contact discovery walks
proxies in tag order, while particle attributes remain in their own buffers.
Most particles move only a short distance between substeps, so the previous
proxy order is useful information that a full comparison sort does not exploit
explicitly.

### Directional streams and fallback

The first adaptive approach classified particles by movement between spatial
rows, preserving residents and separating directional movers. It repaired or
sorted the resulting streams and merged them. Large disturbances could trigger
a full-sort fallback. Correctness also required tracking which prefix had valid
history: newly created particles could not be classified using uninitialised
previous tags.

This reduced sort-only work, but the bookkeeping and merging limited the benefit
to complete physics time. Representative early results were:

| Scene | Particles | Sort-only time reduction | Whole-step time reduction |
|---|---:|---:|---:|
| Settled | 3000 | 4.2% | 1.4% |
| Settled | 5000 | 17.0% | 4.6% |
| Shear | 3000 | 18.6% | 2.1% |
| Shear | 5000 | 23.5% | 0.5% |
| Churn | 3000 | 6.7% | 2.0% |
| Churn | 5000 | 18.0% | 1.3% |
| Teleport | 3000 | 10.3% | -0.1% |
| Teleport | 5000 | 22.5% | 2.9% |

These trials used 300 warmup steps, 600 measured steps, one particle iteration
and three alternating repetitions. Falling and separated scenes also included
small regressions, so the first adaptive version was not a uniform improvement.

### Insertion versus bounded repair and overflow

A follow-up tried inserting particles into order during classification. Another
approach allowed one adjacent exchange to repair an isolated inversion and sent
harder cases to overflow instead of extending an insertion loop.

At 5000 particles, reductions in combined tag-update and ordering time were:

| Scene | Original adaptive | Insertion during classification | One-swap repair plus overflow |
|---|---:|---:|---:|
| Settled | 14.1% | 17.1% | 38.9% |
| Shear | 21.8% | 21.7% | 29.3% |
| Churn | 16.7% | 19.9% | 38.0% |

The small cases exposed the overhead particularly clearly. At 1000 settled
particles, the original adaptive approach took 87.5% more combined proxy time
than the reference, insertion took 81.2% more, and bounded repair plus overflow
took 38.3% less. Insertion alone was not a convincing solution.

These follow-ups used 300 warmup steps, 600 measured steps, one particle iteration
and three alternating repetitions. Each candidate had its own paired reference;
small differences between columns are therefore uncertain. Identical-input
sort-only comparisons also favoured overflow. At 5000 particles, representative
reference/overflow times were 0.0585/0.0337 ms settled, 0.0699/0.0471 ms shear and
0.0587/0.0351 ms churn. The early overflow implementation used more scratch
storage, so this was initially a time-versus-memory trade-off.

### The retained two-stream approach

The subsequent simplification kept one ordered resident stream and one unordered
overflow stream. Particles that changed spatial row, newborns and inversions
that could not be repaired with one exchange went to overflow. Sorting that
stream and merging it with residents avoided the extra directional merges.

A pairwise directional-merge alternative was also explored. Historical
`reference`, `pair` and `two-stream` algorithms remain available only in the
measurement helper; the engine has one concrete two-stream sorter.

The retained implementation preserves surviving history through deletion and
invalidates it when necessary, such as after a radius change. Invalid history
safely sends every particle through overflow sorting. The improvements here
were useful, but did not make proxy sorting the dominant physics cost.

## 2. Caching positions in proxies

The next idea targeted contact discovery. A proxy containing only index and tag
requires an indirect position lookup for both particles in each candidate pair.
Adding position to the proxy makes the contact traversal's position reads
contiguous with its proxy reads.

Copying the additional position through the comparison sort would waste work.
The chosen design sorts 8-byte index/tag keys and gathers positions only while
emitting the final 16-byte proxies. The gather still performs one indexed read
per particle, but subsequent contact checks reuse the cached position.

### Isolated stage experiment

An identical-input comparison of the combined proxy/contact stage showed
reductions of 4.5-10.6% across 3000- and 5000-particle cases. At 5000 particles,
the reductions were 8.0% settled, 8.4% falling, 8.7% shear and 8.6% churn.

Those measurements followed 300 warmup world steps, using 64 simulation
snapshots, 30 repetitions and 11 alternating rounds. The additional gather
slightly increased sort/merge cost, but contact discovery saved more than the
gather cost in each measured scene. These were stage measurements, not claims
about the complete physics step.

### Whole-engine comparison

The engine comparison used water particles, 300 warmup steps, 900 measured
steps and three alternating repetitions per case. The following entries are
reductions in complete physics-step time:

| Scene | 3,000 / 1 iteration | 3,000 / 2 iterations | 5,000 / 1 iteration | 5,000 / 2 iterations |
|---|---:|---:|---:|---:|
| settled | 4.4% | 1.6% | 4.0% | 3.6% |
| falling | 3.1% | 3.2% | 4.3% | 3.8% |
| shear | 4.1% | 3.9% | 4.0% | 4.0% |
| separated | 2.8% | 2.2% | 3.8% | 2.7% |
| churn | 3.6% | 3.5% | 3.8% | 3.8% |
| teleport | 3.8% | 3.5% | 4.0% | 3.7% |

All 24 combinations improved, with a median reduction of 3.8%. For example,
settled with 5000 particles and one iteration changed from 0.7664 ms to 0.7357 ms.
This modest whole-step improvement was the reason to retain cached positions.

One early implementation shared too much code between the indexed and cached
contact paths. It changed compiler inlining and exaggerated the apparent gain.
That comparison was discarded; the figures above preserved the original indexed
contact implementation. This was a useful reminder that an experiment's control
path must not be accidentally weakened by the experimental abstraction.

### Removing layout selection from bounds enumeration

Temporary comparison code supported both compact and cached proxy layouts. A
layout branch in the bounds enumerator was a concern because it ran for every
candidate particle. Separate concrete enumerators avoided that branch without
introducing a virtual call. Once cached positions were selected, the unused
layout and runtime selector were removed entirely.

A later compact-versus-cached recheck at 5000 particles and one iteration showed
whole-step reductions of 3.4-4.3% across settled, shear, separated and churn.
It supported retaining the cache, but did not isolate the effect of removing
the enumerator branch from other run-to-run differences.

### Correctness requirements

Cached positions must be refreshed on **every contact update**, including every
particle substep, unchanged spatial tags and the remaining tail of a merge.
Refreshing only once per world step is insufficient when there are multiple
particle iterations. New proxies also need valid positions immediately.

The snapshot precedes integration. AABB and ray-query geometry therefore still
uses the authoritative position buffer when current positions are required.
The retained bounds enumerator uses a single concrete 16-byte proxy layout.

## 3. Fusing tag computation with classification

Previously, a separate pass computed updated index/tag keys. Classification then
read those keys together with the old proxies to decide where each key belonged.
The concrete sorter now computes a key directly from each old proxy's index and
current position, compares the old and new rows, and immediately routes the key
to residents or overflow. Tag encoding and arithmetic were preserved.

This removed the updated-key prefill and its subsequent read: 16 bytes of
logical key-buffer traffic per particle. It also removed the template machinery
needed by the earlier variants. Newborns are handled in a separate adjacent
range, so they never require a read of an invalid previous tag.

Five alternating comparisons per case used 300 warmup steps, 900 measured steps
and two particle iterations. Whole-step measurements disabled instrumentation;
a separate instrumented comparison measured the proxy stage.

| Scene | Particles | Whole-step reduction | Proxy-stage reduction |
|---|---:|---:|---:|
| settled | 3000 | -0.8% | 6.2% |
| settled | 5000 | 0.1% | 3.3% |
| shear | 3000 | -0.2% | -11.2% |
| shear | 5000 | 0.0% | -5.4% |
| churn | 3000 | -0.5% | 2.9% |
| churn | 5000 | -0.1% | 4.1% |
| teleport | 3000 | 0.0% | 1.0% |
| teleport | 5000 | 0.1% | -0.3% |

Whole-step times were effectively unchanged, while proxy-stage results were
mixed and shear became slower. The change was retained for simpler code and
less intermediate memory traffic, not as a demonstrated timing improvement.
All 160 measured executions had identical particle-state hashes to their
paired counterpart, and instrumented classification/contact counts agreed.

## 4. Sharing resident and overflow scratch

The resident and overflow streams originally each reserved a full key buffer.
They now occupy opposite ends of one buffer: ordered residents grow forwards,
unordered overflow grows backwards, and the ranges meet after classification.
Only the overflow suffix is sorted, then both ranges are merged into the proxy
output. No additional compaction pass is required.

This halves key scratch from 16 to **8 bytes per capacity slot**, with geometric
capacity growth and reuse after warmup. There was no isolated measurement
establishing an additional timing improvement from this change.

Backward insertion reverses overflow's input order. Since equal-tag sorting is
unstable, ties can emerge in a different order from earlier versions. The tests
therefore check sorted membership, refreshed positions and exact repeatability
for identical inputs with fresh and reused scratch. Repeated six-scene runs also
matched their same-version particle-state hashes. Bit-identical tie order across
versions or platforms is not a requirement established by these experiments.

## 5. Reordering particle storage for solver locality

Caching proxy positions improves discovery, but the solver still accesses
velocities, pressure and other particle attributes through contact indices.
Putting spatial neighbours next to one another in those buffers might improve
reuse across the many contact-based solver passes.

### Gradual exchanges: considered but not implemented

One proposal compared indices of adjacent spatial proxies and exchanged inverted
particle slots, alternating odd and even pairs over successive steps. With a
fixed spatial order, this would gradually make storage follow that order.

The cost is not just the two particles' attributes. Persistent pairs, triads,
handles, lifetimes and contact history also retain indices. There is no reverse
particle-to-triad lookup, so a small batch of exchanges would still need a broad
remapping pass, or a new reverse-reference structure. This made incremental
sorting unattractive; it was not implemented or measured.

### Per-substep bulk reordering: implemented and rejected

The tested alternative assigned each emitted proxy the next particle slot in its
existing group range during the final merge. It gathered positions and built an
old-to-new index map without another comparison sort. Other persistent particle
attributes were then gathered through reusable staging and copied back.

Each group kept its contiguous range; each contiguous ungrouped run was handled
separately. Buffer addresses, including user-supplied addresses, were preserved.
Handles, lifetime ordering, old contacts and stuck-particle lists were remapped.
Spring/barrier pairs and elastic triads were remapped by **vertex slot**, keeping
reference geometry attached to the same physical particles. Their buffers were
then sorted by the new index keys. No constraints were regenerated by the reorder.
Temporary accumulation arrays were recomputed by the solver.

This needed an additional 20 bytes of scratch per capacity slot: three integer
arrays and one position-sized staging array. Reordering ran once per particle
substep. Group-construction, join and split operations did not trigger it.

Three alternating comparisons per case used 200 warmup steps, 600 measured steps
and two particle iterations. All copying, remapping and constraint sorting was
included in whole-step time:

| Scene | Particles | Off (ms) | On (ms) | Time reduction |
|---|---:|---:|---:|---:|
| settled | 3000 | 0.6508 | 0.7138 | -9.7% |
| falling | 3000 | 0.6616 | 0.7049 | -6.5% |
| shear | 3000 | 0.7384 | 0.7873 | -6.6% |
| separated | 3000 | 0.4860 | 0.5613 | -15.5% |
| churn | 3000 | 0.6629 | 0.7081 | -6.8% |
| teleport | 3000 | 0.6735 | 0.7140 | -6.0% |
| settled | 5000 | 1.2347 | 1.3104 | -6.1% |
| falling | 5000 | 1.1791 | 1.2387 | -5.1% |
| shear | 5000 | 1.3047 | 1.3866 | -6.3% |
| separated | 5000 | 1.0745 | 1.1500 | -7.0% |
| churn | 5000 | 1.2281 | 1.2989 | -5.8% |
| teleport | 5000 | 1.2072 | 1.2792 | -6.0% |

The proxy stage gained about 0.08-0.09 ms per frame at 5000 particles, of which
preparation, copying and remapping accounted for about 0.07-0.08 ms. Contact
discovery and the remaining solver showed little consistent improvement.

Steering and final-state comparisons used stable particle identities, so teleport
and churn affected the same particles despite index changes. Every one of the
36 paired comparisons had bit-identical identity-ordered position/velocity/flag
hashes. Per-frame contacts and candidate counts also agreed. The failure was
performance, not a failure to preserve particle identity or triad geometry.

The experiment was reverted. It does not justify reordering every substep on the
measured desktop. A design that exchanges owned destination buffers instead of
copying attributes back could have different costs; that design was not tested.
The benchmark particles also carried identity in user data, so moving that
optional attribute was included in the measured cost.

## 6. Sorting contacts into particle-index order

A cheaper locality experiment left particle storage untouched and sorted the
contacts lexicographically by `(indexA, indexB)` using an in-place `std::sort`.
A's accesses would then follow particle-buffer order, with B as a deterministic
tie-breaker. No particle or constraint index remapping was needed.

Spatial contact discovery already emits each A's contacts together. The proposed
benefit was therefore locality **between successive A particles**, rather than
new reuse within one A's contacts. B accesses would remain indirect, and sorting
could disturb their existing spatial locality.

### Protecting depth propagation and checking order sensitivity

`ComputeDepth` propagates surface distances through contacts using in-place
relaxation and a limit of approximately `sqrt(particleCount)` sweeps. Contact
order affects propagation speed, and unreached particles can finish with zero
depth. Sorting was deliberately placed after `ComputeWeight` and `ComputeDepth`
inside the solver, preserving their spatial traversal.

Damping and viscosity also update velocities in place. Changing contact order
therefore changes physical evolution, beyond just floating-point summation
order. The acceptance criterion was repeatability within each engine mode,
not identical trajectories between spatial and index order. Reactive connection
updates and the remaining solver consumed the sorted contacts; body contacts
kept their existing order.

### Results

Three alternating comparisons per case used 200 warmup steps, 600 measured steps
and two particle iterations. Sorting was included in complete physics time:

| Scene | Particles | Spatial (ms) | Index (ms) | Slowdown |
|---|---:|---:|---:|---:|
| settled | 3000 | 0.6579 | 1.6314 | 148.0% |
| falling | 3000 | 0.6750 | 1.5903 | 135.6% |
| shear | 3000 | 0.7379 | 1.7030 | 130.8% |
| separated | 3000 | 0.5630 | 1.3905 | 147.0% |
| churn | 3000 | 0.6535 | 1.5565 | 138.2% |
| teleport | 3000 | 0.6715 | 1.5661 | 133.2% |
| settled | 5000 | 1.2488 | 2.9520 | 136.4% |
| falling | 5000 | 1.1919 | 2.8887 | 142.4% |
| shear | 5000 | 1.3140 | 3.0896 | 135.1% |
| separated | 5000 | 1.0820 | 2.5286 | 133.7% |
| churn | 5000 | 1.2327 | 2.9548 | 139.7% |
| teleport | 5000 | 1.2083 | 2.8447 | 135.4% |

All three repetitions of each mode matched their final-state hashes. Across
modes, trajectories differed as expected. The complete comparison-sort approach
was approximately 2.3-2.5 times slower than leaving contacts in spatial order.

Separate instrumented comparisons used 5000 particles and two alternating pairs
per scene. These are means of per-run means, in milliseconds per physics frame.
Remaining solver time excludes proxy/contact generation, collision, listeners,
body contacts and the separately measured sort:

| Scene | Spatial solver | Index solver | Contact sort |
|---|---:|---:|---:|
| settled | 0.6839 | 0.7334 | 2.0965 |
| shear | 0.6875 | 0.6532 | 1.8792 |
| churn | 0.6803 | 0.6537 | 1.7425 |

Shear and churn showed small downstream solver gains, while settled did not.
Sorting cost 1.7-2.1 ms per frame and overwhelmed those gains. Index-mode contact
counts were also about 0.3-0.6% higher because physical trajectories had changed.

The code and temporary runtime switch were reverted. The result rejects this
complete `std::sort` approach on the measured desktop; it does not prove that
index-oriented traversal is always unhelpful. A linear-time distribution method
was not implemented or measured.

## Correctness findings and validation

The retained cached-proxy implementation passed 258 tests across 14 executables
in both Release and Debug after the rejected experiments were removed. Coverage
included randomized sorter membership and repeatability, invalid history,
newborns, lifetime/deletion handling, group join/split/snapshot operations,
all-pairs contact equivalence, current-position queries and barrier confinement.
No simulation baselines were changed.

The particle-reordering experiment passed 264 tests, including attribute and
handle identity, external buffers, exact constraint vertex/reference preservation,
listener continuity and elastic/spring evolution. The contact-order experiment
passed 263 tests, including unchanged weight/depth calculations, complete contact
record preservation, toggling, repeatability and reactive constraint checks.
Those experiment-only tests were removed with their implementations. Debug
checks included shadow proxy validation. JavaScript and iOS integration was not
validated with their native toolchains during these experiments.

Both rejected experiments exposed existing contact-listener lookup defects:

- `LightweightPair` compared both fields with a component-wise AND instead of a
  lexicographic comparison suitable for sorting and binary search.
- A `lower_bound` result was accepted without checking exact key equality.

Corrections were needed for experimental listener tests to pass, but were
reverted with the experiments. They remain separate correctness work, not part
of the retained optimisation. The storage-reordering experiment also exposed
stuck-particle indices that needed remapping during group rotation and zombie
compaction; those experimental corrections were likewise reverted.

## What the work suggests next

In the storage-reordering measurements at 5000 particles, the remaining solver
took approximately 0.57-0.68 ms per frame, contact discovery 0.35-0.51 ms and the
original proxy stage 0.025-0.053 ms. This explains why a substantial improvement
to sorting alone had only a modest effect on total physics time.

Further investigation should first identify which solver passes dominate and
whether their cost comes from arithmetic, repeated calculations or memory
access. Changing the equations is not the only possible route, but neither
locality experiment demonstrated an overall gain. Any future proposal needs to
include its own preparation cost and simulation-quality checks in the comparison.
