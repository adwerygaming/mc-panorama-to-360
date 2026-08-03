import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { FaceData } from './types/FaceData.types.js';
import directionToFace from './utils/DirectionToFace.js';
import loadFace from './utils/LoadFace.js';
import sampleBilinear from './utils/SampleBilinear.js';

const FACE_MAP = {
  PZ: 'panorama_0.png', // south / front
  NX: 'panorama_1.png', // west
  NZ: 'panorama_2.png', // north / back
  PX: 'panorama_3.png', // east
  PY: 'panorama_4.png', // up
  NY: 'panorama_5.png', // down
};

const ROTATE: { [key: string]: number } = {
  PX: 0,
  NX: 0,
  PY: 0,
  NY: 0,
  PZ: 0,
  NZ: 0,
};

const outputFile = 'output.png';
const [, , inputFolder, widthArg, heightArg] = process.argv;

if (!inputFolder) {
    console.error('Usage: npm start <screenshots_folder> <output.png> [width] [height]');
    process.exit(1);
}

const outWidth = parseInt(widthArg, 10) || 4096;
const outHeight = parseInt(heightArg, 10) || 2048;

console.log('Loading 6 cube faces...');
const faces: { [key: string]: FaceData } = {};

for (const [key, filename] of Object.entries(FACE_MAP)) {
    const filePath = path.join(inputFolder, filename);
    if (!fs.existsSync(filePath)) {
        console.error(`Missing file: ${filePath}`);
        process.exit(1);
    }
    faces[key] = await loadFace(inputFolder, filename, ROTATE[key]);
    console.log(`  ${key} <- ${filename} (${faces[key].width}x${faces[key].height})`);
}

console.log(`Rendering equirectangular image at ${outWidth}x${outHeight}...`);
const outBuffer = Buffer.alloc(outWidth * outHeight * 4);

for (let j = 0; j < outHeight; j++) {
    const phi = (j / outHeight - 0.5) * Math.PI; // -pi/2 .. pi/2
    for (let i = 0; i < outWidth; i++) {
        const theta = (i / outWidth - 0.5) * 2 * Math.PI; // -pi .. pi

        const x = Math.cos(phi) * Math.sin(theta);
        const y = Math.sin(phi);
        const z = Math.cos(phi) * Math.cos(theta);

        const { face, u, v } = await directionToFace(x, y, z);
        const pixel = await sampleBilinear(faces[face], u, v);

        const outIdx = (j * outWidth + i) * 4;
        outBuffer[outIdx] = pixel[0];
        outBuffer[outIdx + 1] = pixel[1];
        outBuffer[outIdx + 2] = pixel[2];
        outBuffer[outIdx + 3] = pixel[3];
    }
    if (j % 256 === 0) console.log(`  row ${j}/${outHeight}`);
}

await sharp(outBuffer, { raw: { width: outWidth, height: outHeight, channels: 4 } })
    .png()
    .toFile(outputFile);

console.log(`Done. Saved to ${outputFile}`);
