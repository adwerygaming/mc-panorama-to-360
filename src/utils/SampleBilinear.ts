import { FaceData } from "../types/FaceData.types.js";

export default async function sampleBilinear(face: FaceData, u: number, v: number): Promise<number[]> {
  const x = u * (face.width - 1);
  const y = v * (face.height - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, face.width - 1);
  const y1 = Math.min(y0 + 1, face.height - 1);
  const fx = x - x0, fy = y - y0;

  const idx = (xx: number, yy: number): number => (yy * face.width + xx) * 4;
  const out = [0, 0, 0, 0];

  for (let c = 0; c < 4; c++) {
    const p00 = face.data[idx(x0, y0) + c];
    const p10 = face.data[idx(x1, y0) + c];
    const p01 = face.data[idx(x0, y1) + c];
    const p11 = face.data[idx(x1, y1) + c];
    const top = p00 * (1 - fx) + p10 * fx;
    const bot = p01 * (1 - fx) + p11 * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}
