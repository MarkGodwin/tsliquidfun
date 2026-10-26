// Headless native benchmark for this LiquidFun fork (zlib license).
#include <Box2D/Box2D.h>
#include <Box2D/Common/b2Stat.h>
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

struct Proxy
{
	int32 index; uint32 tag;
	bool operator<(const Proxy& o) const { return tag < o.tag; }
};
static bool Canonical(const Proxy& a, const Proxy& b)
{ return a.tag < b.tag || (a.tag == b.tag && a.index < b.index); }
struct Frame
{
	std::vector<Proxy> old, updated;
	int prefix; bool valid;
};
// Benchmark-only access: captures before a step without changing simulation.
class b2ParticleProxySortTestAccess
{
public:
	static Frame Capture(b2ParticleSystem* s)
	{
		Frame f; f.prefix = s->m_sortedProxyCount; f.valid = s->m_proxyHistoryValid;
		int n = s->m_proxyBuffer.GetCount(); f.old.resize(n); f.updated.resize(n);
		for (int i = 0; i < n; ++i)
		{
			int index = s->m_proxyBuffer[i].index;
			f.old[i].index = f.updated[i].index = index;
			f.old[i].tag = f.valid && i < f.prefix ? s->m_proxyBuffer[i].tag : 0;
			b2Vec2 p = s->m_inverseDiameter * s->m_positionBuffer.data[index];
			f.updated[i].tag = ((uint32)(p.y + 2048) << 20) + (uint32)(256 * p.x + 524288);
		}
		return f;
	}
};

struct Options
{
	std::string scene, sorter, mode, output, traceIn, traceOut;
	int count, iterations, warmup, steps, seed, traceFrames;
	Options() : scene("settled"), sorter("reference"), mode("world"), output("particle-sort"),
		count(3000), iterations(1), warmup(300), steps(3000), seed(1), traceFrames(120) {}
};
static int Number(const std::string& s)
{
	char* end; long n = std::strtol(s.c_str(), &end, 10);
	if (s.empty() || *end || n < 0 || n > 10000000) throw std::runtime_error("Invalid numeric option: " + s);
	return (int)n;
}
static Options Parse(int argc, char** argv)
{
	Options o;
	for (int i = 1; i < argc; ++i)
	{
		std::string key(argv[i]);
		if (key == "--help")
		{
			std::cout << "ParticleSortBenchmark --mode world|replay --sorter reference|pair|two-stream "
				"--scene settled|falling|shear|separated|churn|teleport --count N --iterations N "
				"--warmup N --steps N --seed N --output PREFIX --trace-frames N "
				"[--trace-in FILE] [--trace-out FILE]\n"; std::exit(0);
		}
		if (++i == argc) throw std::runtime_error("Missing value for " + key);
		std::string value(argv[i]);
		if (key == "--scene") o.scene = value;
		else if (key == "--sorter") o.sorter = value;
		else if (key == "--mode") o.mode = value;
		else if (key == "--output") o.output = value;
		else if (key == "--trace-in") o.traceIn = value;
		else if (key == "--trace-out") o.traceOut = value;
		else if (key == "--count") o.count = Number(value);
		else if (key == "--iterations") o.iterations = Number(value);
		else if (key == "--warmup") o.warmup = Number(value);
		else if (key == "--steps") o.steps = Number(value);
		else if (key == "--seed") o.seed = Number(value);
		else if (key == "--trace-frames") o.traceFrames = Number(value);
		else throw std::runtime_error("Unknown option: " + key);
	}
	if (o.sorter != "reference" && o.sorter != "pair" && o.sorter != "two-stream") throw std::runtime_error("Invalid sorter");
	if (o.mode != "world" && o.mode != "replay") throw std::runtime_error("Invalid mode");
	if (!o.traceIn.empty() && o.mode != "replay") throw std::runtime_error("--trace-in requires replay mode");
	if (!o.count || o.count > 30000 || !o.steps || !o.iterations || !o.traceFrames || o.traceFrames > 1000)
		throw std::runtime_error("Require 1..30000 particles, positive steps/iterations and 1..1000 trace frames");
	const char* names[] = {"settled", "falling", "shear", "separated", "churn", "teleport"};
	bool known = false; for (int i = 0; i < 6; ++i) known |= o.scene == names[i];
	if (!known) throw std::runtime_error("Invalid scene");
	return o;
}

static void Write32(std::ostream& out, uint32 v)
{ for (int i = 0; i < 4; ++i) out.put((char)(v >> (8 * i))); }
static uint32 Read32(std::istream& in)
{
	uint32 v = 0;
	for (int i = 0; i < 4; ++i) { int c = in.get(); if (c < 0) throw std::runtime_error("Truncated trace"); v |= (uint32)c << (8 * i); }
	return v;
}
static void SaveTrace(const std::string& path, const std::vector<Frame>& frames)
{
	std::ofstream out(path.c_str(), std::ios::binary);
	if (!out) throw std::runtime_error("Cannot write trace");
	out.write("LFPS0001", 8); Write32(out, (uint32)frames.size());
	for (size_t j = 0; j < frames.size(); ++j)
	{
		const Frame& f = frames[j]; Write32(out, (uint32)f.old.size()); Write32(out, f.prefix); Write32(out, f.valid ? 1 : 0);
		for (size_t i = 0; i < f.old.size(); ++i)
		{ Write32(out, f.old[i].index); Write32(out, f.old[i].tag); Write32(out, f.updated[i].tag); }
	}
	if (!out) throw std::runtime_error("Trace write failed");
}
static std::vector<Frame> LoadTrace(const std::string& path)
{
	std::ifstream in(path.c_str(), std::ios::binary); char magic[8]; in.read(magic, 8);
	if (!in || std::string(magic, 8) != "LFPS0001") throw std::runtime_error("Invalid trace header");
	uint32 count = Read32(in); if (!count || count > 1000) throw std::runtime_error("Invalid frame count");
	std::vector<Frame> frames(count);
	uint64 total = 0;
	for (uint32 j = 0; j < count; ++j)
	{
		Frame& f = frames[j]; uint32 n = Read32(in), prefix = Read32(in), valid = Read32(in);
		total += n;
		if (n > 30000 || prefix > n || valid > 1 || total > 10000000) throw std::runtime_error("Invalid trace dimensions");
		f.prefix = (int)prefix; f.valid = valid != 0; f.old.resize(n); f.updated.resize(n);
		for (uint32 i = 0; i < n; ++i)
		{
			f.old[i].index = f.updated[i].index = (int32)Read32(in);
			f.old[i].tag = Read32(in); f.updated[i].tag = Read32(in);
		}
	}
	return frames;
}

static b2ParticleProxySortMode SortMode(const Options& o)
{
	return o.sorter == "reference" ? b2_referenceProxySort :
		o.sorter == "pair" ? b2_pairMergeProxySort : b2_twoStreamProxySort;
}

static uint32 Random(uint32& state) { state = state * 1664525u + 1013904223u; return state; }
class Scene
{
public:
	b2World world;
	b2ParticleSystem* system;
	float32 width, height;
	uint32 random;
	Scene(const Options& o, bool reference) : world(b2Vec2(0, -9.8f)), random(o.seed)
	{
		int columns = (int)std::ceil(std::sqrt((double)o.count));
		width = columns * .075f + .4f; height = width + 2;
		b2BodyDef bd; b2Body* walls = world.CreateBody(&bd);
		b2PolygonShape shape;
		for (int container = 0; container < (o.scene == "separated" ? 2 : 1); ++container)
		{
		float32 origin = container * (width + 2);
		shape.SetAsBox(width / 2 + .2f, .1f, b2Vec2(origin + width / 2, -.1f), 0); walls->CreateFixture(&shape, 0);
		shape.SetAsBox(.1f, height, b2Vec2(origin - .1f, height / 2), 0); walls->CreateFixture(&shape, 0);
		shape.SetAsBox(.1f, height, b2Vec2(origin + width + .1f, height / 2), 0); walls->CreateFixture(&shape, 0);
		}
		b2ParticleSystemDef sd; sd.radius = .05f;
		sd.proxySortMode = reference ? b2_referenceProxySort : SortMode(o);
		system = world.CreateParticleSystem(&sd);
		b2ParticleGroup* groups[2] = {NULL, NULL};
		if (o.scene == "separated")
		{
			b2ParticleGroupDef gd; gd.groupFlags = b2_particleGroupCanBeEmpty;
			groups[0] = system->CreateParticleGroup(gd);
			groups[1] = system->CreateParticleGroup(gd);
		}
		for (int i = 0; i < o.count; ++i)
		{
			b2ParticleDef p;
			p.position.Set(.2f + (i % columns) * .075f, .1f + (i / columns) * .075f);
			if (o.scene == "falling") p.position.y += 1;
			if (o.scene == "separated")
			{
				int group = i < o.count / 2 ? 0 : 1;
				int local = i - (group ? o.count / 2 : 0);
				p.position.Set(.2f + (local % columns) * .075f + group * (width + 2),
					.1f + (local / columns) * .075f);
				p.group = groups[group];
			}
			system->CreateParticle(p);
		}
	}
	void Steer(const Options& o, int step)
	{
		int n = system->GetParticleCount();
		if (o.scene == "shear")
			for (int i = 0; i < n; ++i)
				system->GetVelocityBuffer()[i].x = (system->GetPositionBuffer()[i].y > height / 4 ? 1.0f : -1.0f);
		if (o.scene == "falling" && step % 180 == 0)
			for (int i = 0; i < n; ++i) { system->GetPositionBuffer()[i].y += 1; system->GetVelocityBuffer()[i].y = -2; }
		if (o.scene == "teleport" && step % 30 == 0)
			for (int i = 0; i < n; i += 11) system->GetPositionBuffer()[i].y += .5f;
		if (o.scene == "churn" && step % 5 == 0)
		{
			int batch = b2Min(10, n);
			for (int i = 0; i < batch; ++i) system->DestroyParticle(i);
			for (int i = 0; i < batch; ++i)
			{
				b2ParticleDef p; p.position.Set(.1f + (Random(random) % 1000) * .001f * (width - .2f), height * .7f);
				system->CreateParticle(p);
			}
		}
	}
};

struct Sample
{
	double ms; int count;
	b2ParticleSystemProfile profile;
};
static double Percentile(const std::vector<double>& sorted, double p)
{ return sorted[(size_t)std::ceil(p * sorted.size()) - 1]; }
static void Report(const Options& o, const std::vector<Sample>& samples)
{
	std::ofstream csv((o.output + ".steps.csv").c_str());
	if (!csv) throw std::runtime_error("Cannot write output prefix: " + o.output);
	csv << "step,ms,count,solve_ms,proxy_ms,tag_ms,order_ms,reference_sort_ms,contacts_ms,filter_listener_ms,body_contacts_ms,collision_ms,remaining_solver_ms,updates,substeps,north,south,residents,newborn,adaptive,candidates,contacts,body_contacts,growths,scratch_bytes,max_row_displacement,overflow_particles,local_swaps,processed_proxies\n";
	std::vector<double> times; b2Stat stats; int missed = 0;
	for (size_t i = 0; i < samples.size(); ++i)
	{
		const Sample& s = samples[i]; const b2ParticleSystemProfile& p = s.profile;
		times.push_back(s.ms); stats.Record((float32)s.ms); if (s.ms > 1000.0 / 60) ++missed;
		csv << std::setprecision(9) << i << ',' << s.ms << ',' << s.count << ','
			<< p.solveMs << ',' << p.proxyMs << ',' << p.tagMs << ',' << p.orderMs << ',' << p.referenceSortMs << ','
			<< p.contactsMs << ',' << p.filterListenerMs << ',' << p.bodyContactsMs << ',' << p.collisionMs << ','
			<< (p.solveMs - p.proxyMs - p.contactsMs - p.filterListenerMs - p.bodyContactsMs - p.collisionMs) << ','
			<< p.updates << ',' << p.substeps << ',' << p.north << ',' << p.south << ',' << p.residents << ',' << p.newborn << ','
			<< p.adaptiveUpdates << ',' << p.candidates << ',' << p.contacts << ',' << p.bodyContacts << ','
			<< p.growths << ',' << p.scratchBytes << ',' << p.maxRowDisplacement << ',' << p.overflowParticles << ',' << p.localSwaps << ',' << p.particles << '\n';
	}
	std::sort(times.begin(), times.end());
	int maximumCount = 0;
	for (size_t i = 0; i < samples.size(); ++i) maximumCount = b2Max(maximumCount, samples[i].count);
	std::ofstream summary((o.output + ".summary.csv").c_str());
	summary << "mode,scene,sorter,count,iterations,seed,steps,median_ms,p95_ms,p99_ms,mean_ms,min_ms,max_ms,over_16_667_fraction\n";
	summary << o.mode << ',' << (o.traceIn.empty() ? o.scene : "external_trace") << ',' << o.sorter << ','
		<< (o.traceIn.empty() ? o.count : maximumCount) << ',' << (o.traceIn.empty() ? o.iterations : 0) << ',' << (o.traceIn.empty() ? o.seed : 0) << ',' << o.steps << ','
		<< Percentile(times, .5) << ',' << Percentile(times, .95) << ',' << Percentile(times, .99) << ','
		<< stats.GetMean() << ',' << stats.GetMin() << ',' << stats.GetMax() << ',' << (double)missed / samples.size() << '\n';
	std::ofstream meta((o.output + ".metadata.txt").c_str());
	meta << "revision=" << B2_BENCH_REVISION << "\nconfig=" << B2_BENCH_CONFIG << "\nprofile=";
#if defined(BOX2D_PROFILE_PARTICLE_PROXY_ONLY)
	meta << "proxy_only";
#elif defined(BOX2D_PROFILE_PARTICLES)
	meta << "on";
#else
	meta << "off";
#endif
	meta << "\nvalidation=";
#ifdef BOX2D_VALIDATE_PARTICLE_PROXY_SORT
	meta << "on";
#else
	meta << "off";
#endif
	meta << "\nindex_bits=";
#ifdef B2_USE_16_BIT_PARTICLE_INDICES
	meta << 16;
#else
	meta << 32;
#endif
	if (o.traceIn.empty()) meta << "\nradius=0.05\nflags=water\ndt=1/60\nvelocity_iterations=8\nposition_iterations=3";
	else meta << "\ncapture_parameters=unknown (external trace)";
	meta << "\nwarmup=" << o.warmup
		<< "\ntrace_in=" << o.traceIn << "\ntrace_frames=" << o.traceFrames << '\n';
	if (!csv || !summary || !meta) throw std::runtime_error("Output write failed");
	std::cout << o.mode << ' ' << (o.traceIn.empty() ? o.scene : "external_trace") << ' ' << o.sorter << ": median " << Percentile(times, .5)
		<< " ms; p95 " << Percentile(times, .95) << " ms\n";
}

int main(int argc, char** argv)
{
	try
	{
		Options o = Parse(argc, argv);
		std::vector<Sample> samples; samples.reserve(o.steps);
		std::vector<Frame> frames;
		if (!o.traceIn.empty()) frames = LoadTrace(o.traceIn);
		if (o.mode == "world" || frames.empty())
		{
			Scene scene(o, o.mode == "replay");
			int measured = o.mode == "replay" ? o.traceFrames : o.steps;
			for (int i = -o.warmup; i < measured; ++i)
			{
				scene.Steer(o, i + o.warmup);
				if (i >= 0 && (o.mode == "replay" || !o.traceOut.empty()) && (int)frames.size() < o.traceFrames)
					frames.push_back(b2ParticleProxySortTestAccess::Capture(scene.system));
				scene.system->ResetParticleProfile();
				b2Timer timer; scene.world.Step(1.0f / 60, 8, 3, o.iterations);
				double elapsed = timer.GetMilliseconds();
				if (i >= 0 && o.mode == "world")
				{
					Sample s; s.ms = elapsed; s.count = scene.system->GetParticleCount(); s.profile = scene.system->GetParticleProfile(); samples.push_back(s);
				}
			}
		}
		if (!o.traceOut.empty()) SaveTrace(o.traceOut, frames);
		if (o.mode == "replay")
		{
			b2BlockAllocator allocator; b2ParticleProxySorter<Proxy> sorter(allocator);
			for (int i = -o.warmup; i < o.steps; ++i)
			{
				const Frame& f = frames[(i + o.warmup) % frames.size()];
				int n = (int)f.old.size(); Sample s; s.count = n;
				std::vector<Proxy> output(o.sorter != "reference" ? f.old : f.updated);
				Proxy* updated = sorter.Prepare(n, s.profile, SortMode(o));
				for (int j = 0; j < n; ++j) updated[j] = f.updated[j];
				B2_PARTICLE_STAT(s.profile.updates = 1; s.profile.particles = n);
				b2Timer timer;
				if (o.sorter != "reference") sorter.Sort(n ? &output[0] : NULL, n, f.prefix, f.valid, s.profile, SortMode(o));
				else std::sort(output.begin(), output.end());
				s.ms = timer.GetMilliseconds();
				if (o.sorter == "reference")
					B2_PARTICLE_STAT(s.profile.orderMs = s.profile.referenceSortMs = s.ms);
				// Exact membership and sortedness checks are outside timing.
				for (int j = 1; j < n; ++j) if (output[j].tag < output[j - 1].tag) throw std::runtime_error("Unsorted replay output");
				std::vector<Proxy> expected(f.updated);
				std::sort(expected.begin(), expected.end(), Canonical); std::sort(output.begin(), output.end(), Canonical);
				for (int j = 0; j < n; ++j)
					if (expected[j].index != output[j].index || expected[j].tag != output[j].tag) throw std::runtime_error("Replay membership mismatch");
				if (i >= 0) samples.push_back(s);
			}
		}
		Report(o, samples); return 0;
	}
	catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
