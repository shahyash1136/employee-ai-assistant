import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import csv from "csv-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../");

export class CsvService {
  private cache = new Map<string, unknown[]>();

  async readCsv<TRow extends object, TResult>(
    fileName: string,
    mapper: (row: TRow) => TResult,
  ): Promise<TResult[]> {
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName) as TResult[];
    }

    return new Promise((resolve, reject) => {
      const results: TResult[] = [];
      const filePath = path.join(repoRoot, "data", fileName);

      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          results.push(mapper(row as TRow));
        })
        .on("end", () => {
          this.cache.set(fileName, results);
          resolve(results);
        })
        .on("error", reject);
    });
  }

  clearCache(fileName?: string) {
    if (fileName) {
      this.cache.delete(fileName);
      return;
    }

    this.cache.clear();
  }
}

export const csvService = new CsvService();
