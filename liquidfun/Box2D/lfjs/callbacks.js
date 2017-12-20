// todo see if switching to function ptrs is faster
mergeInto(LibraryManager.library, {
  b2WorldBeginContactBody: function(worldPtr, contactPtr) {
    b2World.BeginContactBody(worldPtr, contactPtr);
  },
  b2WorldEndContactBody: function(worldPtr, contactPtr) {
    b2World.EndContactBody(worldPtr, contactPtr);
  },
  b2WorldPreSolve: function(worldPtr, contactPtr, oldManifoldPtr) {
    b2World.PreSolve(worldPtr, contactPtr, oldManifoldPtr);
  },
  b2WorldPostSolve: function(worldPtr, contactPtr, impulsePtr) {
    b2World.PostSolve(worldPtr, contactPtr, impulsePtr);
  },
  b2WorldQueryAABB: function(worldPtr, fixturePtr) {
    return b2World.QueryAABB(worldPtr, fixturePtr);
  },
  b2WorldRayCastCallback: function(worldPtr, fixturePtr, pointX, pointY,
                                   normalX, normalY, fraction) {
    return b2World.RayCast(worldPtr, fixturePtr, pointX, pointY, normalX, normalY, fraction);
  }
});