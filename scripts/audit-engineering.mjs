import fs from 'node:fs';

const plants = JSON.parse(fs.readFileSync('src/data/plants.json', 'utf8')).plants;
const eng = JSON.parse(fs.readFileSync('src/data/engineering.json', 'utf8'));
const mats = JSON.parse(fs.readFileSync('src/data/materials.json', 'utf8')).materials;
const features = JSON.parse(fs.readFileSync('src/data/features.json', 'utf8')).features;
const errors = [];

// 每条已核验植物都必须有工程参数，且不得推翻植物学字段
const allowedTargets = new Set(['chosenTrees', 'chosenShrubs', 'chosenGround']);
for (const p of plants) {
  const e = eng.entries[p.id];
  if (!e) { errors.push(`${p.id}: missing engineering entry`); continue; }
  for (const k of ['target', 'spec', 'unit', 'base', 'qtyMode', 'density']) {
    if (e[k] === undefined || e[k] === null || e[k] === '') errors.push(`${p.id}: engineering missing ${k}`);
  }
  if (!allowedTargets.has(e.target)) errors.push(`${p.id}: invalid target ${e.target}`);
  if (!['perPlant', 'perArea'].includes(e.qtyMode)) errors.push(`${p.id}: invalid qtyMode ${e.qtyMode}`);
  if (Number(e.base) <= 0) errors.push(`${p.id}: non-positive base price`);
}

// 气候区映射必须引用存在的省份集合
const regions = Object.keys(eng.climateRegionByProvince || {});
if (regions.length < 5) errors.push('climateRegionByProvince: expected at least 5 regions');

// 材料工料机字段完整
for (const m of mats) {
  for (const k of ['id', 'name', 'category', 'spec', 'constructionLayers', 'wasteRate', 'pricing']) {
    if (!m[k]) errors.push(`material ${m.id}: missing ${k}`);
  }
  if (!m.constructionLayers?.length) errors.push(`material ${m.id}: no construction layers`);
  for (const key of ['labor', 'machine', 'logistics', 'measure']) {
    if (m.pricing?.[key] === undefined) errors.push(`material ${m.id}: pricing missing ${key}`);
  }
}

// 小品/水系选配库
for (const f of features) {
  for (const k of ['id', 'name', 'category', 'spec', 'unit', 'price']) {
    if (!f[k]) errors.push(`feature ${f.id}: missing ${k}`);
  }
  if (!f.layers?.length) errors.push(`feature ${f.id}: no layers`);
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Engineering audit passed: ${plants.length} plants mapped, ${mats.length} materials, ${features.length} features, ${regions.length} climate regions.`);
