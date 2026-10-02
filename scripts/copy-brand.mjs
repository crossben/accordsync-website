// Brand copy script (website.md section 2 and section 9). Once the owner approves the logo
// files and they move into app/docs/assets/, this copies them into
// public/brand/ at build time so there is one source of truth (never modify
// app/ from here). Until then the proposed assets in website/public/brand/
// are used as-is.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Reads the committed snapshot (accord/), refreshed by `npm run sync:app`.
const appDir = resolve(websiteRoot, "accord");

const ASSETS = ["logo.svg", "logo-dark.svg", "mark.svg", "icon.svg", "social-preview.png"];
const sourceDir = join(appDir, "docs", "assets");

if (!existsSync(join(sourceDir, "logo.svg"))) {
  console.log(
    "[brand] accord/docs/assets/ (the snapshot) does not hold the brand files yet —\n" +
      "[brand] using the proposed assets in website/public/brand/ as-is. After the owner\n" +
      "[brand] approves them and moves them to app/docs/assets/ (see README), run\n" +
      "[brand] `npm run sync:app` and this script copies them from the snapshot.",
  );
  process.exit(0);
}

mkdirSync(join(websiteRoot, "public", "brand"), { recursive: true });
for (const name of ASSETS) {
  if (existsSync(join(sourceDir, name))) {
    copyFileSync(join(sourceDir, name), join(websiteRoot, "public", "brand", name));
  }
}
console.log(`[brand] Copied ${ASSETS.join(", ")} from ${sourceDir} to public/brand/.`);
