import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  balanceSpace, filterPlants, matchClimate, inSeason, inMonth,
  plantUnitPrice, quantity, buildBOQ, materialUnitPrice, materialBreakdown,
  boqTotal, toCSV, validSnapshot
} from '../src/core.js';

const plants = JSON.parse(fs.readFileSync(new URL('../src/data/plants.json', import.meta.url))).plants;
const engineering = JSON.parse(fs.readFileSync(new URL('../src/data/engineering.json', import.meta.url)));
const materials = JSON.parse(fs.readFileSync(new URL('../src/data/materials.json', import.meta.url))).materials;
const features = JSON.parse(fs.readFileSync(new URL('../src/data/features.json', import.meta.url))).features;

const baseState = () => ({
  area: 150, green: 47, paving: 40, grade: 1.25,
  selectedMaterial: 'granite',
  chosen: {
    chosenTrees: ['ginkgo-biloba'],
    chosenShrubs: ['syringa-oblata'],
    chosenGround: ['hosta-plantaginea']
  }
});

// ---------- 空间配平 ----------
test('空间配平：绿化+铺装+水景严格闭合 100%', () => {
  const r = balanceSpace(150, 47, 40);
  assert.equal(r.closed, true);
  assert.equal(r.greenPct + r.pavingPct + r.waterPct, 100);
  assert.equal(r.greenArea + r.pavingArea + r.waterArea, 150);
});

test('空间配平：铺装超出时自动压缩，水景不为负', () => {
  const r = balanceSpace(200, 70, 50);
  assert.equal(r.pavingPct, 30);
  assert.equal(r.waterPct, 0);
  assert.equal(r.closed, true);
});

test('空间配平：百分比越界被夹紧', () => {
  const r = balanceSpace(100, 150, -20);
  assert.equal(r.greenPct, 100);
  assert.equal(r.pavingPct, 0);
});

// ---------- 真实数据接入 ----------
test('植物库加载的是 32 条已核验记录', () => {
  assert.equal(plants.length, 32);
  assert.ok(plants.every(p => p.reviewStatus === 'botanical-verified'));
});

test('每条植物都有工程参数映射，无遗漏', () => {
  for (const p of plants) {
    assert.ok(engineering.entries[p.id], `缺少工程参数: ${p.id}`);
  }
});

// ---------- 选品筛选 ----------
test('分类筛选：落叶乔木只返回落叶乔木', () => {
  const r = filterPlants(plants, engineering, { category: '落叶乔木' });
  assert.ok(r.length > 0);
  assert.ok(r.every(p => p.categories.includes('落叶乔木')));
});

test('观赏属性筛选：芳香植物', () => {
  const r = filterPlants(plants, engineering, { feature: '芳香' });
  assert.ok(r.length > 0);
  assert.ok(r.every(p => p.ornamentalFeatures.includes('芳香')));
});

test('季相筛选：春季有花/果/彩叶之一', () => {
  const r = filterPlants(plants, engineering, { season: '春' });
  assert.ok(r.length > 0);
  assert.ok(r.every(p => inSeason(p.phenology, '春')));
});

test('具体月份筛选', () => {
  const r = filterPlants(plants, engineering, { month: 9 });
  assert.ok(r.every(p => inMonth(p.phenology, 9)));
});

test('关键词搜索：中文名与拉丁学名', () => {
  assert.ok(filterPlants(plants, engineering, { keyword: '银杏' }).some(p => p.id === 'ginkgo-biloba'));
  assert.ok(filterPlants(plants, engineering, { keyword: 'Ginkgo' }).some(p => p.id === 'ginkgo-biloba'));
});

test('气候区筛选：无分布记录的植物不冒充适配', () => {
  const redMaple = plants.find(p => p.id === 'acer-palmatum-atropurpureum');
  assert.equal(matchClimate(redMaple, '华北温带', engineering), false);
});

// ---------- 价格与 BOQ ----------
test(' BOQ 使用真实植物名与拉丁名，不使用演示假名', () => {
  const rows = buildBOQ(baseState(), plants, engineering, materials);
  const ginkgo = rows.find(r => r.plantId === 'ginkgo-biloba');
  assert.ok(ginkgo);
  assert.match(ginkgo.name, /银杏/);
  assert.match(ginkgo.name, /Ginkgo biloba/);
});

test('BOQ 合价 = 数量 × 单价，总价平账', () => {
  const rows = buildBOQ(baseState(), plants, engineering, materials);
  const total = boqTotal(rows);
  const manual = rows.reduce((s, r) => s + r.qty * r.unitPrice, 0);
  assert.equal(total, manual);
  assert.ok(total > 0);
});

test('品质档位联动单价', () => {
  const e = engineering.entries['ginkgo-biloba'];
  assert.ok(plantUnitPrice(e, 1.6) > plantUnitPrice(e, 1));
});

test('材料工料机拆解闭合', () => {
  const m = materials.find(x => x.id === 'granite');
  const b = materialBreakdown(m, 1);
  const sum = b.rows.main + b.rows.sub + b.rows.labor + b.rows.machine + b.rows.logistics + b.rows.waste + b.rows.measure;
  assert.equal(b.total, sum);
  assert.ok(b.rows.waste > 0, '损耗率应计入');
});

test('空间配平变化会驱动工程量与总价变化', () => {
  const a = boqTotal(buildBOQ(baseState(), plants, engineering, materials));
  const s2 = { ...baseState(), area: 300 };
  const b = boqTotal(buildBOQ(s2, plants, engineering, materials));
  assert.ok(b > a);
});

// ---------- 导出 ----------
test('景观小品独立选配进入 BOQ', () => {
  const s = { ...baseState(), chosenFeatures: ['pergola', 'filter'] };
  const rows = buildBOQ(s, plants, engineering, materials, features);
  assert.ok(rows.some(r => r.name.includes('廊架')));
  assert.ok(rows.some(r => r.name.includes('过滤')));
  assert.ok(boqTotal(rows) > boqTotal(buildBOQ(baseState(), plants, engineering, materials, features)));
});

test('未选小品时水景仅作预留，不虚构金额', () => {
  const rows = buildBOQ(baseState(), plants, engineering, materials, features);
  const reserve = rows.find(r => r.source === 'placeholder');
  assert.ok(reserve);
  assert.equal(reserve.unitPrice, 0);
});

test('CSV 带 BOM 且表头正确', () => {
  const rows = buildBOQ(baseState(), plants, engineering, materials);
  const csv = toCSV(rows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /分部/);
  assert.match(csv, /数据状态/);
});

test('CSV 正确转义引号', () => {
  const csv = toCSV([{ division: '测', name: 'a"b', spec: '', unit: '', qty: 1, unitPrice: 1, source: '' }]);
  assert.match(csv, /a""b/);
});

// ---------- 方案 ----------
test('快照结构校验', () => {
  assert.equal(validSnapshot(baseState()), true);
  assert.equal(validSnapshot({ area: 1 }), false);
  assert.equal(validSnapshot(null), false);
});

test('多方案快照互不影响（深拷贝语义由调用方保证）', () => {
  const s1 = baseState();
  const s2 = JSON.parse(JSON.stringify(s1));
  s2.chosen.chosenTrees.push('pinus-bungeana');
  assert.equal(s1.chosen.chosenTrees.length, 1);
  assert.equal(s2.chosen.chosenTrees.length, 2);
});
