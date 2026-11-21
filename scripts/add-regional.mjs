#!/usr/bin/env node
/** 把新研究的华南/西南60种区域植物转换为导入层格式，并本地化图片，输出 plants.regional.json */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const RAW = JSON.parse(fs.readFileSync('/tmp/regional_plants.json', 'utf8'));
const OUT_DIR = path.join(ROOT, 'public/assets/plants');
fs.mkdirSync(OUT_DIR, { recursive: true });
const UA = 'CourtyardPlanner/1.0 (landscape research; admin@lgwu.net)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REGION_CN = { huanan: '华南亚热带', xinan: '西南高原亚热带' };
const REGION_PROV = { huanan: ['广东','广西','海南','福建'], xinan: ['四川','云南','贵州','重庆'] };
const CAT_FORM = {
  evergreen_tree: '乔木', deciduous_tree: '乔木', fruit_tree: '乔木',
  shrub: '灌木', bamboo: '竹类', climber: '藤本', aquatic: '水生植物',
  turf_ground: '草坪地被', shade_fern_moss: '蕨类苔藓',
  border_focus: '宿根花卉', border_backbone: '宿根花卉', border_fill_grass: '观赏草'
};
// 与 poke 导入层一致的中文分类名，保证前端筛选 tab 统一
const CAT_CN = {
  evergreen_tree: '常绿乔木', deciduous_tree: '落叶乔木', fruit_tree: '庭院观果树',
  shrub: '灌木与球类', bamboo: '竹类', climber: '藤本', aquatic: '水生湿生',
  turf_ground: '草坪与阴生地被', shade_fern_moss: '蕨类苔藓',
  border_focus: '花境主调', border_backbone: '花境骨架', border_fill_grass: '花境填充观赏草'
};

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429 || /^<|^You are|rate.?limit/i.test(d.slice(0, 80))) return reject(new Error('RATE'));
        try { resolve(JSON.parse(d)); } catch { reject(new Error('BAD')); }
      });
    }).on('error', reject);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP' + res.statusCode)); }
      const ch = []; res.on('data', c => ch.push(c));
      res.on('end', () => { const b = Buffer.concat(ch); if (b.length < 3000) return reject(new Error('small')); fs.writeFileSync(dest, b); resolve(b); });
    }).on('error', reject);
  });
}
function scoreTitle(t, form) {
  t = t.toLowerCase(); let s = 0;
  const whole = ['habit', 'whole', 'full tree', 'tree in', 'growth form', 'in garden', 'park', 'botanical garden', 'arboretum'];
  const detail = ['leaf', 'leaves', 'seed', 'fruit', 'close-up', 'closeup', ' close', 'bark', 'detail', 'dried', 'herbarium', 'specimen', 'pollen', 'inflorescence', 'macro'];
  const bad = ['wholesale', 'potted', 'nursery', 'for sale', 'scan', 'illustration', 'drawing'];
  for (const k of whole) if (t.includes(k)) s += 3;
  for (const k of detail) if (t.includes(k)) s -= 2;
  for (const k of bad) if (t.includes(k)) s -= 6;
  if (form.includes('乔木') && !detail.some(k => t.includes(k))) s += 1;
  return s;
}
async function fetchImage(la, form, id) {
  const q = encodeURIComponent('"' + la + '" filetype:bitmap');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q +
    '&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&format=json';
  for (let a = 0; a < 4; a++) {
    try {
      const j = await getJSON(url);
      const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
      const genus = la.toLowerCase().split(' ')[0];
      let cands = pages.map(pg => {
        const ii = (pg.imageinfo || [])[0] || {}; const md = ii.extmetadata || {};
        const clean = v => v ? String(v.value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
        return { title: pg.title.replace(/^File:/, ''), thumb: ii.thumburl, full: ii.url,
          w: ii.width || 0, h: ii.height || 0, license: clean(md.LicenseShortName),
          licenseUrl: clean(md.LicenseUrl), artist: clean(md.Artist).slice(0, 120),
          desc: clean(md.ImageDescription).slice(0, 200) };
      }).filter(x => x.thumb && x.w >= 600 && x.h >= 400 && (x.title + ' ' + x.desc).toLowerCase().includes(genus));
      if (!cands.length) return null;
      cands.forEach(c => c.score = scoreTitle(c.title, form));
      cands.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));
      const best = cands[0];
      const ext = (best.thumb.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i) || [, 'jpg'])[1].toLowerCase();
      const fname = id + '.' + ext;
      let buf;
      for (let d = 0; d < 3; d++) { try { buf = await download(best.thumb, path.join(OUT_DIR, fname)); break; } catch { await sleep(600); } }
      if (!buf) return null;
      return { file: 'plants/' + fname, sourcePage: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(best.title.replace(/ /g, '_')),
        license: best.license, licenseUrl: best.licenseUrl, artist: best.artist, title: best.title,
        visualType: best.score >= 3 ? 'whole-or-habit' : 'detail', reviewStatus: 'auto-reviewed',
        confidence: best.score >= 3 ? 'high' : 'medium', sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        width: best.w, height: best.h };
    } catch (e) {
      if (e.message === 'RATE' || e.message === 'BAD') { await sleep(2500 * (a + 1)); continue; }
      await sleep(700);
    }
  }
  return null;
}

async function main() {
  const plants = [];
  for (let i = 0; i < RAW.length; i++) {
    const r = RAW[i];
    const id = 'reg-' + (r.regions.includes('huanan') ? 'hn' : 'xn') + '-' + String(i + 1).padStart(2, '0');
    const form = CAT_FORM[r.cat] || '灌木';
    const region = r.regions.includes('huanan') ? 'huanan' : 'xinan';
    const img = await fetchImage(r.latin, form, id);
    await sleep(300);
    plants.push({
      id, name: r.cn, latinName: r.latin, growthForm: form,
      categories: [CAT_CN[r.cat] || r.cat], ornamentalFeatures: r.features || [],
      traits: r.func || [], phenology: { flowerMonths: r.flower || [], fruitMonths: r.fruit || [], colorMonths: r.color || [], source: 'regional-reference' },
      spec: r.spec || '', careNotes: r.care || '',
      pokeRegions: r.regions || [region],
      sourceDistribution: REGION_PROV[region] || [],
      sourceUrl: '', sourceType: 'regional-research', reviewStatus: 'imported-unverified',
      image: img, imageStatus: img ? (img.visualType === 'whole-or-habit' ? 'image-available-whole' : 'image-available-detail') : 'image-pending',
      sourceNotes: '区域补充·乡土适生',
      demoPrice: 0, demoConstCost: 0,
      price: Number(r.referencePrice) > 0 ? { status: 'verified', price: r.referencePrice, priceType: '行情价', source: 'regional-research' } : { status: 'unavailable', note: '暂无查证价格，需项目询价' },
    });
    console.log(id, r.cn, img ? 'IMG' : 'NOIMG');
  }
  const doc = {
    schemaVersion: 1, status: 'regional-research-import',
    notice: '区域补充层：华南/西南各30种常用乡土适生植物，拉丁学名经核实，图片本地化自Wikimedia Commons，物候按区域实际；价格未查到者标unavailable不编造。',
    builtAt: new Date().toISOString().slice(0, 10),
    stats: { total: plants.length, huanan: plants.filter(p => p.pokeRegions.includes('huanan')).length, xinan: plants.filter(p => p.pokeRegions.includes('xinan')).length, withImage: plants.filter(p => p.image).length },
    plants
  };
  fs.writeFileSync(path.join(ROOT, 'src/data/plants.regional.json'), JSON.stringify(doc, null, 2));
  console.log('DONE', doc.stats);
}
main().catch(e => { console.error(e); process.exit(1); });
