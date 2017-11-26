// Shape constants
export var b2Shape_Type_e_circle = 0;
export var b2Shape_Type_e_edge = 1;
export var b2Shape_Type_e_polygon = 2;
export var b2Shape_Type_e_chain = 3;
export var b2Shape_Type_e_typeCount = 4;
export var b2_linearSlop = 0.005;
export var b2_polygonRadius = 2 * b2_linearSlop;
export var b2_maxPolygonVertices = 8;

export function b2MassData(mass, center, I) {
  this.mass = mass;
  this.center = center;
  this.I = I;
}