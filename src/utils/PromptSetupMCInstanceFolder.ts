import { input, select } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import { DatabaseService } from "../db/DatabaseService.js";

const db = new DatabaseService();

export async function promptSetupMCInstanceFolder(): Promise<string> {
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
