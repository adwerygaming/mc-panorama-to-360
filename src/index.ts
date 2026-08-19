/* eslint-disable @typescript-eslint/no-unnecessary-condition */
 
import { input, select, Separator } from '@inquirer/prompts';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from "url";
import { DatabaseService } from './db/DatabaseService.js';
import { LoadFaceResult } from './types/LoadFaceResult.types.js';
import directionToFace from './utils/DirectionToFace.js';
import loadFace from './utils/LoadFace.js';
import sampleBilinear from './utils/SampleBilinear.js';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

const db = new DatabaseService();

const FACE_MAP = {
    PZ: 'panorama_0.png', // south / front
    NX: 'panorama_3.png', // west
    NZ: 'panorama_2.png', // north / back
    PX: 'panorama_1.png', // east
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

async function pressAnyKeyToContinue(): Promise<void> {
    await input({ message: 'Press any key to continue...', validate: () => true });
}

while (true) {
    console.clear();

    console.log("Minecraft Panorama to 360 Image Converter");
    console.log("");

    const appdataPath = os.homedir();
    let possibleMinecraftPath;

    const osType = os.type();
    switch (osType) {
        case 'Windows_NT':
            possibleMinecraftPath = path.join(appdataPath, 'AppData', 'Roaming', '.minecraft');
            break;
        case 'Darwin':
            possibleMinecraftPath = path.join(appdataPath, 'Library', 'Application Support', 'minecraft');
            break;
        case 'Linux':
            possibleMinecraftPath = path.join(appdataPath, '.minecraft');
            break;
        default:
            console.error(`Unsupported OS: ${osType}`);
            process.exit(1);
    }

    const choices = [];
    const mcPathExists = fs.existsSync(possibleMinecraftPath) && fs.statSync(possibleMinecraftPath).isDirectory();
    if (mcPathExists) {
        choices.push({
            name: "Use default Minecraft path",
            value: possibleMinecraftPath,
            description: `Found Default Minecraft path at ${possibleMinecraftPath}`,
        });

        choices.push(new Separator());
    }

    const historyEntries = await db.getHistoryEntries();
    for (const entry of historyEntries) {
        const isLastUsed = await db.isLastUsed(entry.folderPath);
        
        if (fs.existsSync(entry.folderPath) && fs.statSync(entry.folderPath).isDirectory()) {
            choices.push({
                name: `${entry.folderPath} ${isLastUsed ? "(last used)" : ""}`,
                value: entry.folderPath,
                description: `Last used at ${new Date(entry.timestamp).toLocaleString()}`,
            });
        }
    }

    if (choices.length === 0) {
        console.log("No default Minecraft path found. Please add a new minecraft instances folder.");
    }

    choices.push(new Separator());
    choices.push({
        name: "Add new minecraft instances folder",
        value: "add_new",
        description: "Add a new minecraft instances folder",
    });

    const answer = await select({
        message: 'Select your minecraft instances folder.',
        choices,
        loop: false
    });

    if (answer === "add_new") {
        possibleMinecraftPath = await promptSetupMCInstanceFolder();
    } else {
        possibleMinecraftPath = answer;
    }

    await db.setLastUsedFolder(possibleMinecraftPath);

    const panoDir = path.join(possibleMinecraftPath, 'panoramas', 'screenshots');
    if (!fs.existsSync(panoDir) || !fs.statSync(panoDir).isDirectory()) {
        console.log(`Can't found the 5 cube faces in ${panoDir}. Please make sure the folder exists and contains the 5 cube face images.`);
        console.log(`Recommended to use Mod such as Panorama ScreenMake to capture the panorama.`);
        console.log(`Check it out on Modrinth: https://modrinth.com/mod/panorama_screen`);

        await pressAnyKeyToContinue();
        continue;
    }

    const startTime = Date.now();
    const outputFile = await generateImage(panoDir);
    const endTime = Date.now();
    const diffMs = endTime - startTime;
    
    console.log("========================================");
    console.log(`Done in ${diffMs}ms.`);
    console.log(`Panorama is saved at: ${outputFile}`);
    console.log("========================================");
    console.log("Press continue to go back to instances folder selection,");
    console.log("========================================");

    await pressAnyKeyToContinue();
}

async function promptSetupMCInstanceFolder(): Promise<string> {
    console.log("Example paths:");
    console.log("-> Windows: C:\\Users\\<username>\\AppData\\Roaming\\.minecraft");
    console.log("-> Mac: /Users/<username>/Library/Application Support/minecraft");
    console.log("-> Linux: /home/<username>/.minecraft");
    console.log("");

    const mcInstancePath = await input({
        message: 'Enter the path to your minecraft instances folder (ends with .minecraft):',
        validate: (input) => {
            if (!input || input.trim() === '') return 'Path cannot be empty.';
            
            const resolvedPath = path.resolve(input);
            if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) return 'Invalid path. Please enter a valid directory.';
            
            return true;
        }
    });

    const verification = await select({
        message: `You entered: ${mcInstancePath}. Is this correct?`,
        choices: [
            { name: 'Yes', value: true },
            { name: 'No', value: false }
        ]
    });

    if (!verification) {
        return await promptSetupMCInstanceFolder();
    }

    const dupCheck = await db.getHistoryEntryByFolderPath(mcInstancePath);
    if (!dupCheck) {
        await db.addHistoryEntry(mcInstancePath);
        console.log(`Added ${mcInstancePath} to history.`);        
    }

    return mcInstancePath;
}

async function generateImage(folderPath: string, width?: number, height?: number): Promise<string | null> {
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
            process.exit(1);
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
