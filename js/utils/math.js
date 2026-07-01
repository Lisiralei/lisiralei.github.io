export const TWO_PI = Math.PI * 2;
export const QUARTER_TURN = Math.PI / 2;

export function normalizeAngle(angle) {
  if (angle < 0) {
    return TWO_PI - (Math.abs(angle) % TWO_PI);
  }
  return angle % TWO_PI;
}

export function radToDegrees(rad){
  return rad * 180/Math.PI;
}

export function cartesianToLatLng([x, y, z]) {
  const radius = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  return [
    radius,
    (Math.PI / 2) - Math.acos(y / radius),
    normalizeAngle(Math.atan2(x, -z)),
  ];
}

export function latLngToCartesian([radius, lat, lng]){
  lng = -lng + Math.PI / 2;
  return [
    radius * Math.cos(lat) * Math.cos(lng),
    radius * Math.sin(lat),
    radius * -Math.cos(lat) * Math.sin(lng),
  ];
}

export function clamp(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  return Math.max(Math.min(value, max), min);
}

export function wrap(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const range = max - min;
  return value < min
    ? max - Math.abs(min - value) % range
    : min + (value + range) % range;
}

export function mirrorWrap(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const range = max - min;
  const minDistance = Math.abs(min - value);
  const intervalValue = minDistance % range;
  if (value % (max + max) > max) return max - intervalValue //too high (mirrored)
  if (value >= max) return min + intervalValue; //to high (unmirrored)
  if (value < min && minDistance % (range + range) > range) return max - intervalValue; //too low (mirrored)
  if (value <= min) return min + intervalValue; //to low (mirrored)
  return value;
}

export function lerp(start, end, normalValue) {
  return start + (end - start) * normalValue;
}

export function inverseLerp(start, end, value) {
  return (value - start) / (end - start);
}

export function normalizeNumber(num, len){
  num = parseFloat(num.toFixed(len));
  num = num === -0 ? 0 : num;

  return num;
}

export function vectorSquaredDistance(vectorA, aIndex, vectorB, bIndex) {
  aIndex *= 3;
  bIndex *= 3;
  let a0 = vectorA[aIndex] - vectorB[bIndex],
    a1 = vectorA[aIndex + 1] - vectorB[bIndex + 1],
    a2 = vectorA[aIndex + 2] - vectorB[bIndex + 2];
  return a0 * a0 + a1 * a1 + a2 * a2;
}

export function vecAdd(vectorA, aIndex, vectorB, bIndex, scale = 1.0) {
  aIndex *= 3;
  bIndex *= 3;
  vectorA[aIndex++] += vectorB[bIndex++] * scale;
  vectorA[aIndex++] += vectorB[bIndex++] * scale;
  vectorA[aIndex] += vectorB[bIndex] * scale;
}

export function vecSetDiff(dst, dIndex, a, aIndex, b, bIndex, scale = 1.0) {
  dIndex *= 3;
  aIndex *= 3;
  bIndex *= 3;
  dst[dIndex++] = (a[aIndex++] - b[bIndex++]) * scale;
  dst[dIndex++] = (a[aIndex++] - b[bIndex++]) * scale;
  dst[dIndex] = (a[aIndex] - b[bIndex]) * scale;
}

/**
 * Find the length of a 3-element vector within an array
 */
export function vecLengthSquared(vectorArray, index) {
  index *= 3;
  let a0 = vectorArray[index],
    a1 = vectorArray[index + 1],
    a2 = vectorArray[index + 2];
  return a0 * a0 + a1 * a1 + a2 * a2;
}

export function vecSetCross(a, aIndex, b, bIndex, c, cIndex) {
  aIndex *= 3;
  bIndex *= 3;
  cIndex *= 3;
  a[aIndex++] = b[bIndex + 1] * c[cIndex + 2] - b[bIndex + 2] * c[cIndex + 1];
  a[aIndex++] = b[bIndex + 2] * c[cIndex + 0] - b[bIndex + 0] * c[cIndex + 2];
  a[aIndex] = b[bIndex + 0] * c[cIndex + 1] - b[bIndex + 1] * c[cIndex + 0];
}

export function vecScale(a, aIndex, scale = 1.0) {
  aIndex *= 3;
  a[aIndex++] *= scale;
  a[aIndex++] *= scale;
  a[aIndex] *= scale;
}

/**
 * Copy a 3-element vector from inside an array
 */
export function vecCopy(a, aIndex, b, bIndex) {
  aIndex *= 3;
  bIndex *= 3;
  a[aIndex++] = b[bIndex++];
  a[aIndex++] = b[bIndex++];
  a[aIndex] = b[bIndex];
}

