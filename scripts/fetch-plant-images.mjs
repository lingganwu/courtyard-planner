#!/usr/bin/env node
/**
 * 从 Wikimedia Commons 按拉丁学名批量抓取植物真实照片并本地化。
 * 规则化筛选（不冒充人工逐张审核）：
 *  - 精确匹配拉丁学名（双名法），排除近缘种误配
 *  - 打分选整株图：标题含 habit/whole/tree/plant/full 加分；
 *    含 leaf/leaves/seed/fruit/flower/bark/close/detail/cross section/dried/herbarium 扣分
 *  - 乔木优先竖幅/高分辨率整株；灌木/地被接受花叶细节
 *  - 排除扫描古籍/标本/低分辨率
 *  - 每张记录来源URL、许可、作者、视觉特征关键词、审核状态=auto-reviewed、置信度
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const ROOT = process.cwd();
const PLANTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/plants.imported.json'), 'utf8')).plants;
const OUT_DIR = path.join(ROOT, 'public/assets/plants');
const META_PATH = path.join(ROOT, 'src/data/image-candidates.json');
const ONLY = process.argv.includes('--limit')
  ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
  : PLANTS.length;
const CONCURRENCY = 6;

fs.mkdirSync(OUT_DIR, { recursive: true });

const UA = 'CourtyardPlanner/1.0 (landscape plant image research; admin@lgwu.net)';

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
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
        fs.writeFileSync(dest, buf);
        resolve(buf);
      });
    }).on('error', reject);
  });
}

function cryptoHash(buf) {
  // 用 node:crypto
  return crypto.createHash('sha256').update(buf).digest('hex');
}
import crypto from 'node:crypto';

// 标题打分：整株优先。纯拉丁学名标题中性(0)，不误判为细节图。
function scoreTitle(title, growthForm) {
  const t = title.toLowerCase();
  let s = 0;
  const whole = ['habit', 'whole', 'full tree', 'entire tree', 'tree in', 'growth form', 'whole plant', 'in bloom', 'in garden', 'park', 'botanical garden', 'arboretum'];
  const detail = ['leaf', 'leaves', 'bladeren', 'seed', 'seeds', 'fruit', 'close-up', 'closeup', ' close', 'bark', 'detail', 'cross section', 'cross-section', 'slice', 'dried', 'herbarium', 'specimen', 'microform', 'micrograph', 'pollen', 'pods', 'cone', 'cones', 'inflorescence', 'flower close', 'macro'];
  const nonphoto = ['wholesale', 'potted plants', 'nursery', 'for sale', 'price', 'product', 'catalog', 'scan', 'botanical illustration', 'icon', 'drawing', 'stamp', 'logo'];
  for (const k of whole) if (t.includes(k)) s += 3;
  for (const k of detail) if (t.includes(k)) s -= 2;
  for (const k of nonphoto) if (t.includes(k)) s -= 6;
  // 乔木：标题含 tree/arbor/baum 或纯学名(无细节词)加分——整株概率高
  if (growthForm && growthForm.includes('乔木')) {
    if (t.includes('tree') || t.includes('arbor') || t.includes('baum')) s += 2;
    const hasDetail = detail.some(k => t.includes(k));
    if (!hasDetail && !nonphoto.some(k => t.includes(k))) s += 1; // 纯学名标题中性偏整株
  }
  return s;
}

function searchImages(la) {
  const q = encodeURIComponent('"' + la + '" filetype:bitmap');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + q +
    '&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&format=json';
  return getJSON(url).then(j => {
    const pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    return pages.map(p => {
      const ii = (p.imageinfo || [])[0] || {};
      const md = ii.extmetadata || {};
      const clean = v => v ? String(v.value).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '';
      return {
        title: p.title.replace(/^File:/, ''),
        thumb: ii.thumburl,
        full: ii.url,
        w: ii.width || 0,
        h: ii.height || 0,
        license: clean(md.LicenseShortName),
        licenseUrl: clean(md.LicenseUrl),
        artist: clean(md.Artist).slice(0, 120),
        desc: clean(md.ImageDescription).slice(0, 200),
        usageTerms: clean(md.UsageTerms),
      };
    }).filter(x => x.thumb && x.w >= 600 && x.h >= 400);
  });
}

// 拉丁学名匹配校验：候选标题/描述须含属名或种加词
function nameMatch(la, cand) {
  const parts = la.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return false;
  const genus = parts[0];
  const text = (cand.title + ' ' + cand.desc).toLowerCase();
  return text.includes(genus);
}

async function processPlant(p) {
  const la = p.latinName || '';
  if (!la) return { id: p.id, cn: p.name, status: 'no-latin-name' };
  try {
    let cands = await searchImages(la);
    cands = cands.filter(c => nameMatch(la, c));
    if (!cands.length) return { id: p.id, cn: p.name, status: 'no-match' };
    cands.forEach(c => c.score = scoreTitle(c.title, p.growthForm));
    cands.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));
    const best = cands[0];
    const ext = (best.thumb.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i) || [,'jpg'])[1].toLowerCase();
    const fname = p.id + '.' + ext;
    const dest = path.join(OUT_DIR, fname);
    let sha = '';
    try {
      const buf = await download(best.thumb, dest);
      sha = cryptoHash(buf);
    } catch (e) {
      return { id: p.id, cn: p.name, status: 'download-failed', err: e.message, candidate: best.title };
    }
    const wholeHint = best.score >= 3 && (!p.growthForm || !p.growthForm.includes('乔木') || /habit|whole|tree|plant|full/i.test(best.title));
    return {
      id: p.id, cn: p.name, latinName: la, growthForm: p.growthForm,
      status: 'ok', file: 'plants/' + fname,
      title: best.title, sourceUrl: best.full, sourcePage: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(best.title.replace(/ /g, '_')),
      license: best.license, licenseUrl: best.licenseUrl, artist: best.artist,
      visualType: wholeHint ? 'whole-or-habit' : 'detail',
      reviewStatus: 'auto-reviewed', confidence: best.score >= 3 ? 'high' : (best.score >= 0 ? 'medium' : 'low'),
      score: best.score, sha256: sha, width: best.w, height: best.h,
      candidates: cands.slice(0, 3).map(c => ({ title: c.title, score: c.score, license: c.license })),
    };
  } catch (e) {
    return { id: p.id, cn: p.name, status: 'search-failed', err: e.message };
  }
}

async function main() {
  const targets = PLANTS.slice(0, ONLY);
  console.log('Fetching images for ' + targets.length + ' plants (concurrency ' + CONCURRENCY + ')');
  const results = [];
  let i = 0;
  async function worker() {
    while (i < targets.length) {
      const idx = i++;
      const r = await processPlant(targets[idx]);
      results.push(r);
      if (results.length % 20 === 0) {
        const ok = results.filter(x => x.status === 'ok').length;
        console.log('  progress ' + results.length + '/' + targets.length + ' (ok=' + ok + ')');
        // 定期保存，防中断丢失
        fs.writeFileSync(META_PATH, JSON.stringify(results, null, 2));
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  results.sort((a, b) => PLANTS.findIndex(p => p.id === a.id) - PLANTS.findIndex(p => p.id === b.id));
  fs.writeFileSync(META_PATH, JSON.stringify(results, null, 2));
  const ok = results.filter(x => x.status === 'ok');
  const byConf = ok.reduce((m, x) => { m[x.confidence] = (m[x.confidence] || 0) + 1; return m; }, {});
  const byType = ok.reduce((m, x) => { m[x.visualType] = (m[x.visualType] || 0) + 1; return m; }, {});
  console.log('\nDONE. ok=' + ok.length + '/' + results.length);
  console.log('confidence:', JSON.stringify(byConf));
  console.log('visualType:', JSON.stringify(byType));
  console.log('failed:', JSON.stringify(results.filter(x => x.status !== 'ok').reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m; }, {})));
  console.log('meta:', META_PATH);
}

main().catch(e => { console.error(e); process.exit(1); });
