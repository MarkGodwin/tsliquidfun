// Tests for this fork's adaptive particle proxy sorter (zlib license).
#include <gtest/gtest.h>
#include <Box2D/Box2D.h>
#include <Box2D/Particle/b2ParticleProxySort.h>
#include <algorithm>
#include <vector>
#include <set>

struct TestProxy
{
	int32 index;
	uint32 tag;
	bool operator<(const TestProxy& other) const { return tag < other.tag; }
};
static bool Canonical(const TestProxy& a, const TestProxy& b)
{
	return a.tag < b.tag || (a.tag == b.tag && a.index < b.index);
}
static uint32 Tag(int row, int x) { return ((uint32)row << 20) + x; }
static uint32 Random(uint32& state) { state = 1664525u * state + 1013904223u; return state; }

static b2ParticleSystemProfile Check(std::vector<TestProxy> old,
	const std::vector<TestProxy>& updated, int prefix, bool valid = true)
{
	std::vector<TestProxy> original(old);
	b2ParticleSystemProfile result;
	for (int mode = b2_adaptiveRowProxySort; mode <= b2_twoStreamProxySort; ++mode)
	{
		old = original;
		b2BlockAllocator allocator;
		b2ParticleProxySorter<TestProxy> sorter(allocator);
		b2ParticleSystemProfile profile;
		int n = (int)old.size();
		TestProxy* scratch = sorter.Prepare(n, profile, (b2ParticleProxySortMode)mode);
		for (int i = 0; i < n; ++i) scratch[i] = updated[i];
		sorter.Sort(n ? &old[0] : NULL, n, prefix, valid, profile, (b2ParticleProxySortMode)mode);
		for (int i = 1; i < n; ++i) EXPECT_LE(old[i - 1].tag, old[i].tag);
		std::vector<TestProxy> expected(updated);
		std::sort(expected.begin(), expected.end(), Canonical);
		std::sort(old.begin(), old.end(), Canonical);
		for (int i = 0; i < n; ++i)
		{
			EXPECT_EQ(expected[i].index, old[i].index);
			EXPECT_EQ(expected[i].tag, old[i].tag);
		}
		if (mode == b2_adaptiveRowProxySort) result = profile;
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

TEST(ParticleProxySort, FallbackReasonsAndEqualTags)
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
	EXPECT_EQ(1u, p.repairBudget);
	EXPECT_EQ(8000u, p.shifts);
#endif
	updated[0].tag = Tag(500, 0);
	p = Check(old, updated, 1000);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_EQ(1u, p.multiRow);
#endif
	std::swap(old[0], old[999]);
	p = Check(old, old, 1000);
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_EQ(1u, p.unorderedHistory);
#endif
	for (int i = 0; i < 1000; ++i) old[i].tag = updated[i].tag = Tag(20, 12);
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

static void ContactEquivalenceAndLifecycle(b2ParticleProxySortMode mode)
{
	b2World world(b2Vec2(0, -10));
	b2ParticleSystemDef def; def.radius = 0.1f;
	def.proxySortMode = mode;
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
		s->SetProxySortMode(b2_referenceProxySort);
		b2ParticleProxySortTestAccess::Update(s);
		std::vector<Contact> expected = Contacts(s);
		ASSERT_EQ(expected.size(), actual.size());
		for (size_t i = 0; i < actual.size(); ++i)
		{
			EXPECT_EQ(expected[i].a, actual[i].a); EXPECT_EQ(expected[i].b, actual[i].b);
			EXPECT_EQ(expected[i].flags, actual[i].flags);
			EXPECT_NEAR(expected[i].weight, actual[i].weight, 1e-6f);
			EXPECT_NEAR(expected[i].normal.x, actual[i].normal.x, 1e-6f);
			EXPECT_NEAR(expected[i].normal.y, actual[i].normal.y, 1e-6f);
		}
		s->SetProxySortMode(mode);
	}
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	EXPECT_GT(s->GetParticleProfile().adaptiveUpdates, 0u);
	s->ResetParticleProfile(); world.Step(1.0f / 60, 8, 3, 1);
	EXPECT_EQ(0u, s->GetParticleProfile().growths);
#else
	EXPECT_EQ(0u, s->GetParticleProfile().updates);
#endif
}

static void GroupSnapshotJoinSplitAndEmptyReuse(b2ParticleProxySortMode mode)
{
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef sd; sd.radius = .1f; sd.proxySortMode = mode;
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

TEST(ParticleProxySort, ContactEquivalenceAndLifecycle)
{
	for (int mode = b2_adaptiveRowProxySort; mode <= b2_twoStreamProxySort; ++mode)
		ContactEquivalenceAndLifecycle((b2ParticleProxySortMode)mode);
}
TEST(ParticleProxySort, GroupSnapshotJoinSplitAndEmptyReuse)
{
	for (int mode = b2_adaptiveRowProxySort; mode <= b2_twoStreamProxySort; ++mode)
		GroupSnapshotJoinSplitAndEmptyReuse((b2ParticleProxySortMode)mode);
}

TEST(ParticleProxySort, OverflowSwapDumpAndModeSwitch)
{
	b2BlockAllocator allocator;
	b2ParticleProxySorter<TestProxy> sorter(allocator);
	b2ParticleSystemProfile profile;
	TestProxy output[7];
	const int xs[7] = {20, 10, 0, 30, 40, 60, 15};
	for (int pass = 0; pass < 4; ++pass)
	{
		b2ParticleProxySortMode mode = pass % 2 ? b2_overflowProxySort : b2_insertionProxySort;
		profile.Reset();
		TestProxy* updated = sorter.Prepare(7, profile, mode);
		for (int i = 0; i < 7; ++i)
		{
			output[i].index = updated[i].index = i;
			output[i].tag = Tag(100, i * 10);
			updated[i].tag = Tag(i == 5 ? 120 : 100, xs[i]);
		}
		sorter.Sort(output, 7, 6, true, profile, mode);
		std::set<int> indices;
		for (int i = 0; i < 7; ++i)
		{
			if (i) EXPECT_LE(output[i - 1].tag, output[i].tag);
			indices.insert(output[i].index);
		}
		EXPECT_EQ(7u, indices.size());
#if defined(BOX2D_PROFILE_PARTICLES) && !defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
		if (mode == b2_overflowProxySort)
		{
			EXPECT_EQ(3u, profile.overflowParticles);
			EXPECT_EQ(1u, profile.localSwaps);
			EXPECT_EQ(0u, profile.multiRow);
			EXPECT_EQ(0u, profile.repairBudget);
		}
		if (pass >= 2) EXPECT_EQ(0u, profile.growths);
#endif
	}
}

TEST(ParticleProxySort, LightProfiling)
{
#if defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	b2World world(b2Vec2(0, 0));
	b2ParticleSystemDef def;
	b2ParticleSystem* s = world.CreateParticleSystem(&def);
	b2ParticleDef p; s->CreateParticle(p);
	for (int mode = b2_referenceProxySort; mode <= b2_twoStreamProxySort; ++mode)
	{
		s->SetProxySortMode((b2ParticleProxySortMode)mode);
		s->ResetParticleProfile();
		for (int i = 0; i < 100; ++i) world.Step(.01f, 1, 1, 1);
		EXPECT_GT(s->GetParticleProfile().proxyMs, 0);
		EXPECT_EQ(0, s->GetParticleProfile().tagMs);
		EXPECT_EQ(0, s->GetParticleProfile().orderMs);
		EXPECT_EQ(0, s->GetParticleProfile().solveMs);
		EXPECT_EQ(0u, s->GetParticleProfile().comparisons);
		EXPECT_EQ(0u, s->GetParticleProfile().updates);
	}
#endif
}

int main(int argc, char** argv)
{
	::testing::InitGoogleTest(&argc, argv); return RUN_ALL_TESTS();
}
