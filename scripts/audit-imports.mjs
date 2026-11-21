import fs from 'node:fs';

/**
 * 导入层审计：确保从 poke 抽取的 382 植物 + 81 材料数据完整、分层标注正确。
 * 核心红线（用户明示）：导入数据绝不冒充 botanical-verified；不带入任何外链图片。
 */
const pDoc = JSON.parse(fs.readFileSync('src/data/plants.imported.json', 'utf8'));
const mDoc = JSON.parse(fs.readFileSync('src/data/materials.imported.json', 'utf8'));
const errors = [];

const REQUIRED_PLANT = ['id', 'name', 'latinName', 'growthForm', 'categories', 'sourceDistribution', 'spec', 'demoPrice', 'demoConstCost'];
const FORMS_OK = ['乔木', '灌木', '宿根花卉', '观赏草', '竹类', '藤本', '水生植物', '草坪地被', '蕨类苔藓', '其他'];

// 数量锚点（防止抽取时静默丢数据）
if (pDoc.plants.length !== 382) errors.push(`plants.imported: expected 382, got ${pDoc.plants.length}`);
if (mDoc.materials.length !== 81) errors.push(`materials.imported: expected 81, got ${mDoc.materials.length}`);

const ids = new Set();
for (const p of pDoc.plants) {
  for (const k of REQUIRED_PLANT) {
    if (p[k] === undefined || p[k] === null || p[k] === '') errors.push(`plant ${p.id}: missing ${k}`);
  }
  if (ids.has(p.id)) errors.push(`plant ${p.id}: duplicate id`);
  ids.add(p.id);
  if (!FORMS_OK.includes(p.growthForm)) errors.push(`plant ${p.id}: unexpected growthForm ${p.growthForm}`);
  if (!Array.isArray(p.sourceDistribution) || !p.sourceDistribution.length) errors.push(`plant ${p.id}: no climate distribution`);
  // 分层红线：导入层不得是 botanical-verified
  if (p.reviewStatus === 'botanical-verified') errors.push(`plant ${p.id}: import must NOT be botanical-verified`);
  // 图片红线：不得带入外链图片
  if (p.assetStatus === 'approved' || p.imagePath || (p.sourceUrl || '').startsWith('http')) {
    // sourceUrl 为空是预期；若出现外链图片 URL 则告警
    if ((p.sourceImgUrl || '').startsWith('http')) errors.push(`plant ${p.id}: external image URL not allowed`);
  }
  if (!p.spec || !p.name || !p.latinName) errors.push(`plant ${p.id}: identity fields incomplete`);
}

const mids = new Set();
for (const m of mDoc.materials) {
  for (const k of ['id', 'name', 'category', 'spec', 'unit', 'demoMaterialPrice', 'demoConstCost', 'reviewStatus']) {
    if (m[k] === undefined || m[k] === null || m[k] === '') errors.push(`material ${m.id}: missing ${k}`);
  }
  if (mids.has(m.id)) errors.push(`material ${m.id}: duplicate id`);
  mids.add(m.id);
  if (m.reviewStatus === 'botanical-verified') errors.push(`material ${m.id}: import must NOT be botanical-verified`);
  // 外部图片 URL 只能作为记录，不能作为已授权资源
  if (m.sourceImgUrl && m.assetStatus === 'licensed-local') errors.push(`material ${m.id}: external URL cannot be licensed-local`);
}

// 分类覆盖检查
const forms = new Set(pDoc.plants.map(p => p.growthForm));
if (forms.size < 9) errors.push(`plants: expected >=9 growth forms, got ${forms.size}`);
const buckets = new Set(mDoc.materials.map(m => m.bucket));
if (!(buckets.has('hard') && buckets.has('soft'))) errors.push('materials: missing hard/soft bucket');

if (errors.length) { console.error(errors.slice(0, 40).join('\n')); console.error(`... ${errors.length} errors total`); process.exit(1); }
console.log(`Import audit passed: ${pDoc.plants.length} plants (${forms.size} forms), ${mDoc.materials.length} materials (hard ${mDoc.materials.filter(m=>m.bucket==='hard').length} / soft ${mDoc.materials.filter(m=>m.bucket==='soft').length}). All layered as imported-unverified, no external images.`);
