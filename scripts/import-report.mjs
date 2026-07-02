import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("usage: npm run import-report -- /path/to/benchmark-report.json");
  process.exit(2);
}

const raw = await readFile(source, "utf8");
const report = JSON.parse(raw);
if (report.schema_version !== "1.0" || !report.run_id) {
  console.error("input is not an imagent benchmark report");
  process.exit(1);
}

const destinationDir = path.join(process.cwd(), "data", "reports");
await mkdir(destinationDir, { recursive: true });
const destination = path.join(destinationDir, `${report.run_id}.json`);
await copyFile(source, destination);
console.log(destination);
