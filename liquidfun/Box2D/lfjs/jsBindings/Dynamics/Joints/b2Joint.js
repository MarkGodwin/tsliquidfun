export var e_unknownJoint = 0;
export var e_revoluteJoint = 1;
export var e_prismaticJoint = 2;
export var e_distanceJoint = 3;
export var e_pulleyJoint = 4;
export var e_mouseJoint = 5;
export var e_gearJoint = 6;
export var e_wheelJoint = 7;
export var e_weldJoint = 8;
export var e_frictionJoint = 9;
export var e_ropeJoint = 10;
export var e_motorJoint = 11;

var b2Joint_GetBodyA = Module.cwrap('b2Joint_GetBodyA', 'number', ['number']);
var b2Joint_GetBodyB = Module.cwrap('b2Joint_GetBodyB', 'number', ['number']);

/**@constructor*/
export function b2Joint() {}

b2Joint.prototype.GetBodyA = function() {
  return world.bodiesLookup[b2Joint_GetBodyA(this.ptr)];
};

b2Joint.prototype.GetBodyB = function() {
  return world.bodiesLookup[b2Joint_GetBodyB(this.ptr)];
};