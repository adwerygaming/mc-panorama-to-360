import sharp from "sharp";
import { FaceData } from "../types/FaceData.types.js";

interface RenderCrossProp {
    faces: { [key: string]: FaceData };
    faceSize: number;
    outputFile: string;
}

export async function renderCross({ faces, faceSize, outputFile }: RenderCrossProp): Promise<void> {
  const cols = 4, rows = 3;
  const canvasWidth = cols * faceSize;
  const canvasHeight = rows * faceSize;
  const buffer = Buffer.alloc(canvasWidth * canvasHeight * 4, 0);

  const positions = { PY: [1, 0], NX: [0, 1], PZ: [1, 1], PX: [2, 1], NZ: [3, 1], NY: [1, 2] };

  for (const [key, [col, row]] of Object.entries(positions)) {
    const face = faces[key];
    const offsetX = col * faceSize;
    const offsetY = row * faceSize;
    for (let y = 0; y < faceSize; y++) {
      const srcY = Math.min(Math.floor((y / faceSize) * face.height), face.height - 1);
      for (let x = 0; x < faceSize; x++) {
        const srcX = Math.min(Math.floor((x / faceSize) * face.width), face.width - 1);
        const srcIdx = (srcY * face.width + srcX) * 4;
        const dstIdx = ((offsetY + y) * canvasWidth + (offsetX + x)) * 4;
        buffer[dstIdx] = face.data[srcIdx];
        buffer[dstIdx + 1] = face.data[srcIdx + 1];
        buffer[dstIdx + 2] = face.data[srcIdx + 2];
        buffer[dstIdx + 3] = face.data[srcIdx + 3];
      }
    }
  }

  await sharp(buffer, { raw: { width: canvasWidth, height: canvasHeight, channels: 4 } })
    .png()
    .toFile(outputFile);
}
