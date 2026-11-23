// Render icons/icon.svg to the PNG sizes Chrome and the Web Store need.
// Usage: node scripts/render-icons.mjs <path-to-chrome> [puppeteer module dir]
//   16/32/48: artwork fills the canvas (toolbar, extensions page); 16 uses the pixel-aligned icons/icon16.svg
//   128:      96px artwork with 16px transparent padding (Chrome Web Store guideline)
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [chromePath, modDir = process.cwd()] = process.argv.slice(2);
const puppeteer = createRequire(join(modDir, 'node_modules/'))('puppeteer');
const svg = readFileSync(join(root, 'icons/icon.svg'), 'utf8');
const svg16 = readFileSync(join(root, 'icons/icon16.svg'), 'utf8'); // pixel-aligned variant for 16px

const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
try {
  const page = await browser.newPage();
  for (const [size, pad] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    const art = size - pad * 2;
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <div style="padding:${pad}px;width:${art}px;height:${art}px">${(size === 16 ? svg16 : svg).replace('<svg ', `<svg width="${art}" height="${art}" `)}</div></body></html>`);
    await page.screenshot({ path: join(root, `icons/icon${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    console.log(`icons/icon${size}.png`);
  }
} finally {
  await browser.close();
}
