#!/usr/bin/env node
/** 压缩本地图片（ffmpeg 800px/q76），统一转 .jpg，并同步更新两个 enriched 数据文件的 file/sha256 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'public/assets/plants');
const files = fs.readdirSync(DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
let ok = 0, fail = 0;
const renamed = {}; // old -> new

for (const f of files) {
  const src = path.join(DIR, f);
  const base = f.replace(/\.(jpg|jpeg|png|webp)$/i, '');
  const outName = base + '.jpg';
  const tmp = path.join(DIR, '.tmp-' + base + '.jpg');
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=800:-2', '-q:v', '5', tmp], { stdio: 'pipe' });
    if (!fs.existsSync(tmp) || fs.statSync(tmp).size < 1000) throw new Error('bad output');
    fs.renameSync(tmp, path.join(DIR, outName));
    if (outName !== f && fs.existsSync(src)) fs.unlinkSync(src);
    if (outName !== f) renamed[f] = outName;
    ok++;
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    fail++;
  }
}
console.log('compressed', ok, 'failed', fail, 'renamed', Object.keys(renamed).length);

// 同步元数据
for (const rel of ['src/data/plants.enriched.json', 'src/data/plants.verified.enriched.json', 'src/data/plants.regional.json']) {
  const p = path.join(ROOT, rel);
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = 0;
  const ps = doc.plants || doc;
  for (const plant of ps) {
    if (!plant.image || !plant.image.file) continue;
    const oldName = path.basename(plant.image.file);
    const newName = renamed[oldName] || oldName.replace(/\.(png|webp|jpeg)$/i, '.jpg');
    const newPath = path.join(DIR, newName);
    if (!fs.existsSync(newPath)) continue;
    const before = plant.image.file + '|' + plant.image.sha256;
    plant.image.file = 'plants/' + newName;
    plant.image.sha256 = crypto.createHash('sha256').update(fs.readFileSync(newPath)).digest('hex');
    const after = plant.image.file + '|' + plant.image.sha256;
    if (before !== after) changed++;
  }
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  console.log(rel, 'updated', changed);
}
const du = execFileSync('du', ['-sh', DIR], { encoding: 'utf8' }).trim();
console.log('size:', du);
