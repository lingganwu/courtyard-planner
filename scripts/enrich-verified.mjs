#!/usr/bin/env node
/** 给已核验层32条补图片(本地化)+价格匹配+物候，输出 plants.verified.enriched.json */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const verifiedDoc = readJson('src/data/plants.json');
const prices = readJson('src/data/price-benchmarks.json');
const phenology = JSON.parse(fs.readFileSync('/tmp/phenology_research.json', 'utf8'));
const imgMeta = readJson('src/data/image-candidates.json');
const OUT_DIR = path.join(ROOT, 'public/assets/plants');
fs.mkdirSync(OUT_DIR, { recursive: true });
const UA = 'CourtyardPlanner/1.0 (landscape research; admin@lgwu.net)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429 || /^<|^You are|rate.?limit/i.test(d.slice(0, 80))) return reject(new Error('RATE_LIMIT'));
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
function cleanLa(la) {
  let x = String(la).replace(/[（(].*?[)）]/g, ' ').replace(/\s+(L\.|Lindl\.|Endl\.|Miq\.|Makino|Zucc\.|ex\b).*$/, '').replace(/×/g, ' ').trim();
  return x.split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
}
function scoreTitle(title, growthForm) {
  const t = title.toLowerCase(); let s = 0;
  const whole = ['habit', 'whole', 'full tree', 'entire tree', 'tree in', 'growth form', 'whole plant', 'in bloom', 'in garden', 'park', 'botanical garden', 'arboretum'];
  const detail = ['leaf', 'leaves', 'bladeren', 'seed', 'seeds', 'fruit', 'close-up', 'closeup', ' close', 'bark', 'detail', 'cross section', 'slice', 'dried', 'herbarium', 'specimen', 'microform', 'pollen', 'inflorescence', 'macro'];
  const nonphoto = ['wholesale', 'potted plants', 'nursery', 'for sale', 'price', 'product', 'catalog', 'scan', 'illustration', 'icon', 'drawing'];
  for (const k of whole) if (t.includes(k)) s += 3;
  for (const k of detail) if (t.includes(k)) s -= 2;
  for (const k of nonphoto) if (t.includes(k)) s -= 6;
  if (growthForm && growthForm.includes('乔木') && !detail.some(k => t.includes(k))) s += 1;
  return s;
}
async function fetchImage(p) {
  const la = cleanLa(p.latinName);
  const q = encodeURIComponent('"' + la + '" filetype:bitmap');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q +
    '&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&format=json';
  for (let a = 0; a < 4; a++) {
    try {
      const j = await getJSON(url);
      const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
      let cands = pages.map(pg => {
        const ii = (pg.imageinfo || [])[0] || {}; const md = ii.extmetadata || {};
        const clean = v => v ? String(v.value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
        return { title: pg.title.replace(/^File:/, ''), thumb: ii.thumburl, full: ii.url,
          w: ii.width || 0, h: ii.height || 0, license: clean(md.LicenseShortName),
          licenseUrl: clean(md.LicenseUrl), artist: clean(md.Artist).slice(0, 120),
          desc: clean(md.ImageDescription).slice(0, 200) };
      }).filter(x => x.thumb && x.w >= 600 && x.h >= 400 && (x.title + ' ' + x.desc).toLowerCase().includes(la.split(' ')[0].toLowerCase()));
      if (!cands.length) return null;
      cands.forEach(c => c.score = scoreTitle(c.title, p.growthForm));
      cands.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));
      const best = cands[0];
      const ext = (best.thumb.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i) || [, 'jpg'])[1].toLowerCase();
      const fname = p.id + '.' + ext;
      let buf;
      for (let d = 0; d < 3; d++) { try { buf = await download(best.thumb, path.join(OUT_DIR, fname)); break; } catch { await sleep(700); } }
      if (!buf) return null;
      return { file: 'plants/' + fname, sourcePage: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(best.title.replace(/ /g, '_')),
        license: best.license, licenseUrl: best.licenseUrl, artist: best.artist, title: best.title,
        visualType: best.score >= 3 ? 'whole-or-habit' : 'detail', reviewStatus: 'auto-reviewed',
        confidence: best.score >= 3 ? 'high' : 'medium', sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        width: best.w, height: best.h };
    } catch (e) {
      if (e.message === 'RATE_LIMIT' || e.message === 'BAD') { await sleep(2500 * (a + 1)); continue; }
      await sleep(800);
    }
  }
  return null;
}

function pickPrice(name) {
  const key = String(name).replace(/[（(].*?[)）]/g, '').trim();
  const recs = prices.byName[key];
  if (!recs || !recs.length) return null;
  const info = recs.filter(r => r.priceType === '信息价');
  const pool = info.length ? info : recs;
  const dbh = pool.filter(r => r.specParsed.type === 'dbh' && r.specParsed.value >= 6 && r.specParsed.value <= 16);
  const use = dbh.length ? dbh : pool;
  const sorted = [...use].sort((a, b) => (a.specParsed.value || 99) - (b.specParsed.value || 99));
  const mid = sorted[Math.floor(sorted.length / 2)];
  const sameType = pool.filter(r => r.priceType === mid.priceType).map(r => r.price);
  return { price: mid.price, min: Math.min(...sameType), max: Math.max(...sameType),
    unit: mid.unit, spec: mid.spec, priceType: mid.priceType, province: mid.province, climate: mid.climate,
    source: mid.source, sourceUrl: mid.sourceUrl, date: mid.date, recordCount: recs.length, status: 'verified' };
}

const phenoByName = new Map(phenology.map(x => [x.name, x]));

async function main() {
  const out = [];
  for (const p of verifiedDoc.plants) {
    const img = await fetchImage(p);
    await sleep(300);
    const price = pickPrice(p.name) || { status: 'unavailable', note: '暂无查证价格，需项目询价' };
    const ph = phenoByName.get(p.name);
    out.push({
      ...p,
      image: img,
      imageStatus: img ? (img.visualType === 'whole-or-habit' ? 'image-available-whole' : 'image-available-detail') : 'image-pending',
      price,
      ornamentalFeatures: ph && ph.features?.length ? [...new Set([...(p.ornamentalFeatures || []), ...ph.features])] : (p.ornamentalFeatures || []),
      phenology: {
        flowerMonths: ph?.flower || p.phenology?.flowerMonths || [],
        fruitMonths: ph?.fruit || p.phenology?.fruitMonths || [],
        colorMonths: ph?.color || p.phenology?.colorMonths || [],
        source: ph ? 'botanical-reference' : 'verified'
      }
    });
    console.log(p.name, img ? 'IMG-OK' : 'IMG-NO', price.status);
  }
  fs.writeFileSync(path.join(ROOT, 'src/data/plants.verified.enriched.json'), JSON.stringify({
    schemaVersion: 1, status: 'enriched-verified', builtAt: new Date().toISOString().slice(0, 10),
    stats: { total: out.length, withImage: out.filter(x => x.image).length, withPrice: out.filter(x => x.price.status === 'verified').length },
    plants: out
  }, null, 2));
  console.log('DONE', out.filter(x => x.image).length + '/' + out.length, 'images');
}
main().catch(e => { console.error(e); process.exit(1); });
