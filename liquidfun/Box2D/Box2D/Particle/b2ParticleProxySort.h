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
	b2_adaptiveRowProxySort,
	b2_insertionProxySort,
	b2_overflowProxySort,
	b2_scanMergeProxySort,
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
	uint64 updates, substeps, particles, rows, north, south, residents, newborn;
	uint64 comparisons, shifts, adaptiveUpdates;
	uint64 invalidHistory, unorderedHistory, multiRow, repairBudget;
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
	enum { rowShift = 20, shiftsPerParticle = 8 };
	explicit b2ParticleProxySorter(b2BlockAllocator& allocator) :
		m_updated(allocator), m_streams(allocator), m_merge(allocator) {}

	T* Prepare(int32 count, b2ParticleSystemProfile& profile,
		b2ParticleProxySortMode mode = b2_adaptiveRowProxySort)
	{
		B2_NOT_USED(profile);
		bool grew = false;
		if (count > m_updated.GetCapacity())
		{
			int32 capacity = b2Max(count, b2Max(32, m_updated.GetCapacity() * 2));
			m_updated.Reserve(capacity);
			grew = true;
		}
		int streamCount = mode >= b2_overflowProxySort && mode != b2_twoStreamProxySort ? 3 : 1;
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
		b2ParticleSystemProfile& profile, b2ParticleProxySortMode mode = b2_adaptiveRowProxySort)
	{
		B2_NOT_USED(profile);
		B2_PARTICLE_TIMER(orderTimer, profile.orderMs);
		if (count == 0) return;
		if (mode >= b2_overflowProxySort)
		{
			if (mode == b2_twoStreamProxySort) SortOverflow<true>(output, count, sortedPrefix, valid, profile, mode);
			else SortOverflow<false>(output, count, sortedPrefix, valid, profile, mode);
			return;
		}
		T* updated = m_updated.Data();
		if (!valid || sortedPrefix < 0 || sortedPrefix > count)
		{
			B2_PARTICLE_STAT(++profile.invalidHistory);
			Fallback(output, count, profile);
			return;
		}
		int32 sizes[4] = {0, 0, 0, count - sortedPrefix};
		for (int32 i = 0; i < sortedPrefix; ++i)
		{
			if (i && output[i].tag < output[i - 1].tag)
			{
				B2_PARTICLE_STAT(++profile.unorderedHistory);
				Fallback(output, count, profile); return;
			}
			int32 delta = (int32)(updated[i].tag >> rowShift) -
				(int32)(output[i].tag >> rowShift);
			B2_PARTICLE_STAT(profile.maxRowDisplacement = b2Max(
				profile.maxRowDisplacement, (uint32)b2Abs(delta)));
			if (delta < -1 || delta > 1)
			{
				B2_PARTICLE_STAT(++profile.multiRow);
				Fallback(output, count, profile); return;
			}
			++sizes[delta + 1];
		}
		B2_PARTICLE_STAT(profile.south += sizes[0]; profile.residents += sizes[1];
			profile.north += sizes[2]; profile.newborn += sizes[3]);

		// Each direction is globally row-ordered because source rows were
		// ordered. Repair only the X order of each source-row subsequence.
		int32 ends[4], heads[4], write[4];
		int32 offset = 0;
		for (int k = 0; k < 4; ++k)
		{
			heads[k] = write[k] = offset;
			ends[k] = offset += sizes[k];
		}
		T* streams = m_streams.Data();
		uint64 budget = (uint64)shiftsPerParticle * count;
		for (int32 begin = 0; begin < sortedPrefix;)
		{
			int32 end = begin + 1;
			uint32 row = output[begin].tag >> rowShift;
			while (end < sortedPrefix && output[end].tag >> rowShift == row)
				++end;
			int32 starts[3] = {write[0], write[1], write[2]};
			B2_PARTICLE_STAT(++profile.rows);
			for (int32 i = begin; i < end; ++i)
			{
				int direction = (int)(updated[i].tag >> rowShift) - (int)row + 1;
				if (mode == b2_insertionProxySort)
				{
					if (!Insert(streams, starts[direction], write[direction], updated[i], budget, profile))
					{
						B2_PARTICLE_STAT(++profile.repairBudget);
						Fallback(output, count, profile); return;
					}
					++write[direction];
				}
				else streams[write[direction]++] = updated[i];
			}
			for (int k = 0; mode != b2_insertionProxySort && k < 3; ++k)
			{
				if (!Repair(streams, starts[k], write[k], budget, profile))
				{
					B2_PARTICLE_STAT(++profile.repairBudget);
					Fallback(output, count, profile); return;
				}
			}
			begin = end;
		}
		if (sizes[3])
		{
			memcpy(streams + heads[3], updated + sortedPrefix, sizeof(T) * sizes[3]);
			std::sort(streams + heads[3], streams + ends[3]);
		}

		// Lazy merge tree: refresh a node only when its chosen stream moves.
		// Resident output does not repeat north/south or newborn comparisons.
		int mover = Winner(streams, heads, ends, 0, 2);
		int incoming = Winner(streams, heads, ends, mover, 3);
		for (int32 i = 0; i < count; ++i)
		{
			if (incoming < 0)
			{
				memcpy(output + i, streams + heads[1], sizeof(T) * (ends[1] - heads[1]));
				break;
			}
			int winner = Winner(streams, heads, ends, 1, incoming);
			b2Assert(winner >= 0);
			output[i] = streams[heads[winner]++];
			if (winner != 1)
			{
				if (winner != 3) mover = Winner(streams, heads, ends, 0, 2);
				incoming = Winner(streams, heads, ends, mover, 3);
			}
		}
		B2_PARTICLE_STAT(++profile.adaptiveUpdates);
	}

private:
	// Three full-capacity streams remove the size-counting pass. Reuse the
	// consumed prefix of updated as the overflow stream: its write cursor
	// never passes the input cursor, including when newborns are appended.
	template <bool MoversToOverflow> void SortOverflow(T* output, int32 count, int32 prefix, bool valid,
		b2ParticleSystemProfile& profile, b2ParticleProxySortMode mode)
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
		if (mode == b2_scanMergeProxySort)
		{
			for (int32 i = 0; i < count; ++i)
			{
				int winner = -1, active = 0;
				for (int k = 0; k < 4; ++k)
					if (heads[k] != ends[k]) { ++active; winner = PointerWinner(heads, ends, winner, k); }
				if (active == 1) { memcpy(output + i, heads[winner], (count - i) * sizeof(T)); break; }
				output[i] = *heads[winner]++;
			}
			return;
		}
		if (mode == b2_pairMergeProxySort)
		{
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
			return;
		}
		int mover = PointerWinner(heads, ends, 0, 2);
		int incoming = PointerWinner(heads, ends, mover, 3);
		for (int32 i = 0; i < count; ++i)
		{
			if (incoming < 0)
			{
				memcpy(output + i, heads[1], sizeof(T) * (ends[1] - heads[1])); break;
			}
			int winner = PointerWinner(heads, ends, 1, incoming);
			output[i] = *heads[winner]++;
			if (winner != 1)
			{
				if (winner != 3) mover = PointerWinner(heads, ends, 0, 2);
				incoming = PointerWinner(heads, ends, mover, 3);
			}
		}
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
	static int PointerWinner(const T* const* heads, const T* const* ends, int a, int b)
	{
		if (a < 0 || heads[a] == ends[a]) return b >= 0 && heads[b] != ends[b] ? b : -1;
		if (b < 0 || heads[b] == ends[b]) return a;
		return heads[a]->tag <= heads[b]->tag ? a : b;
	}
	static bool Insert(T* data, int32 begin, int32 end, const T& item,
		uint64& budget, b2ParticleSystemProfile& profile)
	{
		B2_NOT_USED(profile);
		while (end > begin)
		{
			B2_PARTICLE_STAT(++profile.comparisons);
			if (data[end - 1].tag <= item.tag) break;
			if (!budget) return false;
			data[end] = data[end - 1]; --end; --budget;
			B2_PARTICLE_STAT(++profile.shifts);
		}
		data[end] = item;
		return true;
	}
	static int Winner(const T* data, const int32* heads, const int32* ends, int a, int b)
	{
		if (a < 0 || heads[a] == ends[a]) return b >= 0 && heads[b] != ends[b] ? b : -1;
		if (b < 0 || heads[b] == ends[b]) return a;
		return data[heads[a]].tag <= data[heads[b]].tag ? a : b;
	}
	static bool Repair(T* data, int32 begin, int32 end, uint64& budget,
		b2ParticleSystemProfile& profile)
	{
		B2_NOT_USED(profile);
		for (int32 i = begin + 1; i < end; ++i)
		{
			T item = data[i];
			int32 j = i;
			while (j > begin)
			{
				B2_PARTICLE_STAT(++profile.comparisons);
				if (data[j - 1].tag <= item.tag) break;
				if (!budget) { data[j] = item; return false; }
				data[j] = data[j - 1]; --j; --budget;
				B2_PARTICLE_STAT(++profile.shifts);
			}
			data[j] = item;
		}
		return true;
	}
	void Fallback(T* output, int32 count, b2ParticleSystemProfile& profile)
	{
		B2_NOT_USED(profile);
		memcpy(output, m_updated.Data(), count * sizeof(T));
		B2_PARTICLE_TIMER(referenceTimer, profile.referenceSortMs);
		std::sort(output, output + count);
	}
	b2GrowableBuffer<T> m_updated, m_streams, m_merge;
};
#endif
