// Particle proxy sorting for this LiquidFun fork (zlib license).
#include <Box2D/Particle/b2ParticleProxySort.h>
#include <algorithm>

namespace {
inline b2ParticleProxyKey MakeKey(const b2ParticleProxy& proxy,
	const b2Vec2* positions, float32 inverseDiameter)
{
	const b2Vec2& p = positions[proxy.index];
	b2ParticleProxyKey key = {proxy.index,
		b2ParticleProxy::ComputeTag(inverseDiameter * p.x, inverseDiameter * p.y)};
	return key;
}

inline void Emit(b2ParticleProxy& output, const b2ParticleProxyKey& key,
	const b2Vec2* positions)
{
	output.index = key.index; output.tag = key.tag;
	output.position = positions[key.index];
}
}

b2ParticleProxySorter::b2ParticleProxySorter(b2BlockAllocator& allocator) :
	m_keys(allocator), m_residentCount(0) {}

void b2ParticleProxySorter::Prepare(int32 count, b2ParticleSystemProfile& profile)
{
	B2_NOT_USED(profile);
	if (count > m_keys.GetCapacity())
	{
		int32 capacity = b2Max(count, b2Max(32, m_keys.GetCapacity() * 2));
		m_keys.Reserve(capacity);
		B2_PARTICLE_STAT(++profile.growths);
	}
	m_keys.SetCount(count);
	B2_PARTICLE_STAT(profile.scratchBytes =
		(uint64)m_keys.GetCapacity() * sizeof(b2ParticleProxyKey));
}

void b2ParticleProxySorter::Classify(const b2ParticleProxy* proxies,
	int32 count, int32 prefix, bool valid, const b2Vec2* positions,
	float32 inverseDiameter, b2ParticleSystemProfile& profile)
{
	B2_PARTICLE_TIMER(classifyTimer, profile.classifyMs);
	B2_NOT_USED(profile);
	int32 newbornCount = prefix >= 0 && prefix <= count ? count - prefix : count;
	B2_NOT_USED(newbornCount);
	if (!valid || prefix < 0 || prefix > count) prefix = 0;
	b2ParticleProxyKey* residents = m_keys.Data();
	b2ParticleProxyKey* overflow = m_keys.End();
	// Residents grow forwards and overflow grows backwards in the same buffer.
	int32 residentCount = 0, dumped = 0, i = 0;
	// These adjacent ranges visit each proxy once. The newborn range does not
	// read old tags, and the resident range needs no per-particle newborn test.
	for (; i < prefix; ++i)
	{
		b2ParticleProxyKey item = MakeKey(proxies[i], positions, inverseDiameter);
		int delta = (int)(item.tag >> b2ParticleProxy::rowShift) -
			(int)(proxies[i].tag >> b2ParticleProxy::rowShift);
		B2_PARTICLE_STAT(profile.maxRowDisplacement = b2Max(profile.maxRowDisplacement, (uint32)b2Abs(delta)));
		if (delta != 0) { *--overflow = item; ++dumped; continue; }
		if (!residentCount || residents[residentCount - 1].tag <= item.tag)
			residents[residentCount++] = item;
		else if (residentCount == 1 || residents[residentCount - 2].tag <= item.tag)
		{
			residents[residentCount] = residents[residentCount - 1];
			residents[residentCount - 1] = item; ++residentCount;
			B2_PARTICLE_STAT(++profile.localSwaps);
		}
		else { *--overflow = item; ++dumped; }
	}
	for (; i < count; ++i)
	{
		*--overflow = MakeKey(proxies[i], positions, inverseDiameter);
		++dumped;
	}
	b2Assert(overflow == residents + residentCount);
	m_residentCount = residentCount;
	B2_PARTICLE_STAT(profile.overflowParticles += dumped; profile.newborn += newbornCount;
		profile.residents += residentCount; ++profile.adaptiveUpdates);
}

void b2ParticleProxySorter::Merge(b2ParticleProxy* output, const b2Vec2* positions) const
{
	const b2ParticleProxyKey* a = m_keys.Data();
	const b2ParticleProxyKey* b = a + m_residentCount;
	int32 na = m_residentCount, nb = m_keys.GetCount() - m_residentCount;
	while (na && nb)
	{
		if (a->tag <= b->tag) { Emit(*output++, *a++, positions); --na; }
		else { Emit(*output++, *b++, positions); --nb; }
	}
	while (na > 0) { Emit(*output++, *a++, positions); --na; }
	while (nb > 0) { Emit(*output++, *b++, positions); --nb; }
}

void b2ParticleProxySorter::Sort(b2ParticleProxy* proxies, int32 count,
	int32 sortedPrefix, bool valid, const b2Vec2* positions, float32 inverseDiameter,
	b2ParticleSystemProfile& profile)
{
	if (!count) return;
	Prepare(count, profile);
	Classify(proxies, count, sortedPrefix, valid, positions, inverseDiameter, profile);
	B2_PARTICLE_TIMER(orderTimer, profile.orderMs);
	std::sort(m_keys.Begin() + m_residentCount, m_keys.End());
	// All old tags have been consumed. It is safe to overwrite the proxy array.
	Merge(proxies, positions);
}
