import { build } from "vite";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(root, "dist-firefox");

// Reuse the same sources and Vite configs without touching the Chromium build.
for (const [index, config] of [
  "vite.config.ts",
  "vite.content.config.ts",
  "vite.background.config.ts",
].entries()) {
  await build({
    root,
    configFile: path.join(root, config),
    ...(index > 0 ? { publicDir: false } : {}),
    build: { outDir, emptyOutDir: index === 0 },
  });
}

const manifest = JSON.parse(await readFile(path.join(root, "public/manifest.json"), "utf8"));
manifest.background = { scripts: ["background.js"] };
manifest.permissions = manifest.permissions.filter((permission) => permission !== "debugger");
manifest.browser_specific_settings.gecko.data_collection_permissions = { required: ["none"] };
await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
