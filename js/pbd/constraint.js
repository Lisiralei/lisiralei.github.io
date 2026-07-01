import {vecAdd, vectorSquaredDistance, vecLengthSquared, vecSetDiff} from "../utils/math.js";

export class Constraint {
  positions; // Float32Array
  invMass; // Float32Array
  indices; // Uint16Array
  neighbors; // Float32Array
  grads; // Float32Array
  compliance; // number
  edgeIds; // Uint16Array
  edgeLengths; // Float32Array

  constructor(positions, invMass, indices, neighbors, compliance) {
    this.positions = positions;
    this.invMass = invMass;
    this.indices = indices;
    this.neighbors = neighbors;
    this.compliance = compliance;
    this.grads = new Float32Array(12);
    this.edgeIds = this.getEdgeIds();
    this.edgeLengths = new Float32Array(this.edgeIds.length / 2);
    this.initializeEdgeLengths();
  }

  solve(dt) {
    const alpha = this.compliance / dt / dt;
    for (let i = 0; i < this.edgeLengths.length; i++) {
      const id0 = this.edgeIds[2 * i];
      const id1 = this.edgeIds[2 * i + 1];
      const w0 = this.invMass[id0];
      const w1 = this.invMass[id1];
      const w = w0 + w1;
      if (w === 0.0) continue;

      vecSetDiff(this.grads, 0, this.positions, id0, this.positions, id1);
      const len = Math.sqrt(vecLengthSquared(this.grads, 0));
      if (len === 0.0) continue;
      const restLen = this.edgeLengths[i];
      const C = len - restLen;
      const normalizingFactor = 1.0 / len;
      const s = (-C / (w + alpha)) * normalizingFactor;
      vecAdd(this.positions, id0, this.grads, 0, s * w0);
      vecAdd(this.positions, id1, this.grads, 0, -s * w1);
    }
  }

  // Calculate and initialize rest lengths of distance constraints
  initializeEdgeLengths() {
    for (let i = 0; i < this.edgeLengths.length; i++) {
      const id0 = this.edgeIds[2 * i];
      const id1 = this.edgeIds[2 * i + 1];
      this.edgeLengths[i] = Math.sqrt(
        vectorSquaredDistance(this.positions, id0, this.positions, id1)
      );
    }
  }

  // Get edge ids for distance constraints
  getEdgeIds() {
    const edgeIds = [];
    const numTris = this.indices.length / 3;
    for (let i = 0; i < numTris; i++) {
      for (let j = 0; j < 3; j++) {
        // This is one edge of a triangle id0 ------- id1
        const id0 = this.indices[3 * i + j];
        const id1 = this.indices[3 * i + ((j + 1) % 3)];

        // add each edge only once
        const n = this.neighbors[3 * i + j];
        if (n < 0 || id0 < id1) {
          edgeIds.push(id0);
          edgeIds.push(id1);
        }
      }
    }
    return new Uint16Array(edgeIds);
  }
}



