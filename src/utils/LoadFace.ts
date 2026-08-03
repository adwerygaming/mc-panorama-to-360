import path from "node:path";
import sharp from "sharp";
import { LoadFaceResult } from "../types/LoadFaceResult.types.js";

export default async function loadFace(folder: string, filename: string, rotateDeg: number | null): Promise<LoadFaceResult> {
  const filePath = path.join(folder, filename);
  
  let img = sharp(filePath);
  if (rotateDeg) img = img.rotate(rotateDeg);

  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  
    return { data, width: info.width, height: info.height };
}
