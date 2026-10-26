// Additional particle sorting implementation for this LiquidFun fork.
// Distributed under the zlib license in Box2D/License.txt.
#ifndef B2_PARTICLE_PROXY_SORT_H
#define B2_PARTICLE_PROXY_SORT_H

#include <Box2D/Common/b2GrowableBuffer.h>
#include <Box2D/Common/b2Math.h>
#include <Box2D/Common/b2Timer.h>
#include <string.h>

enum b2ParticleProxySortMode
{
	b2_referenceProxySort,
	b2_pairMergeProxySort,
	b2_twoStreamProxySort
};

/// Cumulative particle diagnostics. Timings are milliseconds; total timings
/// include their component timings. Proxy-only profiling fills only proxyMs;
/// all fields are zero when both profiling options are off.
struct b2ParticleSystemProfile
{
	float64 solveMs, proxyMs, tagMs, orderMs, referenceSortMs;
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

/// Internal sorter, templated so tests/replay can use the exact production
/// algorithm without exposing particle-system proxies. T has index and tag.
template <typename T> class b2ParticleProxySorter
{
public:
	enum { rowShift = 20 };
	explicit b2ParticleProxySorter(b2BlockAllocator& allocator) :
		m_updated(allocator), m_streams(allocator), m_merge(allocator) {}

	T* Prepare(int32 count, b2ParticleSystemProfile& profile,
		b2ParticleProxySortMode mode = b2_twoStreamProxySort)
	{
		B2_NOT_USED(profile);
		bool grew = false;
		if (count > m_updated.GetCapacity())
		{
			int32 capacity = b2Max(count, b2Max(32, m_updated.GetCapacity() * 2));
			m_updated.Reserve(capacity);
			grew = true;
		}
		int streamCount = mode == b2_pairMergeProxySort ? 3 : 1;
		int32 streamCapacity = m_updated.GetCapacity() * streamCount;
		if (streamCapacity > m_streams.GetCapacity())
		{
			m_streams.Reserve(streamCapacity);
			grew = true;
		}
		B2_NOT_USED(grew);
		if (mode == b2_pairMergeProxySort && m_merge.GetCapacity() < m_updated.GetCapacity())
		{
			m_merge.Reserve(m_updated.GetCapacity()); grew = true;
		}
		B2_PARTICLE_STAT(if (grew) ++profile.growths);
		m_updated.SetCount(count);
		m_streams.SetCount(count * streamCount);
		B2_PARTICLE_STAT(profile.scratchBytes =
			(uint64)(m_updated.GetCapacity() + m_streams.GetCapacity() + m_merge.GetCapacity()) * sizeof(T));
		return m_updated.Data();
	}

	/// updated must already contain new tags in the old proxy-slot order.
	/// Only [0, sortedPrefix) has initialized old tags. The tail is newborn.
	void Sort(T* output, int32 count, int32 sortedPrefix, bool valid,
		b2ParticleSystemProfile& profile, b2ParticleProxySortMode mode = b2_twoStreamProxySort)
	{
		B2_NOT_USED(profile);
		B2_PARTICLE_TIMER(orderTimer, profile.orderMs);
		if (count == 0) return;
		b2Assert(mode == b2_pairMergeProxySort || mode == b2_twoStreamProxySort);
		if (mode == b2_twoStreamProxySort)
			SortStreams<true>(output, count, sortedPrefix, valid, profile);
		else
			SortStreams<false>(output, count, sortedPrefix, valid, profile);
	}

private:
	// One resident stream, or three resident/directional streams. Reuse the
	// consumed prefix of updated as the overflow stream: its write cursor
	// never passes the input cursor, including when newborns are appended.
	template <bool MoversToOverflow> void SortStreams(T* output, int32 count, int32 prefix, bool valid,
		b2ParticleSystemProfile& profile)
	{
		B2_NOT_USED(profile);
		int32 newbornCount = prefix >= 0 && prefix <= count ? count - prefix : count;
		B2_NOT_USED(newbornCount);
		if (!valid || prefix < 0 || prefix > count) prefix = 0;
		T* updated = m_updated.Data();
		T* streams = m_streams.Data();
		int32 sizes[3] = {0, 0, 0};
		int32 dumped = 0;
		for (int32 i = 0; i < prefix; ++i)
		{
			T item = updated[i];
			int delta = (int)(item.tag >> rowShift) - (int)(output[i].tag >> rowShift);
			B2_PARTICLE_STAT(profile.maxRowDisplacement = b2Max(profile.maxRowDisplacement, (uint32)b2Abs(delta)));
			if (MoversToOverflow ? delta != 0 : (delta < -1 || delta > 1))
			{ updated[dumped++] = item; continue; }
			int direction = MoversToOverflow ? 0 : delta + 1;
			T* row = streams + direction * count;
			int32 end = sizes[direction];
			if (!end || row[end - 1].tag <= item.tag)
				row[sizes[direction]++] = item;
			else if (end == 1 || row[end - 2].tag <= item.tag)
			{
				// One adjacent swap repairs isolated inversions without a loop.
				row[end] = row[end - 1]; row[end - 1] = item;
				++sizes[direction];
				B2_PARTICLE_STAT(++profile.localSwaps);
			}
			else updated[dumped++] = item;
		}
		for (int32 i = prefix; i < count; ++i) updated[dumped++] = updated[i];
		B2_PARTICLE_STAT(profile.overflowParticles += dumped; profile.newborn += newbornCount;
			profile.south += MoversToOverflow ? 0 : sizes[0];
			profile.residents += MoversToOverflow ? sizes[0] : sizes[1]; profile.north += sizes[2]);
		std::sort(updated, updated + dumped);
		B2_PARTICLE_STAT(++profile.adaptiveUpdates);
		if (MoversToOverflow)
		{
			MergeTwo(streams, sizes[0], updated, dumped, output); return;
		}
		const T* heads[4] = {streams, streams + count, streams + 2 * count, updated};
		const T* ends[4] = {heads[0] + sizes[0], heads[1] + sizes[1], heads[2] + sizes[2], updated + dumped};
		// Materialize the two shortest incoming streams, then the third;
		// merge residents last. Output is safe temporary storage now that
		// every old tag has been consumed by classification.
		int order[3] = {0, 2, 3};
		for (int i = 1; i < 3; ++i)
			for (int j = i; j > 0 && ends[order[j]] - heads[order[j]] < ends[order[j - 1]] - heads[order[j - 1]]; --j)
				std::swap(order[j], order[j - 1]);
		int a = order[0], b = order[1], c = order[2];
		int32 na = (int32)(ends[a] - heads[a]), nb = (int32)(ends[b] - heads[b]), nc = (int32)(ends[c] - heads[c]);
		MergeTwo(heads[a], na, heads[b], nb, output);
		MergeTwo(output, na + nb, heads[c], nc, m_merge.Data());
		MergeTwo(heads[1], sizes[1], m_merge.Data(), na + nb + nc, output);
	}

	static void MergeTwo(const T* a, int32 na, const T* b, int32 nb, T* out)
	{
		while (na && nb)
		{
			if (a->tag <= b->tag) { *out++ = *a++; --na; }
			else { *out++ = *b++; --nb; }
		}
		if (na) memcpy(out, a, na * sizeof(T));
		else if (nb) memcpy(out, b, nb * sizeof(T));
	}
	b2GrowableBuffer<T> m_updated, m_streams, m_merge;
};
#endif
