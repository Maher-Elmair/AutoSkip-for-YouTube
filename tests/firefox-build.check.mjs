import { test } from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = path.join(root, "dist-firefox");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

test("Firefox package uses supported background and permissions", async () => {
  const source = await readJson(path.join(root, "public/manifest.json"));
  const manifest = await readJson(path.join(outDir, "manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.background, { scripts: ["background.js"] });
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.version, source.version);
  assert.equal(manifest.browser_specific_settings.gecko.id, source.browser_specific_settings.gecko.id);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions, { required: ["none"] });
  assert.equal(source.background.service_worker, "background.js");
  assert.ok(source.permissions.includes("debugger"));

  const html = await readFile(path.join(outDir, manifest.action.default_popup), "utf8");
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const files = [
    ...manifest.background.scripts,
    ...manifest.content_scripts.flatMap((script) => script.js),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    `_locales/${manifest.default_locale}/messages.json`,
    ...assets.map((asset) => asset.replace(/^\//, "")),
  ];
  for (const file of files) await access(path.join(outDir, file));
});

test("Firefox background initializes and responds without the debugger API", async () => {
  let listener;
  let installedListener;
  let reads = 0;
  const browser = {
    storage: {
      sync: {
        get: async () => {
          reads++;
          return { watcherEnabled: false, muteAdSound: true, blurAds: false };
        },
      },
      local: { get: async () => ({ adsSkipped: 0 }) },
    },
    runtime: {
      onInstalled: { addListener: (handler) => { installedListener = handler; } },
      onMessage: { addListener: (handler) => { listener = handler; } },
    },
  };
  const chrome = { storage: { sync: { get: () => assert.fail("Firefox must use promise-based browser APIs") } } };
  runInNewContext(await readFile(path.join(outDir, "background.js"), "utf8"), { browser, chrome, console });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads, 1);
  assert.equal(typeof installedListener, "function");
  assert.equal(typeof listener, "function");

  const state = await new Promise((resolve) => {
    assert.equal(listener({ type: "GET_WATCHER_STATE" }, {}, resolve), true);
  });
  assert.equal(state.enabled, false);
  const click = await new Promise((resolve) => {
    assert.equal(listener({ type: "SKIP_AD_TRUSTED_CLICK", x: 10, y: 20 }, { tab: { id: 1 } }, resolve), true);
  });
  assert.equal(click.success, false);
  assert.equal(click.reason, "unsupported");
});
