#!/usr/bin/env node
/** 补抓失败项：低并发 + 延迟 + 限流退避 + 清洗拉丁学名 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const PLANTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/plants.imported.json'), 'utf8')).plants;
const META_PATH = path.join(ROOT, 'src/data/image-candidates.json');
const OUT_DIR = path.join(ROOT, 'public/assets/plants');
let results = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
const byId = new Map(results.map(r => [r.id, r]));
const UA = 'CourtyardPlanner/1.0 (landscape plant research; admin@lgwu.net)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 429 || /^<|^You are|rate.?limit/i.test(d.slice(0, 80))) return reject(new Error('RATE_LIMIT'));
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('BAD_JSON:' + d.slice(0, 30))); }
      });
    }).on('error', reject);
  });
}
function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 3000) return reject(new Error('too small'));
        fs.writeFileSync(dest, buf); resolve(buf);
      });
    }).on('error', reject);
  });
}
function scoreTitle(title, growthForm) {
  const t = title.toLowerCase(); let s = 0;
  const whole = ['habit', 'whole', 'full tree', 'entire tree', 'tree in', 'growth form', 'whole plant', 'in bloom', 'in garden', 'park', 'botanical garden', 'arboretum'];
  const detail = ['leaf', 'leaves', 'bladeren', 'seed', 'seeds', 'fruit', 'close-up', 'closeup', ' close', 'bark', 'detail', 'cross section', 'cross-section', 'slice', 'dried', 'herbarium', 'specimen', 'microform', 'micrograph', 'pollen', 'pods', 'cone', 'cones', 'inflorescence', 'macro'];
  const nonphoto = ['wholesale', 'potted plants', 'nursery', 'for sale', 'price', 'product', 'catalog', 'scan', 'botanical illustration', 'icon', 'drawing', 'stamp', 'logo'];
  for (const k of whole) if (t.includes(k)) s += 3;
  for (const k of detail) if (t.includes(k)) s -= 2;
  for (const k of nonphoto) if (t.includes(k)) s -= 6;
  if (growthForm && growthForm.includes('乔木')) {
    if (t.includes('tree') || t.includes('arbor') || t.includes('baum')) s += 2;
    if (!detail.some(k => t.includes(k)) && !nonphoto.some(k => t.includes(k))) s += 1;
  }
  return s;
}
function cleanLa(la) {
  // 去掉括号里的品种后缀和空格，取属名+种加词
  let x = la.replace(/[（(].*?[)）]/g, ' ').replace(/×/g, ' ').trim();
  const parts = x.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.join(' ');
}
function nameMatch(la, cand) {
  const genus = cleanLa(la).split(' ')[0].toLowerCase();
  return genus.length >= 4 && (cand.title + ' ' + cand.desc).toLowerCase().includes(genus);
}
function searchImages(la) {
  const q = encodeURIComponent('"' + cleanLa(la) + '" filetype:bitmap');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q +
    '&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&format=json';
  return getJSON(url).then(j => {
    const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    return pages.map(p => {
      const ii = (p.imageinfo || [])[0] || {}; const md = ii.extmetadata || {};
      const clean = v => v ? String(v.value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
      return { title: p.title.replace(/^File:/, ''), thumb: ii.thumburl, full: ii.url,
        w: ii.width || 0, h: ii.height || 0, license: clean(md.LicenseShortName),
        licenseUrl: clean(md.LicenseUrl), artist: clean(md.Artist).slice(0, 120),
        desc: clean(md.ImageDescription).slice(0, 200) };
    }).filter(x => x.thumb && x.w >= 600 && x.h >= 400);
  });
}

async function processOne(p) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      let cands = (await searchImages(p.latinName)).filter(c => nameMatch(p.latinName, c));
      if (!cands.length) return { id: p.id, cn: p.name, status: 'no-match' };
      cands.forEach(c => c.score = scoreTitle(c.title, p.growthForm));
      cands.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));
      const best = cands[0];
      const ext = (best.thumb.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i) || [, 'jpg'])[1].toLowerCase();
      const fname = p.id + '.' + ext;
      let buf;
      for (let d = 0; d < 3; d++) { try { buf = await download(best.thumb, path.join(OUT_DIR, fname)); break; } catch (e) { await sleep(800); } }
      if (!buf) return { id: p.id, cn: p.name, status: 'download-failed' };
      const wholeHint = best.score >= 3 && (!p.growthForm || !p.growthForm.includes('乔木') || /habit|whole|tree|plant|full/i.test(best.title));
      return { id: p.id, cn: p.name, latinName: p.latinName, growthForm: p.growthForm,
        status: 'ok', file: 'plants/' + fname, title: best.title, sourceUrl: best.full,
        sourcePage: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(best.title.replace(/ /g, '_')),
        license: best.license, licenseUrl: best.licenseUrl, artist: best.artist,
        visualType: wholeHint ? 'whole-or-habit' : 'detail', reviewStatus: 'auto-reviewed',
        confidence: best.score >= 3 ? 'high' : (best.score >= 0 ? 'medium' : 'low'),
        score: best.score, sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        width: best.w, height: best.h,
        candidates: cands.slice(0, 3).map(c => ({ title: c.title, score: c.score, license: c.license })) };
    } catch (e) {
      if (e.message === 'RATE_LIMIT' || e.message.startsWith('BAD_JSON')) { await sleep(2500 * (attempt + 1)); continue; }
      await sleep(1000);
    }
  }
  return { id: p.id, cn: p.name, status: 'search-failed', err: 'rate-limited-after-retries' };
}

async function main() {
  const failed = PLANTS.filter(p => { const r = byId.get(p.id); return !r || r.status !== 'ok'; });
  console.log('Retrying ' + failed.length + ' plants (concurrency 2)');
  let i = 0, done = 0;
  async function worker() {
    while (i < failed.length) {
      const p = failed[i++];
      const r = await processOne(p);
      byId.set(p.id, r); done++;
      if (done % 15 === 0) {
        console.log('  ' + done + '/' + failed.length + ' ok=' + [...byId.values()].filter(x => x.status === 'ok').length);
        results = PLANTS.map(p => byId.get(p.id)).filter(Boolean);
        fs.writeFileSync(META_PATH, JSON.stringify(results, null, 2));
      }
      await sleep(350); // 请求间隔，避免限流
    }
  }
  await Promise.all([worker(), worker()]);
  results = PLANTS.map(p => byId.get(p.id)).filter(Boolean);
  fs.writeFileSync(META_PATH, JSON.stringify(results, null, 2));
  const ok = results.filter(x => x.status === 'ok');
  console.log('\nDONE ok=' + ok.length + '/' + results.length);
  console.log('failed:', JSON.stringify(results.filter(x => x.status !== 'ok').reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m; }, {})));
}
main().catch(e => { console.error(e); process.exit(1); });
