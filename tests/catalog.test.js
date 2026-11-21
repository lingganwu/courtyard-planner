import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  mergePlants, mergeMaterials, importedPlantEntry, normalizeImportedMaterial,
  statusLabel, hasLicensedImage
} from '../src/catalog.js';
import { materialBreakdownRows, materialUnitPrice, buildBOQ, boqTotal, filterPlants } from '../src/core.js';

const load = f => JSON.parse(fs.readFileSync(new URL('../src/data/' + f, import.meta.url)));
const plantsV = load('plants.json');
const eng = load('engineering.json');
const matsV = load('materials.json');
const plantsImp = load('plants.imported.json');
const matsImp = load('materials.imported.json');

const merged = mergePlants(plantsV, plantsImp);
// 供筛选/BOQ 使用：并入导入工程参数
const engFull = JSON.parse(JSON.stringify(eng));
Object.assign(engFull.entries, merged.engineeringEntries);
const matsMerged = mergeMaterials(matsV.materials, matsImp);

// ---------- 数据量与分层 ----------
test('合并后植物总数 = 32 已核验 + 382 导入 = 414', () => {
  assert.equal(plantsV.plants.length, 32);
  assert.equal(plantsImp.plants.length, 382);
  assert.equal(merged.plants.length, 414);
  assert.equal(merged.stats.verified, 32);
  assert.equal(merged.stats.imported, 382);
});

test('已核验层保持 botanical-verified，导入层不冒充核验', () => {
  const verified = merged.plants.filter(p => p.reviewStatus === 'botanical-verified');
  assert.equal(verified.length, 32);
  const imported = merged.plants.filter(p => String(p.reviewStatus).startsWith('imported'));
  assert.equal(imported.length, 382);
  // 导入层不得出现 botanical-verified
  assert.equal(imported.some(p => p.reviewStatus === 'botanical-verified'), false);
  // 导入层不得带任何已授权图片
  assert.equal(imported.some(p => hasLicensedImage(p)), false);
});

test('重复学名被标记，且状态为待复核', () => {
  const dups = merged.plants.filter(p => p.duplicateOf || String(p.reviewStatus).includes('duplicate'));
  assert.ok(dups.length >= 9);
  dups.forEach(p => assert.notEqual(statusLabel(p), '已核验'));
});

// ---------- 工程参数与 BOQ ----------
test('每条导入植物都有工程参数条目（BOQ 不会跳过）', () => {
  const imp = plantsImp.plants;
  imp.forEach(p => {
    const e = merged.engineeringEntries[p.id];
    assert.ok(e, p.id + ' 缺少工程参数');
    assert.ok(['chosenTrees', 'chosenShrubs', 'chosenGround'].includes(e.target));
    assert.ok(e.base > 0, p.id + ' 演示单价必须 > 0');
  });
});

test('导入植物可被 BOQ 计入，单价来自同一入口', () => {
  const p = plantsImp.plants[0];
  const e = merged.engineeringEntries[p.id];
  const state = {
    area: 150, green: 50, paving: 40, grade: 1.2,
    selectedMaterial: 'granite',
    chosen: { chosenTrees: [p.id], chosenShrubs: [], chosenGround: [] }
  };
  const rows = buildBOQ(state, merged.plants, engFull, matsMerged.materials, []);
  const row = rows.find(r => r.plantId === p.id);
  assert.ok(row, 'BOQ 应包含导入植物');
  assert.equal(row.unitPrice, Math.round(e.base * 1.2));
  assert.ok(row.qty >= 1);
});

// ---------- 材料扁平计价：卡片/BOQ 同价 ----------
test('导入材料卡片价与 BOQ 单价完全一致（poke 翻车点）', () => {
  const m = matsMerged.materials.find(x => x.pricingMode === 'flat');
  assert.ok(m, '应存在导入材料');
  for (const grade of [1, 1.25, 1.5]) {
    const card = materialBreakdownRows(m, grade).total;
    const boq = materialUnitPrice(m, grade);
    assert.equal(card, boq, `档位 ${grade} 卡片价应等于 BOQ 单价`);
  }
  assert.equal(materialUnitPrice(m, 1), (m.flatMaterial || 0) + (m.flatConst || 0));
});

test('材料合并数量：8 已核验 + 81 导入（61硬景+20软景）', () => {
  assert.equal(matsV.materials.length, 8);
  assert.equal(matsImp.materials.length, 81);
  assert.equal(matsMerged.materials.length, 89);
  assert.equal(matsMerged.stats.hard, 61);
  assert.equal(matsMerged.stats.soft, 20);
});

// ---------- 筛选 ----------
test('观赏属性筛选覆盖导入层（观花/观叶/观果）', () => {
  const flower = filterPlants(merged.plants, engFull, { feature: '观花' });
  assert.ok(flower.length > 100, '观花植物应 >100 条');
  const fruit = filterPlants(merged.plants, engFull, { feature: '观果' });
  assert.ok(fruit.length > 30);
});

test('关键词搜索命中导入层中文名与学名', () => {
  const byCn = filterPlants(merged.plants, engFull, { keyword: '银杏' });
  assert.ok(byCn.length >= 1);
  const byLa = filterPlants(merged.plants, engFull, { keyword: 'Ginkgo' });
  assert.ok(byLa.length >= 1);
});

test('全目录 414 条可无 climate 过滤完整返回', () => {
  const all = filterPlants(merged.plants, engFull, {});
  assert.equal(all.length, 414);
});
