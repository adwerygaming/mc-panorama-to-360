import fs from 'fs';
import path from "path";
import { QuickDB } from "quick.db";

const dbFolderPath = path.join(process.cwd(), "db");
if (!fs.existsSync(dbFolderPath)) fs.mkdirSync(dbFolderPath, { recursive: true });
const dbFilePath = path.join(dbFolderPath, "mcpano.sqlite");

export const db = new QuickDB({ filePath: dbFilePath });
