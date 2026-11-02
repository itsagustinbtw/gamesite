import { mkdir, rm, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const outputDir = join(scriptDir, "site");
const siteFiles = [
  "index.html",
  "about.html",
  "news.html",
  "sagboy.html",
  "sagboy/index.html",
  "game-host-config.js",
  "theme-store.js",
  "agus4.png",
  "grunge-halloween-background-with-evil-pumpkins-scary-ghost_1048-12867.avif"
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
for (const file of siteFiles) {
  const sourcePath = join(projectRoot, file);
  const destinationPath = join(outputDir, file);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}
console.log(`Prepared ${siteFiles.length} site assets in ${outputDir}`);
