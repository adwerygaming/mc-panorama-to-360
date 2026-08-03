import { DirectionToFaceResult } from "../types/DirectionToFaceResult.types.js";

export default async function directionToFace(x: number, y: number, z: number): Promise<DirectionToFaceResult> {
  const absX = Math.abs(x), absY = Math.abs(y), absZ = Math.abs(z);
  let face, uc, vc, maxAxis;

  if (absX >= absY && absX >= absZ) {
    maxAxis = absX;
    if (x > 0) { face = 'PX'; uc = -z; vc = y; }
    else { face = 'NX'; uc = z; vc = y; }
  } else if (absY >= absX && absY >= absZ) {
    maxAxis = absY;
    if (y > 0) { face = 'PY'; uc = x; vc = -z; }
    else { face = 'NY'; uc = x; vc = z; }
  } else {
    maxAxis = absZ;
    if (z > 0) { face = 'PZ'; uc = x; vc = y; }
    else { face = 'NZ'; uc = -x; vc = y; }
  }

  const u = 0.5 * (uc / maxAxis + 1);
  const v = 0.5 * (1 - vc / maxAxis);
  return { face, u, v };
}
