import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const languages = [
  { code: "en", chromeLocale: "en", name: "English" },
  { code: "ar", chromeLocale: "ar", name: "العربية" },
  { code: "de", chromeLocale: "de", name: "Deutsch" },
  { code: "es", chromeLocale: "es", name: "Español" },
  { code: "fr", chromeLocale: "fr", name: "Français" },
  { code: "ja", chromeLocale: "ja", name: "日本語" },
  { code: "ko", chromeLocale: "ko", name: "한국어" },
  { code: "pt-BR", chromeLocale: "pt_BR", name: "Português (Brasil)" },
  { code: "zh-CN", chromeLocale: "zh_CN", name: "简体中文" },
  { code: "zh-TW", chromeLocale: "zh_TW", name: "繁體中文" },
];

function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

function translations(code: string): Record<string, string> {
  return readJson(`src/locales/${code}/translation.json`);
}

test("all UI catalogs and Chrome metadata are complete", () => {
  const keys = Object.keys(translations("en")).sort();
  const metadataKeys = Object.keys(readJson("public/_locales/en/messages.json")).sort();
  const directories = (path: string) =>
    readdirSync(fileURLToPath(new URL(path, root)), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

  expect(directories("src/locales/")).toEqual(languages.map((lang) => lang.code).sort());
  expect(directories("public/_locales/")).toEqual(languages.map((lang) => lang.chromeLocale).sort());

  for (const language of languages) {
    const catalog = translations(language.code);
    expect(Object.keys(catalog).sort(), language.code).toEqual(keys);
    for (const [key, value] of Object.entries(catalog)) {
      expect(typeof value, `${language.code}.${key}`).toBe("string");
      expect(value.trim(), `${language.code}.${key}`).not.toBe("");
    }

    const metadata = readJson(`public/_locales/${language.chromeLocale}/messages.json`);
    expect(Object.keys(metadata).sort(), language.chromeLocale).toEqual(metadataKeys);
    for (const key of metadataKeys) {
      expect(metadata[key].message.trim(), `${language.chromeLocale}.${key}`).not.toBe("");
    }
    expect(metadata.extensionName.message.length).toBeLessThanOrEqual(75);
    expect(metadata.extensionDescription.message.length).toBeLessThanOrEqual(132);
  }
});

test("the manifest uses localized extension metadata", () => {
  const manifest = readJson("public/manifest.json");
  expect(manifest.default_locale).toBe("en");
  expect(manifest.name).toBe("__MSG_extensionName__");
  expect(manifest.description).toBe("__MSG_extensionDescription__");
  expect(manifest.action.default_title).toBe("__MSG_extensionName__");
});

const browserLocales = [
  ["en-US", "en"],
  ["ar-EG", "ar"],
  ["de-DE", "de"],
  ["es-MX", "es"],
  ["fr-CA", "fr"],
  ["ja-JP", "ja"],
  ["ko-KR", "ko"],
  ["pt-PT", "pt-BR"],
  ["zh", "zh-CN"],
  ["zh-SG", "zh-CN"],
  ["zh-TW", "zh-TW"],
  ["zh-HK", "zh-TW"],
  ["zh-MO", "zh-TW"],
  ["zh-Hant", "zh-TW"],
  ["zh-Hans-TW", "zh-CN"],
  ["it-IT", "en"],
];

for (const [locale, expected] of browserLocales) {
  test.describe(`browser locale ${locale}`, () => {
    test.use({ locale });
    test(`resolves to ${expected} with a selected language`, async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("lang", expected);
      await expect(page.locator("html")).toHaveAttribute("dir", expected === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { name: translations(expected).settings, exact: true })).toBeVisible();
      await expect(page.getByRole("combobox")).toHaveValue(expected);
      await expect(page.locator("select option:checked")).toHaveText(languages.find((language) => language.code === expected)!.name);
    });
  });
}

test("uses a supported secondary browser language before English fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "languages", { value: ["it-IT", "fr-CA"] });
    Object.defineProperty(navigator, "language", { value: "it-IT" });
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("combobox")).toHaveValue("fr");
});

test("normalizes saved language aliases without losing the Chinese script", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "ZH_hAnT_HK"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
  await expect(page.getByRole("combobox")).toHaveValue("zh-TW");
});

test("every language can be selected and survives a reload", async ({ page }) => {
  await page.goto("/");
  for (const language of languages) {
    await page.getByRole("combobox").selectOption(language.code);
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
    await expect(page.locator("html")).toHaveAttribute("dir", language.code === "ar" ? "rtl" : "ltr");
    await expect(page.getByRole("heading", { name: translations(language.code).settings, exact: true })).toBeVisible();
    await expect.poll(async () => page.getByRole("radio").evaluateAll((buttons) =>
      buttons.length === 3 && buttons.every((button) => {
        const label = button.lastElementChild;
        if (!label) return false;
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const bounds = button.getBoundingClientRect();
        return text.left >= bounds.left - 0.5 && text.right <= bounds.right + 0.5;
      }),
    ), { message: `${language.code} skip-mode labels fit their buttons` }).toBe(true);
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue(language.code);
    await expect(page.locator("select option:checked")).toHaveText(language.name);
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
  }
});

test("the native language control fits the popup and supports keyboard selection", async ({ page }) => {
  await page.goto("/");
  const select = page.getByRole("combobox");
  await expect(select).toHaveAccessibleName(translations("en").language);
  await expect(select.locator("option")).toHaveText(languages.map((language) => language.name));
  expect(await select.locator("option").evaluateAll((options) =>
    options.map((option) => option.getAttribute("value")),
  )).toEqual(languages.map((language) => language.code));

  await select.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await select.click();
  await page.keyboard.press("Escape");
  await expect(select).toHaveValue("en");
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - scrollBefore)).toBeLessThanOrEqual(1);
  await expect.poll(async () => {
    const bounds = await select.boundingBox();
    return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 384
      && bounds.y >= 0 && bounds.y + bounds.height <= 600;
  }).toBe(true);

  await select.focus();
  // Native typeahead works without depending on the operating system's menu UI.
  await page.keyboard.press("p");
  await expect(select).toHaveValue("pt-BR");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(select).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
