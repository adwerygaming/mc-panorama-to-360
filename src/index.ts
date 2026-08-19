/* eslint-disable @typescript-eslint/no-unnecessary-condition */
 
import { select, Separator } from '@inquirer/prompts';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { fileURLToPath } from "url";
import { DatabaseService } from './db/DatabaseService.js';
import { generateImage } from './utils/GenerateImage.js';
import { pressAnyKeyToContinue } from './utils/PressAnyKeyToContinue.js';
import { promptSetupMCInstanceFolder } from './utils/PromptSetupMCInstanceFolder.js';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

const db = new DatabaseService();

export const FACE_MAP = {
    PZ: 'panorama_0.png', // south / front
    NX: 'panorama_3.png', // west
    NZ: 'panorama_2.png', // north / back
    PX: 'panorama_1.png', // east
    PY: 'panorama_4.png', // up
    NY: 'panorama_5.png', // down
};

export const ROTATE: { [key: string]: number } = {
    PX: 0,
    NX: 0,
    PY: 0,
    NY: 0,
    PZ: 0,
    NZ: 0,
};

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

    choices.push({
        name: "Exit program",
        value: "exit",
        description: "Exit the program",
    });

    const answer = await select({
        message: 'Select your minecraft instances folder.',
        choices,
        loop: false
    });

    switch (answer) {
        case 'add_new':
            possibleMinecraftPath = await promptSetupMCInstanceFolder();
            break;

        case 'exit':
            console.clear();
            console.log("Goodbye.");
            process.exit(0);
            break;
        default:
            possibleMinecraftPath = answer;
            break;
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

    if (!outputFile) {
        console.log("Failed to generate the panorama image. Please make sure the folder contains the cube face images.");
        await pressAnyKeyToContinue();
        continue;
    }
    
    console.log("========================================");
    console.log(`Done in ${diffMs}ms.`);
    console.log(`Panorama is saved at: ${outputFile}`);
    console.log("========================================");
    console.log("Press continue to go back to instances folder selection,");
    console.log("========================================");

    await pressAnyKeyToContinue();
}
