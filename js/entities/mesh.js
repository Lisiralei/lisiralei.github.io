import { multiplyMatrix, getIdentityMatrix, getTranslationMatrix, getScaleMatrix, getRotationXMatrix, getRotationYMatrix, getRotationZMatrix, getTranspose } from "../utils/vector.js";
import {vecAdd, vecCopy, vecLengthSquared, vecScale, vecSetCross, vecSetDiff} from "../utils/math.js";
import {Constraint} from "../pbd/constraint.js";

export class Mesh {
  #positions;
  #colors;
  #uvs;
  #indices;
  #length;
  #particleCount;
  #prevPositions;
  #velocities;
  #inverseMass;
  #neighbors;
  #fixedParticles;

  #transforms = [];
  #constraints = [];

  constructor(mesh) {
    this.positions = mesh.positions;
    this.prevPositions =  mesh.positions;
    this.colors =  mesh.colors;
    this.uvs = mesh.uvs;
    this.#fixedParticles = mesh.fixedParticles;
    this.indices = mesh.indices;
    this.length = mesh.length;

    this.particleCount = this.positions.length / 3;
    this.velocities = new Float32Array(3 * this.particleCount);

    this.#inverseMass = this.initInverseMass();

    for (const fixedParticle of this.#fixedParticles) {
      this.inverseMass[fixedParticle] = 0.0;
    }

    this.#neighbors = this.findTriNeighbors();
  }

  set positions(val) {
    this.#positions = new Float32Array(val);
  }
  get positions() {
    return this.#positions;
  }

  set prevPositions(val) {
    this.#prevPositions = new Float32Array(val);
  }
  get prevPositions() {
    return this.#prevPositions;
  }

  set particleCount(val) {
    this.#particleCount = val;
  }
  get particleCount() {
    return this.#particleCount;
  }

  set velocities(val) {
    this.#velocities = new Float32Array(val);
  }
  get velocities() {
    return this.#velocities;
  }

  set inverseMass(val) {
    this.#inverseMass = new Float32Array(val);
  }
  get inverseMass() {
    return this.#inverseMass;
  }
  set neighbors(val) {
    this.#neighbors = new Float32Array(val);
  }
  get neighbors() {
    return this.#neighbors;
  }
  set constraints(val) {
    this.#constraints = new Array(val);
  }
  get constraints() {
    return this.#constraints;
  }

  set colors(val) {
    this.#colors = new Float32Array(val);
  }
  get colors() {
    return this.#colors;
  }

  set uvs(val) {
    this.#uvs = new Float32Array(val);
  }
  get uvs() {
    return this.#uvs;
  }

  set indices(val) {
    this.#indices = new Uint16Array(val);
  }
  get indices() {
    return this.#indices;
  }

  set length(val){
    this.#length = val;
  }
  get length(){
    return this.#length;
  }

  initInverseMass() {
    const invMass = new Float32Array(this.particleCount);
    const numTris = this.indices.length / 3;
    const edge0 = [0.0, 0.0, 0.0]; // edge 0 vector
    const edge1 = [0.0, 0.0, 0.0]; // edge 1 vector
    const crossVector = [0.0, 0.0, 0.0]; // cross vector of e0 x e1

    for (let i = 0; i < numTris; i++) {
      const id0 = this.indices[3 * i];
      const id1 = this.indices[3 * i + 1];
      const id2 = this.indices[3 * i + 2];

      // Find Area of Triangle
      // Calculate edge vectors from id0
      vecSetDiff(edge0, 0, this.positions, id1, this.positions, id0);
      vecSetDiff(edge1, 0, this.positions, id2, this.positions, id0);

      // Area of triangle 1/2 |AB x AC|
      vecSetCross(crossVector, 0, edge0, 0, edge1, 0);
      const magnitude = 0.5 * Math.sqrt(vecLengthSquared(crossVector, 0)); // magnitude of cross vector

      // Divide mass among 3 points in triangle
      const pInvMass = Math.max(1.0 / magnitude / 3.0, 0.0);

      // Add since vertices may be shared
      invMass[id0] += pInvMass;
      invMass[id1] += pInvMass;
      invMass[id2] += pInvMass;
    }

    return invMass;
  }

  findTriNeighbors() {
    const edges = [];
    const trisCount = this.indices.length / 3;

    for (let i = 0; i < trisCount; i++) {
      for (let j = 0; j < 3; j++) {
        const id0 = this.indices[3 * i + j];
        const id1 = this.indices[3 * i + ((j + 1) % 3)];
        edges.push({
          id0: Math.min(id0, id1), // particle 1
          id1: Math.max(id0, id1), // particle 2
          edgeCount: 3 * i + j, // global edge number
        });
      }
    }
    // sort so common edges are next to each other
    edges.sort((a, b) =>
      a.id0 < b.id0 || (a.id0 === b.id0 && a.id1 < b.id1) ? -1 : 1
    );

    // find matching edges
    const neighbors = new Float32Array(3 * trisCount);
    neighbors.fill(-1); // -1 means open edge, as in no neighbors

    let i = 0;
    while (i < edges.length) {
      const e0 = edges[i];
      const e1 = edges[i + 1];

      // If the particles share the same edge, update the neighbors list
      // with their neighbors corresponding global edge number
      if (e0.id0 === e1.id0 && e0.id1 === e1.id1) {
        neighbors[e0.edgeCount] = e1.edgeCount;
        neighbors[e1.edgeCount] = e0.edgeCount;
      }
      i += 2;
    }

    return neighbors;
  }

  createDistanceConstraint(compliance){
    this.constraints.push(
      new Constraint(this.positions, this.inverseMass, this.indices, this.neighbors, compliance)
    );
  }

  translate({ x = 0, y = 0, z = 0 }) {
    this.#transforms.push(getTranslationMatrix(x, y ,z));
    return this;
  }

  scale({ x = 1, y = 1, z = 1 }) {
    this.#transforms.push(getScaleMatrix(x, y, z));
    return this;
  }

  rotate({ x, y, z }) {
    if (x) {
      this.#transforms.push(getRotationXMatrix(x));
    }
    if (y) {
      this.#transforms.push(getRotationYMatrix(y));
    }
    if (z) {
      this.#transforms.push(getRotationZMatrix(z));
    }
    return this;
  }

  resetTransforms() {
    this.#transforms = [];
  }

  getModelMatrix() {
    const modelMatrix = this.#transforms.reduce((mm, tm) => multiplyMatrix(tm, mm), getIdentityMatrix());
    return getTranspose(modelMatrix, [4,4]);
  }

  normalizePositions(){
    let max = -Infinity;

    for(let i = 0; i < this.#positions.length; i += 3){
      const x = this.#positions[i];
      const y = this.#positions[i + 1];
      const z = this.#positions[i + 2];

      if(x > max){
        max = x;
      }
      if (y > max) {
        max = y;
      }
      if (z > max) {
        max = z;
      }
    }

    for(let i = 0; i < this.#positions.length; i++){
      this.#positions[i] /= max;
    }

    return this;
  }

  preSolve(dt, force) {
    for (let i = 0; i < this.particleCount; i++) {
      if (this.inverseMass[i] === 0.0) continue;

      vecAdd(this.velocities, i, force, 0, dt);
      const v = Math.sqrt(vecLengthSquared(this.velocities, i));
      const maxV = 0.2 * (0.01 / dt);
      if (v > maxV) {
        vecScale(this.velocities, i, maxV / v);
      }
      vecCopy(this.prevPositions, i, this.positions, i);
      vecAdd(this.positions, i, this.velocities, i, dt);
    }
  }

  solve(dt) {
    for (const constraint of this.constraints) {
      constraint.solve(dt);
    }
  }


  postSolve(dt) {
    for (let i = 0; i < this.particleCount; i++) {
      if (this.inverseMass[i] === 0.0) continue;

      vecSetDiff(this.velocities, i, this.positions, i, this.prevPositions, i, 1.0 / dt);
    }
  }
}
