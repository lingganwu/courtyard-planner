#!/usr/bin/env node
/** 把价格调研结果整理为带来源的价格基准库，并做名称规范化 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const raw = JSON.parse(fs.readFileSync('/tmp/price_research.json', 'utf8'));

// 名称规范化：去品种后缀括号，统一别名
const ALIAS = {
  '樟树': '香樟', '樟树(带三级枝)': '香樟', '樟树(容器苗)': '香樟',
  '金桂': '桂花', '特选金桂': '桂花', '桂花(丛生)': '桂花',
  '桂花(金桂)': '桂花', '桂花(四季桂)': '桂花',
  '玉兰': '白玉兰', '白玉兰': '白玉兰',
  '小叶紫薇': '紫薇', '大红紫薇': '紫薇',
  '高杆石楠': '红叶石楠', '红叶石楠小毛球': '红叶石楠球',
  '石楠球': '红叶石楠球', '海桐球A': '海桐球',
  '金禾女贞球A': '金森女贞球', '火焰南天竹': '南天竹',
  '大花品种月季(HT系/Gr系)': '月季', '藤本月季': '月季', '丰花月季': '月季', '独杆月季': '月季',
  '鸢尾/德国鸢尾': '鸢尾', '三七景天(费菜)': '八宝景天',
  '芝麻黑花岗岩': '芝麻黑花岗岩', '芝麻黑花岗岩(国产)普型板': '芝麻黑花岗岩',
  '新654芝麻黑常规板': '芝麻黑花岗岩', '芝麻黑地铺板': '芝麻黑花岗岩',
  '芝麻灰花岗岩': '芝麻灰花岗岩', '芝麻灰花岗岩(国产)普型板': '芝麻灰花岗岩',
  '芝麻白花岗岩': '芝麻白花岗岩', '芝麻白花岗岩(国产)普型板': '芝麻白花岗岩',
  '深灰色荔枝面PC砖': 'PC砖', 'PC砖(陶瓷生态地铺石)': 'PC砖',
  '浅灰色透水砖': '透水砖', '陶瓷透水砖': '透水砖', '透水混凝土路面砖': '透水砖',
  '芝麻黑仿石透水砖': '透水砖',
};
function normalizeName(n) {
  if (ALIAS[n]) return ALIAS[n];
  return n.replace(/[（(].*?[)）]/g, '').trim();
}

// 规格解析：提取胸径/地径数值（用于按口径选代表价）
function parseSpec(spec) {
  const s = String(spec || '');
  const m = s.match(/(?:胸径|米径|地径|Φ|φ|\bd)\s*[:：]?\s*(\d+(?:\.\d+)?)/);
  if (m) return { type: 'dbh', value: parseFloat(m[1]) };
  const h = s.match(/(?:高度|H|h)\s*[:：]?\s*(\d+(?:\.\d+)?)/);
  if (h) return { type: 'height', value: parseFloat(h[1]) };
  return { type: 'other', value: null };
}

// 省份→气候区
const REGION_BY_PROV = {
  '北京': '华北温带', '天津': '华北温带', '河北': '华北温带', '山西': '华北温带', '内蒙古': '华北温带',
  '山东': '华北温带', '河南': '华北温带', '辽宁': '华北温带', '吉林': '华北温带', '黑龙江': '华北温带',
  '湖北': '华中过渡', '湖南': '华中过渡', '安徽': '华中过渡', '陕西': '华中过渡', '江西': '华中过渡',
  '江苏': '华东暖温带', '浙江': '华东暖温带', '上海': '华东暖温带', '福建': '华东暖温带',
  '广东': '华南亚热带', '广西': '华南亚热带', '海南': '华南亚热带', '香港': '华南亚热带', '澳门': '华南亚热带',
  '四川': '西南高原亚热带', '云南': '西南高原亚热带', '贵州': '西南高原亚热带', '重庆': '西南高原亚热带', '西藏': '西南高原亚热带',
  '甘肃': '华北温带', '宁夏': '华北温带', '青海': '西南高原亚热带',
};

const records = raw.map((r, i) => {
  const province = r.province || r.region || '全国';
  const climate = REGION_BY_PROV[province] || '全国参考';
  return {
    id: 'PR-' + String(i + 1).padStart(3, '0'),
    name: normalizeName(r.name),
    rawName: r.name,
    spec: r.spec,
    specParsed: parseSpec(r.spec),
    unit: r.unit,
    price: Number(r.price),
    priceType: r.priceType,
    province,
    climate,
    source: r.source,
    sourceUrl: r.sourceUrl,
    date: r.date,
    note: r.note || '',
  };
}).filter(r => Number.isFinite(r.price) && r.price > 0);

// 按规范化名称聚合
const byName = {};
for (const r of records) {
  (byName[r.name] ||= []).push(r);
}

const doc = {
  schemaVersion: 1,
  status: 'verified-market-research',
  notice: '价格基准库：全部来自公开政府造价信息、政府采购中标价、苗木行情与批发报价，每条带来源URL、日期与价格口径。口径分为信息价(市场参考,非政府定价)、中标价(含运输税费,部分含栽植养护)、批发价(苗圃上车价)、行情价(平台参考)。同物不同价差大,套价须结合项目实际询价。未收录植物不编造价格。',
  collectedAt: new Date().toISOString().slice(0, 10),
  priceTypes: {
    '信息价': '政府造价信息发布的市场参考价，含种植养护口径为主，非政府定价',
    '中标价': '政府采购/工程实际中标或合同单价，常含运输税费，部分含栽植养护',
    '批发价': '苗圃/基地批量上车价，不含运输栽植',
    '行情价': '园林苗木行情平台参考报价',
  },
  counts: {
    totalRecords: records.length,
    speciesCovered: Object.keys(byName).length,
    byPriceType: records.reduce((m, r) => { m[r.priceType] = (m[r.priceType] || 0) + 1; return m; }, {}),
    byClimate: records.reduce((m, r) => { m[r.climate] = (m[r.climate] || 0) + 1; return m; }, {}),
  },
  records,
  byName,
};

const out = path.join(ROOT, 'src/data/price-benchmarks.json');
fs.writeFileSync(out, JSON.stringify(doc, null, 2));
console.log('Wrote ' + out);
console.log('records:', records.length, 'species:', Object.keys(byName).length);
console.log('byPriceType:', JSON.stringify(doc.counts.byPriceType));
console.log('byClimate:', JSON.stringify(doc.counts.byClimate));
