// 本地验收截图工具：用 Edge 实拍 poke 版与专业版对比，输出到 .shots/
// 依赖：playwright-core（受管 Node 工作区）；Edge 路径按本机 Flatpak 安装位置，换机需改 EDGE。
// 用法：先 `python3 -m http.server 8099`，再 `node scripts/shot.mjs`
import { chromium } from '/home/lgw/.workbuddy/binaries/node/workspace/node_modules/playwright-core/index.mjs';

const EDGE = process.env.EDGE_BIN || '/var/lib/flatpak/app/com.microsoft.Edge/x86_64/stable/9cfe703208ad63f111c2297174e4dd1fbea4d46b853e16c4bab300ba8e4922df/files/extra/microsoft-edge';
const OUT = '/home/lgw/WorkBuddy/2026-11-21-15-43-43/courtyard-planner/.shots';
import { mkdirSync } from 'fs';
mkdirSync(OUT, { recursive: true });

const targets = [
  { name: 'poke', url: 'https://courtyard-planner.dont.poke.site/' },
  { name: 'ours', url: 'http://127.0.0.1:8099/index.html' },
];

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
for (const t of targets) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${t.name}-full.png`, fullPage: true });
    // 首屏
    await page.screenshot({ path: `${OUT}/${t.name}-fold.png` });
    // 统计
    const stat = await page.evaluate(() => ({
      title: document.title,
      h2s: [...document.querySelectorAll('h2')].map(h => h.textContent.trim()).slice(0, 12),
      imgs: document.querySelectorAll('img').length,
      buttons: document.querySelectorAll('button').length,
      inputs: document.querySelectorAll('input').length,
      height: document.body.scrollHeight,
    }));
    console.log(t.name, JSON.stringify(stat, null, 2), 'CONSOLE_ERRORS', errs.length, errs.slice(0, 3));
  } catch (e) {
    console.error(t.name, 'FAILED', e.message);
  }
  await page.close();
}
await browser.close();
console.log('SHOTS_SAVED', OUT);
