#!/usr/bin/env node
/**
 * 用最新 price-benchmarks.json 刷新三份 enriched 目录的价格字段。
 * 只做价格刷新，不动图片/物候；规格与口径不匹配的记录不采用，绝不编造。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const prices = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/price-benchmarks.json'), 'utf8'));
const FILES = [
  'src/data/plants.verified.enriched.json',
  'src/data/plants.enriched.json',
  'src/data/plants.regional.json',
];
const norm = n => String(n || '').replace(/[（(].*?[)）]/g, '').replace(/\s/g, '').trim();
const alias = {
  '红花檵木': '红花继木', '枸骨': '构骨', '皂角': '皂荚', '马褂木': '鹅掌楸',
  '柿子树': '柿', '樱桃树': '樱桃', '枣树': '枣', '梨树': '梨', '桃树': '桃',
  '杏树': '杏', '李树': '李', '桑树': '桑', '山楂树': '山楂', '黄杨': '小叶黄杨',
  '果岭草': '狗牙根', '细叶结缕草': '结缕草', '日本红枫': '红枫', '美国红枫': '红枫',
  '小叶扶芳藤': '扶芳藤', '玉龙草': '麦冬', '沿阶草': '麦冬', '木犀': '桂花',
  '月季花': '月季', '绣球花': '绣球', '山樱花': '樱花', '紫叶矮樱': '紫叶李',
  // 第三批：同种异名/园艺品种归并（仅在学名或园艺分类确实等同才映射）
  '八宝': '八宝景天', '槐': '国槐', '迎春花': '迎春', '冬青卫矛': '卫矛',
  '女贞': '大叶女贞', '栾': '栾树', '腊梅': '蜡梅', '橘/柑橘': '柑橘', '柚子': '柑橘',
  '苦丁茶/枸骨': '构骨', '构骨球': '构骨', '桧柏': '圆柏', '榕树': '小叶榕',
  '栎树': '栓皮栎', '海棠果': '海棠', '大叶黄杨': '大叶黄杨球', '大叶黄杨（黄杨属）': '大叶黄杨球',
  '喷雪花': '绣线菊', '茶梅': '山茶', '红花继木球': '红花继木', '栀子华(大花)': '栀子',
  '紫穗狼尾草': '狼尾草', '芒草': '细叶芒', '芒': '细叶芒',
  '飞燕草': '大花飞燕草', '无尽夏绣球': '绣球', '圆锥绣球': '绣球', '贝拉安娜绣球': '绣球',
  '风车茉莉/络石': '风车茉莉', '爬墙虎/地锦': '爬山虎', '地锦': '爬山虎',
  '硬骨凌霄': '凌霄', '忍冬(金银花藤)': '金银花', '紫叶爬山虎': '五叶地锦',
  '耐寒睡莲': '睡莲', '热带睡莲': '睡莲', '水烛(北方)': '香蒲',
  '马尼拉草坪': '结缕草', '阔叶麦冬': '麦冬', '黄金络石': '络石',
  '玉龙草/沿阶草(矮密)': '麦冬', '匍匐剪股颖': '剪股颖',
  '富贵草/吉祥草': '吉祥草', '花叶络石地被': '花叶络石',
  '马缨杜鹃': '杜鹃', '芦苇': '芦苇',
};
const byName = prices.byName || {};
const rank = { '信息价': 0, '中标价': 1, '批发价': 2, '行情价': 3 };

function lookup(p) {
  const name = norm(p.name);
  const keys = [...new Set([name, alias[name]].filter(Boolean))];
  let recs = keys.flatMap(k => byName[k] || []);
  if (!recs.length) return null;

  const form = String(p.growthForm || '');
  const ground = /草坪|地被|宿根|花境|水生|蕨类/.test(form) || /果岭草|狗牙根|结缕草|百慕大|麦冬|玉簪|福禄考|松果菊/.test(name);
  const unitOk = ground
    ? recs.filter(r => /平方|㎡|m2/i.test(r.unit))
    : recs.filter(r => /株|棵|盆|丛|枝|球/.test(r.unit));
  if (unitOk.length) recs = unitOk;

  const typeRank = Math.min(...recs.map(r => rank[r.priceType] ?? 9));
  recs = recs.filter(r => (rank[r.priceType] ?? 9) === typeRank);
  const dbh = recs.filter(r => ['dbh', 'ground'].includes(r.specParsed?.type) && r.specParsed.value >= 5 && r.specParsed.value <= 18);
  const pool = dbh.length ? dbh : recs;
  const mid = [...pool].sort((a, b) => (a.price - b.price))[Math.floor(pool.length / 2)];
  const sameType = recs.map(r => r.price);
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
    recordCount: recs.length,
    status: 'verified',
    matchType: mid.name === name ? 'name' : 'alias',
  };
}

for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  let updated = 0, lost = 0;
  for (const plant of doc.plants) {
    const found = lookup(plant);
    if (found) {
      plant.price = found;
      updated++;
    } else if (plant.price?.status === 'verified') {
      // 旧价格已不在基准库中，退回占位，避免悬挂来源
      const demo = Number(plant.demoPrice || 0) + Number(plant.demoConstCost || 0);
      plant.price = demo > 0
        ? { status: 'reference-only', note: '无当前公开查证价格，poke 原始参考价，须询价', price: demo, priceType: 'poke原始参考价', source: 'poke原始项目数据（非公开查证）', sourceUrl: '' }
        : { status: 'unavailable', note: '暂无查证价格，需项目询价' };
      lost++;
    }
  }
  if (doc.stats) doc.stats.withVerifiedPrice = doc.plants.filter(p => p.price?.status === 'verified').length;
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  console.log(`${rel}: 更新 ${updated} 条，退回 ${lost} 条，当前查证价 ${doc.stats?.withVerifiedPrice ?? '?'}`);
}
