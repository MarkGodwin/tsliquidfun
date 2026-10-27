// Particle proxy sorting for this LiquidFun fork (zlib license).
#ifndef B2_PARTICLE_PROXY_SORT_H
#define B2_PARTICLE_PROXY_SORT_H

#include <Box2D/Common/b2GrowableBuffer.h>
#include <Box2D/Common/b2Math.h>
#include <Box2D/Common/b2Timer.h>
#include <string.h>

/// Compact records used by classification and overflow sorting.
struct b2ParticleProxyKey
{
	int32 index;
	uint32 tag;
	bool operator<(const b2ParticleProxyKey& other) const { return tag < other.tag; }
};

/// Spatially ordered contact snapshot, emitted only after classification.
struct b2ParticleProxy
{
	int32 index;
	uint32 tag;
	b2Vec2 position;
	enum
	{
		xTruncBits = 12,
		yTruncBits = 12,
		tagBits = 8u * sizeof(uint32),
		yOffset = 1u << (yTruncBits - 1u),
		yShift = tagBits - yTruncBits,
		xShift = tagBits - yTruncBits - xTruncBits,
		xScale = 1u << xShift,
		xOffset = xScale * (1u << (xTruncBits - 1u)),
		rowShift = yShift
	};
	static uint32 ComputeTag(float32 x, float32 y)
	{
		return ((uint32)(y + yOffset) << yShift) + (uint32)(xScale * x + xOffset);
	}
	friend inline bool operator<(uint32 a, const b2ParticleProxy& b) { return a < b.tag; }
	friend inline bool operator<(const b2ParticleProxy& a, uint32 b) { return a.tag < b; }
};

/// Cumulative particle diagnostics. Timings are milliseconds; total timings
/// include their component timings. Proxy-only profiling fills only proxyMs;
/// all fields are zero when both profiling options are off.
struct b2ParticleSystemProfile
{
	float64 solveMs, proxyMs, classifyMs, orderMs, referenceSortMs;
	float64 contactsMs, filterListenerMs, bodyContactsMs, collisionMs;
	uint64 updates, substeps, particles, north, south, residents, newborn;
	uint64 adaptiveUpdates;
	uint64 candidates, contacts, bodyContacts, growths, scratchBytes;
	uint64 overflowParticles, localSwaps;
	uint32 maxRowDisplacement;
	b2ParticleSystemProfile() { Reset(); }
	void Reset() { memset(this, 0, sizeof(*this)); }
};

#if defined(BOX2D_PROFILE_PARTICLES) || defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
class b2ParticleProfileScope
{
public:
	explicit b2ParticleProfileScope(float64& total) : m_total(total) {}
	~b2ParticleProfileScope() { m_total += m_timer.GetMilliseconds(); }
private:
	b2Timer m_timer;
	float64& m_total;
};
#define B2_PARTICLE_PROXY_TIMER(name, field) b2ParticleProfileScope name(field)
#else
#define B2_PARTICLE_PROXY_TIMER(name, field) do {} while (0)
#endif
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
#define B2_PARTICLE_STAT(statement) do { statement; } while (0)
#define B2_PARTICLE_TIMER(name, field) b2ParticleProfileScope name(field)
#else
#define B2_PARTICLE_STAT(statement) do {} while (0)
#define B2_PARTICLE_TIMER(name, field) do {} while (0)
#endif

/// Concrete two-stream sorter. Reads each old proxy once to compute its new
/// key and route it directly to residents or overflow. No updated-key pass.
class b2ParticleProxySorter
{
public:
	explicit b2ParticleProxySorter(b2BlockAllocator& allocator);
	void Sort(b2ParticleProxy* proxies, int32 count, int32 sortedPrefix, bool valid,
		const b2Vec2* positions, float32 inverseDiameter, b2ParticleSystemProfile& profile);
private:
	void Prepare(int32 count, b2ParticleSystemProfile& profile);
	void Classify(const b2ParticleProxy* proxies, int32 count, int32 prefix, bool valid,
		const b2Vec2* positions, float32 inverseDiameter, b2ParticleSystemProfile& profile);
	void Merge(b2ParticleProxy* output, const b2Vec2* positions) const;
	b2GrowableBuffer<b2ParticleProxyKey> m_residents, m_overflow;
};
#endif
