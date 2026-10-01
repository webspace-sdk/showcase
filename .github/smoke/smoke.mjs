// Loads every published world in headless Chrome and checks that it actually comes up:
// the engine boots, the document imports, models and splats load, and no script errors fire.
import { chromium } from "playwright";

const BASE = "https://webspaces.space";
const WORLDS = [
  { path: "/showcase/stargazer/", splats: 4 },
  { path: "/showcase/specimen/", splats: 1 },
  { path: "/showcase/tonegarden/", splats: 1 },
  { path: "/showcase/campfire/", splats: 6 },
  { path: "/showcase/lobby/" },
  { path: "/kit/world.html" },
  { path: "/start/" }
];

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let failed = 0;

for (const w of WORLDS) {
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const t0 = Date.now();
  let result = null;
  try {
    await page.goto(BASE + w.path, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => window.AFRAME && AFRAME.scenes[0] && AFRAME.scenes[0].is("document-imported"), null, { timeout: 120000 });
    await page.waitForTimeout(15000);
    result = await page.evaluate(() => ({
      objects: DOM_ROOT.querySelectorAll("[media-loader]").length,
      splats: [...DOM_ROOT.querySelectorAll("[media-splat]")].filter(e => e.components["media-splat"].hasSorted).length,
      api: !!(window.webspace && webspace.state)
    }));
  } catch (e) {
    errors.push(String(e.message || e));
  }
  const ok = result && result.objects > 0 && result.api && (!w.splats || result.splats >= w.splats) && errors.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${w.path} ${((Date.now() - t0) / 1000).toFixed(0)}s ${JSON.stringify(result)} ${errors.slice(0, 3).join(" | ")}`);
  await page.context().close();
}

await browser.close();
if (failed) {
  console.error(`${failed} world(s) failed`);
  process.exit(1);
}
