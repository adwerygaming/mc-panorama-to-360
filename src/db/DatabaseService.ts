import { db } from "./Client.js";

export interface HistoryEntry {
    timestamp: number;
    folderPath: string;
}

export class DatabaseService {
    async addHistoryEntry(folderPath: string): Promise<HistoryEntry> {
        const data: HistoryEntry = {
            timestamp: Date.now(),
            folderPath
        };

        await db.push("history", data);

        return data;
    }

    async getHistoryEntries(): Promise<HistoryEntry[]> {
        const data = await db.get<HistoryEntry[]>("history");
        return data || [];
    }

    async getHistoryEntryByFolderPath(folderPath: string): Promise<HistoryEntry | undefined> {
        const historyEntries = await this.getHistoryEntries();
        return historyEntries.find(entry => entry.folderPath === folderPath);
    }

    async isLastUsed(folderPath: string): Promise<boolean> {
        const lastUsedFolder = await db.get<string>("lastUsedFolder");
        return lastUsedFolder === folderPath;
    }

    async setLastUsedFolder(folderPath: string): Promise<void> {
        await db.set("lastUsedFolder", folderPath);
    }
}
