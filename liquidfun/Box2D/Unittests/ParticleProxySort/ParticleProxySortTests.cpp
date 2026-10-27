// Tests for this fork's adaptive particle proxy sorter (zlib license).
#include <gtest/gtest.h>
#include <Box2D/Box2D.h>
#include <Box2D/Particle/b2ParticleProxySort.h>
#include "../../Benchmarks/ParticleProxyReplaySort.h"
#include <algorithm>
#include <vector>
#include <set>

typedef b2ParticleProxyKey TestProxy;
static bool Canonical(const TestProxy& a, const TestProxy& b)
{
	return a.tag < b.tag || (a.tag == b.tag && a.index < b.index);
}
static uint32 Tag(int row, int x) { return ((uint32)row << 20) + x; }
static uint32 Random(uint32& state) { state = 1664525u * state + 1013904223u; return state; }

// Exact binary fractions round-trip arbitrary valid tags at inverseDiameter=1.
static b2Vec2 PositionForTag(uint32 tag)
{
	return b2Vec2(((float32)(tag & ((1u << 20) - 1)) - 524288.0f) / 256,
		(float32)(tag >> 20) - 2048);
}

static b2ParticleSystemProfile Check(std::vector<TestProxy> old,
	const std::vector<TestProxy>& updated, int prefix, bool valid = true)
{
	std::vector<TestProxy> original(old);
	// The old engine population pass preserved each history slot's index.
	for (size_t i = 0; i < old.size(); ++i) EXPECT_EQ(old[i].index, updated[i].index);
	b2ParticleSystemProfile result;
	for (int mode = b2_pairMergeProxySort; mode <= b2_twoStreamProxySort; ++mode)
	{
		old = original;
		b2BlockAllocator allocator;
		b2ParticleProxyReplaySorter replay(allocator);
		b2ParticleSystemProfile profile;
		int n = (int)old.size();
		TestProxy* scratch = replay.Prepare(n, profile, (b2ParticleProxySortMode)mode);
		for (int i = 0; i < n; ++i) scratch[i] = updated[i];
		replay.Sort(n ? &old[0] : NULL, n, prefix, valid, profile, (b2ParticleProxySortMode)mode);
		if (mode == b2_twoStreamProxySort)
		{
			// Compare the fused production pass with the previous precomputed-key
			// algorithm, including exact equal-tag order, not merely membership.
			std::vector<b2ParticleProxy> proxies(n);
			std::vector<b2Vec2> positions(n);
			for (int i = 0; i < n; ++i)
			{
				proxies[i].index = original[i].index;
				proxies[i].tag = original[i].tag;
				proxies[i].position.Set(-100, -200);
				positions[updated[i].index] = PositionForTag(updated[i].tag);
			}
			b2ParticleProxySorter sorter(allocator);
			sorter.Sort(n ? &proxies[0] : NULL, n, prefix, valid,
				n ? &positions[0] : NULL, 1, result);
			for (int i = 0; i < n; ++i)
			{
				EXPECT_EQ(old[i].index, proxies[i].index);
				EXPECT_EQ(old[i].tag, proxies[i].tag);
				EXPECT_EQ(positions[old[i].index].x, proxies[i].position.x);
				EXPECT_EQ(positions[old[i].index].y, proxies[i].position.y);
			}
		}
		for (int i = 1; i < n; ++i) EXPECT_LE(old[i - 1].tag, old[i].tag);
		std::vector<TestProxy> expected(updated);
		std::sort(expected.begin(), expected.end(), Canonical);
		std::sort(old.begin(), old.end(), Canonical);
		for (int i = 0; i < n; ++i)
		{
			EXPECT_EQ(expected[i].index, old[i].index);
			EXPECT_EQ(expected[i].tag, old[i].tag);
		}
	}
	return result;
}

TEST(ParticleProxySort, EmptySingletonAndNewbornRows)
{
	std::vector<TestProxy> old, updated;
	Check(old, updated, 0);
	TestProxy p = {0, Tag(2000, 5)};
	old.push_back(p); updated.push_back(p);
	Check(old, updated, 1);
	for (int i = 1; i < 100; ++i)
	{
		p.index = i; p.tag = 0; old.push_back(p);
		p.tag = Tag(i % 2 ? 0 : 4095, 100 - i); updated.push_back(p);
	}
	Check(old, updated, 1);
	Check(old, updated, 0, false);
	Check(old, updated, -1);
	Check(old, updated, 105);
}

TEST(ParticleProxySort, RandomizedRowsMoversBirthsAndJumps)
{
	uint32 seed = 12345;
	for (int trial = 0; trial < 3000; ++trial)
	{
		int n = (int)(Random(seed) % 400);
		int prefix = n ? (int)(Random(seed) % (n + 1)) : 0;
		std::vector<TestProxy> old(n), updated(n);
		for (int i = 0; i < prefix; ++i)
		{
			old[i].index = i;
			old[i].tag = Tag(20 + Random(seed) % 30, Random(seed) % 10000);
		}
		std::sort(old.begin(), old.begin() + prefix);
		for (int i = 0; i < n; ++i)
		{
			if (i < prefix)
			{
				updated[i] = old[i];
				int delta = (int)(Random(seed) % 3) - 1;
				if (trial % 7 == 0) delta *= 10;
				updated[i].tag = Tag((old[i].tag >> 20) + delta, Random(seed) % 10000);
			}
			else
			{
				old[i].index = updated[i].index = i;
				old[i].tag = 0xdeadbeef;
				updated[i].tag = Tag(Random(seed) % 4096, Random(seed) % 10000);
			}
		}
		Check(old, updated, prefix);
	}
}

TEST(ParticleProxySort, DisorderJumpsAndEqualTags)
{
	std::vector<TestProxy> old(1000), updated(1000);
	for (int i = 0; i < 1000; ++i)
	{
		old[i].index = updated[i].index = i;
		old[i].tag = Tag(100, i);
		updated[i].tag = Tag(100, 1000 - i);
	}
	b2ParticleSystemProfile p = Check(old, updated, 1000);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_EQ(998u, p.overflowParticles);
	EXPECT_EQ(1u, p.localSwaps);
#endif
	updated[0].tag = Tag(500, 0);
	p = Check(old, updated, 1000);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_GT(p.overflowParticles, 0u);
#endif
	std::swap(old[0], old[999]);
	p = Check(old, old, 1000);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_GT(p.overflowParticles, 0u);
#endif
	for (int i = 0; i < 1000; ++i)
	{
		old[i].tag = updated[i].tag = Tag(20, 12);
		updated[i].index = old[i].index;
	}
	Check(old, updated, 1000);
}

class b2ParticleProxySortTestAccess
{
public:
	static void Update(b2ParticleSystem* s) { s->UpdateContacts(false); }
	static void CheckOrder(b2ParticleSystem* s)
	{
		for (int i = 1; i < s->m_proxyBuffer.GetCount(); ++i)
			EXPECT_LE(s->m_proxyBuffer[i - 1].tag, s->m_proxyBuffer[i].tag);
		EXPECT_EQ(s->GetParticleCount(), s->m_proxyBuffer.GetCount());
	}
	static void CheckCachedPositions(b2ParticleSystem* s)
	{
		EXPECT_EQ(8u, sizeof(b2ParticleSystem::ProxyKey));
		EXPECT_EQ(16u, sizeof(b2ParticleSystem::Proxy));
		for (int i = 0; i < s->m_proxyBuffer.GetCount(); ++i)
		{
			const b2ParticleSystem::Proxy& proxy = s->m_proxyBuffer[i];
			EXPECT_EQ(s->GetPositionBuffer()[proxy.index].x, proxy.position.x);
			EXPECT_EQ(s->GetPositionBuffer()[proxy.index].y, proxy.position.y);
		}
	}
	static b2Vec2 CachedPosition(b2ParticleSystem* s, int index)
	{
		for (int i = 0; i < s->m_proxyBuffer.GetCount(); ++i)
			if (s->m_proxyBuffer[i].index == index) return s->m_proxyBuffer[i].position;
		ADD_FAILURE() << "Missing proxy for particle " << index;
		return b2Vec2(0, 0);
	}
	static uint32 FirstTag(b2ParticleSystem* s) { return s->m_proxyBuffer[0].tag; }
};

struct Contact
{
	int a, b; float weight; b2Vec2 normal; uint32 flags;
	bool operator<(const Contact& o) const { return a < o.a || (a == o.a && b < o.b); }
};
static std::vector<Contact> Contacts(b2ParticleSystem* s)
{
	std::vector<Contact> result;
	for (int i = 0; i < s->GetContactCount(); ++i)
	{
		const b2ParticleContact& c = s->GetContacts()[i];
		Contact v = {c.GetIndexA(), c.GetIndexB(), c.GetWeight(), c.GetNormal(), c.GetFlags()};
		if (v.a > v.b) { std::swap(v.a, v.b); v.normal = -v.normal; }
		result.push_back(v);
	}
	std::sort(result.begin(), result.end()); return result;
}

// Independent all-pairs reference: no proxy tags, cached positions or sort order.
static std::vector<Contact> BruteForceContacts(b2ParticleSystem* s)
{
	std::vector<Contact> result;
	float32 diameter = 2 * s->GetRadius(), inverseDiameter = 1 / diameter;
	const b2Vec2* positions = s->GetPositionBuffer();
	const uint32* flags = s->GetFlagsBuffer();
	for (int a = 0; a < s->GetParticleCount(); ++a)
		for (int b = a + 1; b < s->GetParticleCount(); ++b)
		{
			b2Vec2 d = positions[b] - positions[a];
			float32 squared = b2Dot(d, d);
			if (squared < diameter * diameter)
			{
				float32 invD = b2InvSqrt(squared);
				Contact c = {a, b, 1 - squared * invD * inverseDiameter,
					invD * d, flags[a] | flags[b]};
				result.push_back(c);
			}
		}
	std::sort(result.begin(), result.end());
	return result;
}

TEST(ParticleProxySort, ContactEquivalenceAndLifecycle)
{
	b2World world(b2Vec2(0, -10));
	b2ParticleSystemDef def; def.radius = 0.1f;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	uint32 seed = 97;
	for (int step = 0; step < 120; ++step)
	{
		if (step < 20)
			for (int i = 0; i < 5; ++i)
			{
				b2ParticleDef p;
				p.position.Set((Random(seed) % 100) * .01f, (Random(seed) % 100) * .01f);
				s->CreateParticle(p);
			}
		if (step == 30) s->SetRadius(.12f);
		if (step == 40) s->DestroyParticle(0);
		world.Step(1.0f / 60, 8, 3, 2);
		for (int i = 0; i < s->GetParticleCount(); ++i)
			s->GetPositionBuffer()[i].x += ((int)(Random(seed) % 3) - 1) * .01f;
		b2ParticleProxySortTestAccess::Update(s);
		std::vector<Contact> actual = Contacts(s);
		b2ParticleProxySortTestAccess::CheckOrder(s);
		b2ParticleProxySortTestAccess::CheckCachedPositions(s);
		std::vector<Contact> expected = BruteForceContacts(s);
		ASSERT_EQ(expected.size(), actual.size());
		for (size_t i = 0; i < actual.size(); ++i)
		{
			EXPECT_EQ(expected[i].a, actual[i].a); EXPECT_EQ(expected[i].b, actual[i].b);
			EXPECT_EQ(expected[i].flags, actual[i].flags);
			EXPECT_NEAR(expected[i].weight, actual[i].weight, 1e-6f);
			EXPECT_NEAR(expected[i].normal.x, actual[i].normal.x, 1e-6f);
			EXPECT_NEAR(expected[i].normal.y, actual[i].normal.y, 1e-6f);
		}
	}
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_GT(s->GetParticleProfile().adaptiveUpdates, 0u);
	s->ResetParticleProfile(); world.Step(1.0f / 60, 8, 3, 1);
	EXPECT_EQ(0u, s->GetParticleProfile().growths);
#else
	EXPECT_EQ(0u, s->GetParticleProfile().updates);
#endif
}

TEST(ParticleProxySort, GroupSnapshotJoinSplitAndEmptyReuse)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef sd; sd.radius = .1f;
	b2ParticleSystem* s = world.CreateParticleSystem(&sd);
	b2Vec2 points[4] = { b2Vec2(0, 0), b2Vec2(.1f, 0), b2Vec2(2, 0), b2Vec2(2.1f, 0) };
	b2ParticleGroupDef gd; gd.particleCount = 4; gd.positionData = points;
	gd.groupFlags = b2_particleGroupCanBeEmpty;
	b2ParticleGroup* a = s->CreateParticleGroup(gd);
	s->SplitParticleGroup(a);
	b2ParticleGroupDef* snapshot = s->SnapshotParticleGroup(a);
	b2ParticleGroup* b = s->CreateParticleGroup(*snapshot);
	s->FreeParticleSnapshot(snapshot);
	s->JoinParticleGroups(a, b);
	a->DestroyParticles(false); world.Step(.01f, 1, 1);
	b2ParticleDef pd; pd.group = a; s->CreateParticle(pd);
	world.Step(.01f, 1, 1);
	b2ParticleProxySortTestAccess::CheckOrder(s);
	EXPECT_EQ(1, a->GetParticleCount());
}

TEST(ParticleProxySort, FusedOverflowSwapAndScratchReuse)
{
	b2BlockAllocator allocator;
	b2ParticleProxySorter sorter(allocator);
	b2ParticleSystemProfile profile;
	b2ParticleProxy output[7]; b2Vec2 positions[7];
	const int xs[7] = {20, 10, 0, 30, 40, 60, 15};
	for (int pass = 0; pass < 4; ++pass)
	{
		profile.Reset();
		for (int i = 0; i < 7; ++i)
		{
			output[i].index = i; output[i].tag = Tag(100, i * 10);
			output[i].position.Set(-100, -200);
			positions[i] = PositionForTag(Tag(i == 5 ? 120 : 100, xs[i]));
		}
		sorter.Sort(output, 7, 6, true, positions, 1, profile);
		std::set<int> indices;
		for (int i = 0; i < 7; ++i)
		{
			if (i) EXPECT_LE(output[i - 1].tag, output[i].tag);
			indices.insert(output[i].index);
			EXPECT_EQ(positions[output[i].index].x, output[i].position.x);
			EXPECT_EQ(positions[output[i].index].y, output[i].position.y);
		}
		EXPECT_EQ(7u, indices.size());
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
		EXPECT_EQ(3u, profile.overflowParticles);
		EXPECT_EQ(1u, profile.localSwaps);
		if (pass) EXPECT_EQ(0u, profile.growths);
#endif
	}
}

TEST(ParticleProxySort, PositionsRefreshWhenTagsDoNotChange)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def; def.radius = .1f;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ParticleDef pd; pd.position.Set(.01f, .01f); s->CreateParticle(pd);
	b2ParticleProxySortTestAccess::Update(s);
	uint32 oldTag = b2ParticleProxySortTestAccess::FirstTag(s);
	s->GetPositionBuffer()[0] += b2Vec2(.000001f, .000001f);
	b2ParticleProxySortTestAccess::Update(s);
	EXPECT_EQ(oldTag, b2ParticleProxySortTestAccess::FirstTag(s));
	b2ParticleProxySortTestAccess::CheckCachedPositions(s);
}

TEST(ParticleProxySort, PositionsRefreshOnEveryParticleSubstep)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def; def.radius = .02f;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ParticleDef pd; pd.velocity.Set(.1f, .2f); s->CreateParticle(pd);
	s->ResetParticleProfile();
	world.Step(.1f, 1, 1, 4);
	b2Vec2 beforeLastIntegration = s->GetPositionBuffer()[0] - .025f * s->GetVelocityBuffer()[0];
	b2Vec2 cached = b2ParticleProxySortTestAccess::CachedPosition(s, 0);
	EXPECT_NEAR(beforeLastIntegration.x, cached.x, 1e-7f);
	EXPECT_NEAR(beforeLastIntegration.y, cached.y, 1e-7f);
	EXPECT_GT(cached.x, 0);
	EXPECT_GT(s->GetPositionBuffer()[0].x, cached.x);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_EQ(4u, s->GetParticleProfile().substeps);
	EXPECT_EQ(4u, s->GetParticleProfile().updates);
#endif
}

TEST(ParticleProxySort, LightProfiling)
{
#if defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ParticleDef pd; s->CreateParticle(pd);
	s->ResetParticleProfile();
	for (int i = 0; i < 100; ++i) world.Step(.01f, 1, 1, 1);
	EXPECT_GT(s->GetParticleProfile().proxyMs, 0);
	EXPECT_EQ(0, s->GetParticleProfile().classifyMs);
	EXPECT_EQ(0, s->GetParticleProfile().orderMs);
	EXPECT_EQ(0, s->GetParticleProfile().solveMs);
	EXPECT_EQ(0u, s->GetParticleProfile().updates);
#endif
}

class ProxyQueryRecorder : public b2QueryCallback
{
public:
	std::vector<int32> indices;
	bool ReportFixture(b2Fixture*) { return true; }
	bool ReportParticle(const b2ParticleSystem*, int32 index)
	{ indices.push_back(index); return true; }
};
class ProxyRayRecorder : public b2RayCastCallback
{
public:
	explicit ProxyRayRecorder(bool stopAfterFirst = false) : m_stopAfterFirst(stopAfterFirst) {}
	std::vector<int32> indices;
	std::vector<float32> fractions;
	float32 ReportFixture(b2Fixture*, const b2Vec2&, const b2Vec2&, float32) { return 1; }
	float32 ReportParticle(const b2ParticleSystem*, int32 index,
		const b2Vec2&, const b2Vec2&, float32 fraction)
	{ indices.push_back(index); fractions.push_back(fraction); return m_stopAfterFirst ? 0.0f : 1.0f; }
private:
	bool m_stopAfterFirst;
};

TEST(ParticleProxySort, BoundsRayQueriesSkipColumnsAndStopEarly)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def; def.radius = .02f;
	b2ParticleSystem* system = world.CreateParticleSystem(&def);
	ProxyRayRecorder empty;
	system->RayCast(&empty, b2Vec2(-1, 0), b2Vec2(1, 0));
	EXPECT_TRUE(empty.indices.empty());
	const float32 xs[] = {-2, -.5f, 0, .5f, 2};
	for (int row = 0; row < 3; ++row)
		for (int col = 0; col < 5; ++col)
		{
			b2ParticleDef pd; pd.position.Set(xs[col], (row - 1) * .2f);
			system->CreateParticle(pd);
		}
	world.Step(.01f, 1, 1, 1);
	ProxyRayRecorder diagonal;
	system->RayCast(&diagonal, b2Vec2(-1, -.2f), b2Vec2(1, .2f));
	ASSERT_EQ(1u, diagonal.indices.size());
	EXPECT_EQ(7, diagonal.indices[0]);
	ProxyRayRecorder horizontal;
	system->RayCast(&horizontal, b2Vec2(-1, 0), b2Vec2(1, 0));
	ASSERT_EQ(3u, horizontal.indices.size());
	for (int i = 0; i < 3; ++i) EXPECT_EQ(6 + i, horizontal.indices[i]);
	ProxyRayRecorder clipped(true);
	system->RayCast(&clipped, b2Vec2(-1, 0), b2Vec2(1, 0));
	ASSERT_EQ(1u, clipped.indices.size());
	EXPECT_EQ(6, clipped.indices[0]);
}

TEST(ParticleProxySort, QueriesUseCurrentPositionsAfterMerge)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def; def.radius = .02f;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ParticleDef pd; pd.position.Set(.25f, .25f); s->CreateParticle(pd);
	b2ParticleProxySortTestAccess::Update(s);
	// Change geometry within the same Y tag band, leaving the merge snapshot old.
	s->GetPositionBuffer()[0].y = .252f;
	ProxyQueryRecorder query;
	b2AABB bounds; bounds.lowerBound.Set(.1f, .251f); bounds.upperBound.Set(.4f, .26f);
	s->QueryAABB(&query, bounds);
	ASSERT_EQ(1u, query.indices.size()); EXPECT_EQ(0, query.indices[0]);
	ProxyRayRecorder ray;
	s->RayCast(&ray, b2Vec2(.1f, .2915f), b2Vec2(.4f, .2915f));
	ASSERT_EQ(1u, ray.indices.size()); EXPECT_EQ(0, ray.indices[0]);
}

TEST(ParticleProxySort, BarrierConfinesFallingParticles)
{
	b2World world(b2Vec2(0, -10));
	b2ParticleSystemDef def; def.radius = .03f;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ChainShape boundary;
	const b2Vec2 corners[] = {b2Vec2(-1, 0), b2Vec2(1, 0), b2Vec2(1, 1.5f), b2Vec2(-1, 1.5f)};
	boundary.CreateLoop(corners, 4);
	b2ParticleGroupDef barrier;
	barrier.shape = &boundary; barrier.flags = b2_barrierParticle | b2_wallParticle;
	s->CreateParticleGroup(barrier);
	b2PolygonShape box; box.SetAsBox(.3f, .15f);
	b2ParticleGroupDef water;
	water.shape = &box; water.position.Set(0, .4f); water.linearVelocity.Set(0, -1);
	b2ParticleGroup* group = s->CreateParticleGroup(water);
	ASSERT_GT(s->GetPairCount(), 0);
	for (int step = 0; step < 120; ++step)
	{
		world.Step(1.0f / 120, 8, 3, 2);
		for (int i = group->GetBufferIndex(); i < group->GetBufferIndex() + group->GetParticleCount(); ++i)
		{
			ASSERT_TRUE(b2IsValid(s->GetPositionBuffer()[i].y));
			EXPECT_GE(s->GetPositionBuffer()[i].y, -.01f);
		}
	}
}

TEST(ParticleProxySort, EmptyAndPendingZombieWithNewborn)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	world.Step(.01f, 1, 1, 1);
	b2ParticleDef pd; s->CreateParticle(pd);
	s->DestroyParticle(0);
	pd.position.Set(1, 2); s->CreateParticle(pd);
	world.Step(.01f, 1, 1, 1);
	EXPECT_EQ(1, s->GetParticleCount());
	b2ParticleProxySortTestAccess::CheckOrder(s);
	b2ParticleProxySortTestAccess::Update(s);
	b2ParticleProxySortTestAccess::CheckCachedPositions(s);
	s->DestroyParticle(0);
	world.Step(.01f, 1, 1, 1);
	EXPECT_EQ(0, s->GetParticleCount());
}

int main(int argc, char** argv)
{
	::testing::InitGoogleTest(&argc, argv); return RUN_ALL_TESTS();
}
