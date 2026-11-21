#!/usr/bin/env node
/**
 * 数据整合：把图片元数据、价格基准、物候数据合并进植物目录。
 * 生成 src/data/plants.enriched.json（前端实际加载的增强版）
 * 原则：查证数据填入并标注来源；查不到的明确留空+状态标注，绝不编造。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const imported = readJson('src/data/plants.imported.json');
const verified = readJson('src/data/plants.json');
const images = readJson('src/data/image-candidates.json');
const prices = readJson('src/data/price-benchmarks.json');
const phenology = JSON.parse(fs.readFileSync('/tmp/phenology_research.json', 'utf8'));

const imgById = new Map(images.map(x => [x.id, x]));
const phenoByName = new Map(phenology.map(x => [x.name, x]));
const phenoByLatin = new Map(phenology.map(x => [x.latin.toLowerCase(), x]));

// 中文名规范化（去括号品种后缀）用于价格匹配
function normName(n) {
  return String(n || '').replace(/[（(].*?[)）]/g, '').replace(/\s/g, '').trim();
}
function latGenus(la) {
  return String(la || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)[0];
}

// 从 price byName 里为该植物找查证价格：优先精确中文名，其次属名对应
function findPrices(p) {
  const key = normName(p.name);
  if (prices.byName[key]) return { records: prices.byName[key], match: 'name' };
  // 用拉丁属名对应的中文名做二次匹配（通过 price record 的 rawName 无法反查属名，跳过）
  return { records: [], match: 'none' };
}

// 选代表价：优先信息价，取最接近常用规格（胸径8-12cm）的一条
function pickRepresentative(records) {
  if (!records.length) return null;
  const info = records.filter(r => r.priceType === '信息价');
  const pool = info.length ? info : records;
  // 优先胸径规格，取中位规格
  const dbh = pool.filter(r => r.specParsed.type === 'dbh' && r.specParsed.value >= 6 && r.specParsed.value <= 16);
  const use = dbh.length ? dbh : pool;
  const sorted = [...use].sort((a, b) => (a.specParsed.value || 99) - (b.specParsed.value || 99));
  const mid = sorted[Math.floor(sorted.length / 2)];
  // 区间：同植物同口径的最小-最大
  const sameType = pool.filter(r => r.priceType === mid.priceType).map(r => r.price);
  return {
    price: mid.price,
    min: Math.min(...sameType),
    max: Math.max(...sameType),
    unit: mid.unit,
    spec: mid.spec,
    priceType: mid.priceType,
    province: mid.province,
    climate: mid.climate,
    source: mid.source,
    sourceUrl: mid.sourceUrl,
    date: mid.date,
    recordCount: records.length,
  };
}

function enrichPlant(p) {
  const img = imgById.get(p.id);
  const ph = phenoByName.get(normName(p.name)) || phenoByLatin.get((p.latinName || '').toLowerCase());
  const pf = findPrices(p);
  const rep = pickRepresentative(pf.records);

  const image = img && img.status === 'ok' ? {
    file: img.file, source: 'Wikimedia Commons', sourcePage: img.sourcePage,
    license: img.license, licenseUrl: img.licenseUrl, artist: img.artist,
    visualType: img.visualType, reviewStatus: img.reviewStatus, confidence: img.confidence,
    sha256: img.sha256, width: img.width, height: img.height, title: img.title,
  } : null;

  const price = rep ? {
    ...rep, status: 'verified', matchType: pf.match,
  } : (Number(p.demoPrice) > 0 ? {
    status: 'reference-only',
    note: '无公开查证价格；此处为poke原始参考价，仅供占位，须项目询价',
    price: Number(p.demoPrice) + Number(p.demoConstCost || 0),
    priceType: 'poke原始参考价',
    source: 'poke原始项目数据（非公开查证）',
    sourceUrl: '',
    demoPrice: p.demoPrice,
    demoConstCost: p.demoConstCost,
  } : {
    status: 'unavailable',
    note: '暂无查证价格，需项目询价',
  });

  const out = {
    ...p,
    image,
    imageStatus: image ? (image.visualType === 'whole-or-habit' ? 'image-available-whole' : 'image-available-detail') : 'image-pending',
    price,
    // 观赏属性：物候库里有更可靠的就合并（去重）
    ornamentalFeatures: ph && ph.features && ph.features.length
      ? [...new Set([...(p.ornamentalFeatures || []), ...ph.features])]
      : (p.ornamentalFeatures || []),
    phenology: {
      flowerMonths: ph && ph.flower ? ph.flower : (p.phenology?.flowerMonths || []),
      fruitMonths: ph && ph.fruit ? ph.fruit : (p.phenology?.fruitMonths || []),
      colorMonths: ph && ph.color ? ph.color : (p.phenology?.colorMonths || []),
      source: ph ? 'botanical-reference' : (p.phenology?.flowerMonths?.length ? 'verified' : 'pending'),
    },
  };
  return out;
}

const enriched = imported.plants.map(enrichPlant);

const stats = {
  total: enriched.length,
  withImage: enriched.filter(p => p.image).length,
  wholeImage: enriched.filter(p => p.image?.visualType === 'whole-or-habit').length,
  withVerifiedPrice: enriched.filter(p => p.price.status === 'verified').length,
  withPhenology: enriched.filter(p => p.phenology.flowerMonths.length || p.phenology.fruitMonths.length || p.phenology.colorMonths.length).length,
};

const doc = {
  schemaVersion: 1,
  status: 'enriched-catalog',
  notice: '增强目录：以 poke 导入的382条为基础，叠加三股查证数据——①Wikimedia Commons 本地化图片(按拉丁学名匹配,CC许可,含审核字段)；②公开政府造价信息/中标价/行情价基准(带来源URL与口径)；③植物学物候参考(花期果期色叶期)。所有数据保留来源与审核状态，查不到的明确标注pending/unavailable，不编造。',
  builtAt: new Date().toISOString().slice(0, 10),
  stats,
  plants: enriched,
};

const out = path.join(ROOT, 'src/data/plants.enriched.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('Wrote', out);
console.log('stats:', JSON.stringify(stats));
