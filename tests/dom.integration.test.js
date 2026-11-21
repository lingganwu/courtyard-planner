/**
 * DOM 集成测试：用 jsdom 加载真实 index.html + app.js，
 * mock fetch 从磁盘读 JSON，验证前端确实渲染真实数据。
 * 运行：NODE_PATH=<managed>/node_modules node --test tests/dom.integration.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// jsdom 优先按常规解析；找不到时回退到本环境受管 Node 工作区（不改变仓库行为）
let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  const fallback = '/home/lgw/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
  ({ JSDOM } = await import(pathToFileURL(fallback).href));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

async function boot() {
  const html = read('index.html');
  const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;

  // mock fetch：把 './src/data/xxx.json' 映射到磁盘
  window.fetch = async (url) => {
    const file = String(url).replace('./', '');
    const body = read(file);
    return { ok: true, json: async () => JSON.parse(body) };
  };
  window.URL.createObjectURL = () => 'blob:mock';
  window.URL.revokeObjectURL = () => {};

  const appCode = read('app.js').replace(
    /import\s*\{[\s\S]*?\}\s*from\s*'\.\/src\/core\.js';/,
    ''
  );
  // 把 core.js 的导出注入为全局（剥离 export 关键字后 eval）
  const coreCode = read('src/core.js').replace(/export\s+function/g, 'function');
  window.eval(coreCode);
  // 构造 import 的对象
  const coreNames = ['balanceSpace','filterPlants','buildBOQ','boqTotal','toCSV','materialBreakdown','validSnapshot','plantUnitPrice','quantity','round'];
  window.__core = Object.fromEntries(coreNames.map(n => [n, window[n]]));
  // 替换 app.js 顶部 import 为 const 解构
  const appBoot = appCode.replace(
    /(const \$ =)/,
    `const {${coreNames.join(',')}} = window.__core;\n$1`
  );
  window.eval(appBoot);

  // 等待异步 init 完成
  await new Promise(r => setTimeout(r, 100));
  return window;
}

test('前端加载真实数据并渲染 32 条已核验植物到选品抽屉', async () => {
  const w = await boot();
  const status = w.document.querySelector('#dataStatus').textContent;
  assert.match(status, /32 条/);
  assert.match(status, /botanical-verified/);

  w.document.querySelector('.open-picker').click();
  const picks = w.document.querySelectorAll('#pickerGrid .pick');
  assert.ok(picks.length > 0, '选品抽屉应渲染植物');
  assert.match(w.document.querySelector('#matchCount').textContent, /\/ 32 条/);
});

test('默认方案渲染出真实植物名与拉丁名', async () => {
  const w = await boot();
  const chosen = w.document.querySelector('#chosenTrees').textContent;
  assert.match(chosen, /银杏/);
  assert.match(chosen, /Ginkgo biloba/);
});

test('BOQ 计算出非零金额且包含材料工料机拆解', async () => {
  const w = await boot();
  const total = w.document.querySelector('#boqTotal').textContent;
  assert.match(total, /¥[1-9]/, '总价应为非零金额');
  const costRows = w.document.querySelectorAll('#costRows li');
  assert.ok(costRows.length >= 7, '应展示主材/辅材/人工/机械/物流/损耗/措施');
  const costTitle = w.document.querySelector('#costTitle').textContent;
  assert.match(costTitle, /¥[1-9]/);
});

test('景观小品可勾选并联动总价', async () => {
  const w = await boot();
  const before = w.document.querySelector('#boqTotal').textContent;
  const card = w.document.querySelector('[data-feature="pergola"]');
  assert.ok(card, '应有廊架小品卡片');
  card.click();
  const after = w.document.querySelector('#boqTotal').textContent;
  assert.notEqual(before, after, '勾选小品后总价应变化');
});

test('业主汇报版可切换并展示分部占比', async () => {
  const w = await boot();
  const tab = [...w.document.querySelectorAll('.tab')].find(t => t.dataset.view === 'owner');
  tab.click();
  assert.equal(w.document.querySelector('#ownerView').hidden, false);
  assert.match(w.document.querySelector('#ownerView').textContent, /估算总额/);
  assert.ok(w.document.querySelectorAll('.owner-bar').length > 0);
});

test('CSV 导出按钮生成带数据的下载', async () => {
  const w = await boot();
  let exported = null;
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = tag => {
    const el = origCreate(tag);
    if (tag === 'a') el.click = () => { exported = el.download; };
    return el;
  };
  w.document.querySelector('#export').click();
  assert.match(exported, /\.csv$/);
});
