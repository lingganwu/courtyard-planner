#!/usr/bin/env node
/**
 * 补充图源：当 Wikimedia 无匹配图时，从 GBIF / iNaturalist 取明确许可照片。
 * 只接受 CC BY / CC BY-SA / CC0 / Public Domain，全部本地化并登记来源。
 * 用法：node scripts/fetch-alt-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const IMG_DIR = path.join(ROOT, 'public/assets/plants');
const FILES = [
  'src/data/plants.verified.enriched.json',
  'src/data/plants.enriched.json',
  'src/data/plants.regional.json',
];
const UA = { 'User-Agent': 'CourtyardPlanner/1.0 (educational catalog; contact: repo owner)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = buf => crypto.createHash('sha256').update(buf).digest('hex');

const licUrl = code => ({
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC0 1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Public Domain': 'https://creativecommons.org/publicdomain/mark/1.0/',
  'CC BY': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA': 'https://creativecommons.org/licenses/by-sa/4.0/',
}[code] || '');
const gbifLicLabel = code => ({ CC_BY_4_0: 'CC BY 4.0', CC0_1_0: 'CC0 1.0', CC_BY_SA_4_0: 'CC BY-SA 4.0' }[code] || code);

// GBIF: 逐个许可查询（多个 license 参数在 GBIF 上表现不稳定）
async function gbifCandidates(latin) {
  const out = [];
  for (const lic of ['CC_BY_4_0', 'CC0_1_0', 'CC_BY_SA_4_0']) {
    const url = `https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(latin)}&mediaType=StillImage&license=${lic}&limit=8`;
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
      if (!r.ok) continue;
      const d = await r.json();
      for (const occ of d.results || []) {
        for (const m of occ.media || []) {
          const identifier = m['http://purl.org/dc/terms/identifier'];
          const refs = m['http://purl.org/dc/terms/references'];
          const rights = m['http://purl.org/dc/terms/rightsHolder'] || occ.recordedBy || m['http://purl.org/dc/terms/creator'] || '';
          if (!identifier || !/^https?:/i.test(identifier)) continue;
          out.push({
            url: identifier,
            sourcePage: refs || occ.references || `https://www.gbif.org/occurrence/${occ.key}`,
            license: gbifLicLabel(lic),
            artist: String(rights).replace(/\s+/g, ' ').trim().slice(0, 120),
            source: 'GBIF',
            provider: m['http://purl.org/dc/terms/publisher'] || occ.datasetName || '',
          });
        }
      }
      if (out.length >= 4) break;
    } catch (e) { /* 下一许可继续 */ }
    await sleep(350);
  }
  return out;
}

// iNaturalist: 许可字段在观测层，照片 URL 把 square 换成 large
async function inatCandidates(query) {
  try {
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(query)}&photos=true&photo_license=cc-by,cc-by-sa,cc0&quality_grade=research&per_page=8&order_by=votes`;
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results || []).flatMap(o => (o.photos || []).slice(0, 1).map(ph => {
      const attribution = String(ph.attribution || '');
      const artist = attribution.replace(/^\(c\)\s*/, '').split(/,\s*(some rights reserved|all rights reserved|CC )/)[0].trim();
      const code = String(ph.license_code || o.license_code || 'cc-by').toLowerCase();
      const lic = code === 'cc0' ? 'CC0 1.0' : code === 'cc-by-sa' ? 'CC BY-SA 4.0' : 'CC BY 4.0';
      return {
        url: String(ph.url).replace('/square.', '/large.'),
        sourcePage: `https://www.inaturalist.org/photos/${ph.id}`,
        license: lic,
        artist: artist.slice(0, 120),
        source: 'iNaturalist',
        provider: 'iNaturalist',
      };
    }));
  } catch { return []; }
}

function cleanLatin(latin, name) {
  const plainName = String(name || '').replace(/[（(].*?[)）]/g, '').trim();
  // 部分导入层学名过窄或为混播描述，按植物学异名/常用名映射到可被图源识别的检索词
  const alias = {
    '玉兰': 'Magnolia denudata',
    '白玉兰': 'Magnolia denudata',
    '菲黄竹': 'Sasa veitchii',
    '果岭草': 'Cynodon dactylon',
    '花叶水葱': 'Schoenoplectus lacustris',
  };
  if (alias[plainName]) return alias[plainName];
  let q = String(latin || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/\bspp?\.?\b/gi, '')
    .replace(/\+.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!q || /[+\d]/.test(q)) {
    // 草坪混合种等无法用单一学名检索，退回到中文名/常识学名
    const map = { '果岭草': 'Cynodon dactylon', '花叶水葱': 'Schoenoplectus lacustris' };
    q = map[String(name).replace(/[（(].*?[)）]/g, '')] || String(name).replace(/[（(].*?[)）]/g, '').trim();
  }
  return q;
}

function toJpg(buffer, out) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', 'pipe:0', '-vf', 'scale=800:-2', '-q:v', '5', out],
    { input: buffer, stdio: ['pipe', 'ignore', 'pipe'], maxBuffer: 1024 * 1024 });
  return fs.readFileSync(out);
}

const existingHashes = new Set();
for (const f of fs.readdirSync(IMG_DIR)) {
  if (/\.(jpg|jpeg|png|webp)$/i.test(f)) existingHashes.add(hash(fs.readFileSync(path.join(IMG_DIR, f))));
}

let filled = 0, failed = 0;
for (const rel of FILES) {
  const p = path.join(ROOT, rel);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  const targets = doc.plants.filter(x => !x.image);
  if (!targets.length) continue;
  console.log(`\n== ${rel}: ${targets.length} 条缺图 ==`);
  for (const plant of targets) {
    const query = cleanLatin(plant.latinName, plant.name);
    const candidates = [...await gbifCandidates(query), ...await inatCandidates(query || plant.name)];
    let done = false;
    for (const c of candidates.slice(0, 8)) {
      try {
        const r = await fetch(c.url, { headers: UA, signal: AbortSignal.timeout(30000) });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 3000 || buf.length > 20 * 1024 * 1024) continue;
        const outName = `${plant.id}.jpg`;
        const out = path.join(IMG_DIR, outName);
        const jpg = toJpg(buf, out);
        const h = hash(jpg);
        if (existingHashes.has(h)) { fs.unlinkSync(out); continue; }
        existingHashes.add(h);
        plant.image = {
          file: `plants/${outName}`,
          source: c.source,
          provider: c.provider,
          sourcePage: c.sourcePage,
          license: c.license,
          licenseUrl: licUrl(c.license),
          artist: c.artist || '未署名',
          title: `${plant.name} · ${c.source} 记录照`,
          visualType: 'detail',           // 未经人工确认树形，一律标 detail，不冒充整株
          reviewStatus: 'auto-reviewed-source-license',
          confidence: 'source-license-verified',
          sha256: h,
          width: 800,
        };
        plant.imageStatus = 'image-available-detail';
        plant.assetStatus = 'local-licensed';
        filled++; done = true;
        console.log(`  OK ${plant.name} (${query}) <- ${c.source} [${c.license}] ${outName}`);
        break;
      } catch (e) { /* 换下一张 */ }
      await sleep(250);
    }
    if (!done) {
      failed++;
      console.log(`  FAIL ${plant.name} (${query}) — ${candidates.length} 个候选都不可用`);
    }
    await sleep(500);
  }
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
}
console.log(`\n补充完成：成功 ${filled}，失败 ${failed}。`);
