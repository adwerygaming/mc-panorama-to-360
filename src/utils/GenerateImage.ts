import fs from 'fs';
import path from "node:path";
import sharp from 'sharp';
import { FACE_MAP, ROTATE, __dirname } from '../index.js';
import { LoadFaceResult } from '../types/LoadFaceResult.types.js';
import directionToFace from './DirectionToFace.js';
import loadFace from './LoadFace.js';
import sampleBilinear from './SampleBilinear.js';

export async function generateImage(folderPath: string, width?: number, height?: number): Promise<string | null> {
    const outputFolder = path.join(__dirname, "..", 'output');

    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);

    const outputFileName = `output-${Date.now()}.png`;
    const outputFilePath = path.join(outputFolder, outputFileName);

    const folderExist = fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();

    if (!folderPath || !folderExist) {
        return null;
    }

    console.log('Loading 6 cube faces...');

    const faces: { [key: string]: LoadFaceResult } = {};
    for (const [key, filename] of Object.entries(FACE_MAP)) {
        const filePath = path.join(folderPath, filename);
        if (!fs.existsSync(filePath)) {
            console.error(`Missing file: ${filePath}`);
            return null;
        }

        faces[key] = await loadFace(folderPath, filename, ROTATE[key]);
        console.log(`-> ${filename} (${key}, ${faces[key].width}x${faces[key].height})`);
    }

    const outWidth = width || 4096;
    const outHeight = height || 2048;

    console.log("");
    console.log(`Rendering equirectangular image at ${outWidth}x${outHeight}...`);

    const outBuffer = Buffer.alloc(outWidth * outHeight * 4);

    for (let j = 0; j < outHeight; j++) {
        const phi = (0.5 - j / outHeight) * Math.PI; // +pi/2 (top/up) .. -pi/2 (bottom/down)
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

        if (j % 256 === 0) console.log(`-> row ${j}/${outHeight}`);
    }

    await sharp(outBuffer, { raw: { width: outWidth, height: outHeight, channels: 4 } })
        .png()
        .toFile(outputFilePath);

    return outputFilePath;
}
