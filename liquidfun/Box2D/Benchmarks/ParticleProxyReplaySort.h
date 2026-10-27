// Historical compact-key replay algorithms (zlib license, see Box2D/License.txt).
// Not used by the physics engine; replay traces have tags but no positions.
#ifndef B2_PARTICLE_PROXY_REPLAY_SORT_H
#define B2_PARTICLE_PROXY_REPLAY_SORT_H
#include <Box2D/Particle/b2ParticleProxySort.h>

enum b2ParticleProxySortMode
{
	b2_referenceProxySort,
	b2_pairMergeProxySort,
	b2_twoStreamProxySort
};

class b2ParticleProxyReplaySorter
{
public:
	enum { rowShift = 20 };
	explicit b2ParticleProxyReplaySorter(b2BlockAllocator& allocator) :
		m_updated(allocator), m_streams(allocator), m_merge(allocator) {}

	b2ParticleProxyKey* Prepare(int32 count, b2ParticleSystemProfile& profile,
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
			(uint64)(m_updated.GetCapacity() + m_streams.GetCapacity() + m_merge.GetCapacity()) * sizeof(b2ParticleProxyKey));
		return m_updated.Data();
	}

	/// updated must already contain new tags in the old proxy-slot order.
	/// Only [0, sortedPrefix) has initialized old tags. The tail is newborn.
	void Sort(b2ParticleProxyKey* output, int32 count, int32 sortedPrefix, bool valid,
		b2ParticleSystemProfile& profile, b2ParticleProxySortMode mode = b2_twoStreamProxySort)
	{
		B2_NOT_USED(profile);
		B2_PARTICLE_TIMER(orderTimer, profile.orderMs);
		if (count == 0) return;
		b2Assert(mode == b2_pairMergeProxySort || mode == b2_twoStreamProxySort);
		if (mode == b2_twoStreamProxySort)
			SortStreams(output, count, sortedPrefix, valid, profile, true);
		else
			SortStreams(output, count, sortedPrefix, valid, profile, false);
	}

private:
	// Reuse the consumed updated prefix for overflow: writes never overtake
	// unread input, including newborns. Read history only before emission.
	int32 Classify(const b2ParticleProxyKey* history,
		int32 count, int32 prefix, bool valid, int32 sizes[3],
		b2ParticleSystemProfile& profile, bool moversToOverflow)
	{
		B2_NOT_USED(profile);
		int32 newbornCount = prefix >= 0 && prefix <= count ? count - prefix : count;
		B2_NOT_USED(newbornCount);
		if (!valid || prefix < 0 || prefix > count) prefix = 0;
		b2ParticleProxyKey* updated = m_updated.Data();
		b2ParticleProxyKey* streams = m_streams.Data();
		int32 dumped = 0;
		for (int32 i = 0; i < prefix; ++i)
		{
			b2ParticleProxyKey item = updated[i];
			int delta = (int)(item.tag >> rowShift) - (int)(history[i].tag >> rowShift);
			B2_PARTICLE_STAT(profile.maxRowDisplacement = b2Max(profile.maxRowDisplacement, (uint32)b2Abs(delta)));
			if (moversToOverflow ? delta != 0 : (delta < -1 || delta > 1))
			{ updated[dumped++] = item; continue; }
			int direction = moversToOverflow ? 0 : delta + 1;
			b2ParticleProxyKey* row = streams + direction * count;
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
			profile.south += moversToOverflow ? 0 : sizes[0];
			profile.residents += moversToOverflow ? sizes[0] : sizes[1]; profile.north += sizes[2]);
		std::sort(updated, updated + dumped);
		B2_PARTICLE_STAT(++profile.adaptiveUpdates);
		return dumped;
	}

	// One resident stream, or three resident/directional streams. Reuse the
	// consumed prefix of updated as the overflow stream: its write cursor
	// never passes the input cursor, including when newborns are appended.
	void SortStreams(b2ParticleProxyKey* output, int32 count, int32 prefix, bool valid,
		b2ParticleSystemProfile& profile, bool moversToOverflow)
	{
		b2ParticleProxyKey* updated = m_updated.Data();
		b2ParticleProxyKey* streams = m_streams.Data();
		int32 sizes[3] = {0, 0, 0};
		int32 dumped = Classify(output, count, prefix, valid, sizes, profile, moversToOverflow);
		if (moversToOverflow)
		{
			MergeTwo(streams, sizes[0], updated, dumped, output); return;
		}
		const b2ParticleProxyKey* heads[4] = {streams, streams + count, streams + 2 * count, updated};
		const b2ParticleProxyKey* ends[4] = {heads[0] + sizes[0], heads[1] + sizes[1], heads[2] + sizes[2], updated + dumped};
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

	static void MergeTwo(const b2ParticleProxyKey* a, int32 na, const b2ParticleProxyKey* b, int32 nb, b2ParticleProxyKey* out)
	{
		while (na && nb)
		{
			if (a->tag <= b->tag) { *out++ = *a++; --na; }
			else { *out++ = *b++; --nb; }
		}
		if (na) memcpy(out, a, na * sizeof(b2ParticleProxyKey));
		else if (nb) memcpy(out, b, nb * sizeof(b2ParticleProxyKey));
	}
	b2GrowableBuffer<b2ParticleProxyKey> m_updated, m_streams, m_merge;
};
#endif
