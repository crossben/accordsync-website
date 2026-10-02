// Brand copy script (website.md section 2 and section 9). Once the owner approves the logo
// files and they move into app/docs/assets/, this copies them into
// public/brand/ at build time so there is one source of truth (never modify
// app/ from here). Until then the proposed assets in website/public/brand/
// are used as-is.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = process.env.ACCORD_APP_DIR
  ? resolve(process.env.ACCORD_APP_DIR)
  : resolve(websiteRoot, "../app");

const ASSETS = ["logo.svg", "logo-dark.svg", "mark.svg", "icon.svg", "social-preview.png"];
const sourceDir = join(appDir, "docs", "assets");

if (!existsSync(join(sourceDir, "logo.svg"))) {
  console.log(
    "[brand] app/docs/assets/ does not hold the brand files yet — using the proposed\n" +
      "[brand] assets in website/public/brand/ as-is. After the owner approves them and\n" +
      "[brand] moves them to app/docs/assets/ (see README), this script copies them here.",
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
