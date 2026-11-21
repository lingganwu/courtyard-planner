import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const manifestPath = path.join(root, 'src/data/assets.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const seen = new Map();
const errors = [];

for (const item of manifest.assets) {
  const required = ['id','entityId','entityName','localPath','source','license','imageType','reviewStatus'];
  for (const key of required) if (!item[key]) errors.push(`${item.id || 'unknown'}: missing ${key}`);
  if (/^https?:\/\//i.test(item.localPath || '')) errors.push(`${item.id}: remote image is not allowed`);
  const file = path.join(root, item.localPath || '');
  if (!fs.existsSync(file)) { errors.push(`${item.id}: missing local file ${item.localPath}`); continue; }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (seen.has(hash)) errors.push(`${item.id}: duplicate image content with ${seen.get(hash)}`);
  else seen.set(hash, item.id);
  if (item.reviewStatus !== 'approved') errors.push(`${item.id}: image is not approved`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Asset audit passed: ${manifest.assets.length} approved local assets.`);
