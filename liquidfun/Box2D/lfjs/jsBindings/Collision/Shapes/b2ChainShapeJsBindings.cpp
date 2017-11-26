#include <Box2D/Box2D.h>

// create fixture from chain
const int MaxChainVertices = 128;
void* b2ChainShape_CreateFixture(
    void* body,
    // Fixturedef
    double density, double friction, double isSensor,
    double restitution, double userData,
    // filter
    double categoryBits, double groupIndex, double maskBits,
    // chain
    float* vertices, double length, double hasGhostVertices, double isLoop) {
  b2FixtureDef def;
  def.density = density;
  def.friction = friction;
  def.isSensor = isSensor;
  def.restitution = restitution;
  def.userData = (void*)&userData;
  def.filter.categoryBits = categoryBits;
  def.filter.groupIndex = groupIndex;
  def.filter.maskBits = maskBits;

  b2ChainShape chain;
  int count = (length / 2) - (hasGhostVertices?2:0);
  b2Vec2 vertexArr[MaxChainVertices];
  int startIndex = 0;
  for (int i = (hasGhostVertices?2:0), j = 0; i < (int)length - (hasGhostVertices?2:0); i += 2, j++) {
    vertexArr[j] = b2Vec2(vertices[i], vertices[i+1]);
  }
  if (isLoop)
    chain.CreateLoop(vertexArr, count);
  else
  {
    chain.CreateChain(vertexArr, count);
    if(hasGhostVertices)
    {
        chain.SetPrevVertex(b2Vec2(vertices[0], vertices[1]));
        chain.SetNextVertex(b2Vec2(vertices[(int)length - 2], vertices[(int)length - 1]));
    }
  }

  def.shape = &chain;
  return ((b2Body*)body)->CreateFixture(&def);
}
