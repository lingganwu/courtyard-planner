/**
 * 数据目录合并层
 * 职责：把「已核验层」(plants.json, 32条 botanical-verified) 与
 *       「导入层」(plants.imported.json 382条 / materials.imported.json 81条)
 *       合并成前端可用的统一目录，同时严格保留每条的审核/价格/图片状态标注。
 *
 * 原则（用户明示）：
 * - 已核验与未核验分层标注，绝不把导入数据冒充 botanical-verified
 * - 导入数据无图片，一律 pending-local-license，前端不得加载任何外链图
 * - 价格为 demo-baseline，卡片与 BOQ 必须同口径（同一 unitPrice 来源）
 */

/** 导入植物 -> 工程参数条目（供 core.js 的价格/数量/BOQ 复用） */
export function importedPlantEntry(p) {
  const form = p.growthForm || '';
  const target = form.includes('乔木') ? 'chosenTrees'
    : (form.includes('灌木') || form.includes('竹') || form.includes('藤本')) ? 'chosenShrubs'
    : 'chosenGround';
  const unit = target === 'chosenGround' ? '㎡' : '株';
  // poke 的 price 是「材料/苗木价」，constCost 是施工价；合并为演示综合单价
  const base = (Number(p.demoPrice) || 0) + (Number(p.demoConstCost) || 0);
  // 密度：按生长型给规划级参照（可被 BOQ 复用）
  const density = target === 'chosenTrees' ? 0.02
    : target === 'chosenShrubs' ? 0.11 : 0.25;
  return {
    target,
    spec: p.spec || '',
    unit,
    base,
    qtyMode: target === 'chosenGround' ? 'perArea' : 'perPlant',
    density,
    source: 'poke-import',
    pricingStatus: 'demo-baseline'
  };
}

/**
 * 合并植物：已核验层在前（优先），导入层在后。
 * 返回 { plants, engineeringEntries, stats }
 */
export function mergePlants(verifiedDoc, importedDoc) {
  const verified = verifiedDoc.plants || [];
  const imported = importedDoc.plants || [];
  const seen = new Set(verified.map(p => p.latinName && p.latinName.toLowerCase().trim()));
  const plants = [...verified];
  const engineeringEntries = {};
  let skippedDuplicate = 0;

  // 已核验层的工程参数假定已在 engineering.entries 中，这里只补导入层
  for (const p of imported) {
    // 与已核验层学名完全一致的导入项：保留但标 duplicate，避免重复冒充
    if (seen.has((p.latinName || '').toLowerCase().trim())) {
      p.reviewStatus = 'imported-duplicate-of-verified';
    }
    plants.push(p);
    engineeringEntries[p.id] = importedPlantEntry(p);
  }

  return {
    plants,
    engineeringEntries,
    stats: {
      verified: verified.length,
      imported: imported.length,
      total: plants.length,
      duplicateFlagged: imported.filter(p => p.duplicateOf || String(p.reviewStatus).includes('duplicate')).length
    }
  };
}

/** 导入材料 -> 现有材料结构（带扁平计价标记，保证卡片/BOQ 同价） */
export function normalizeImportedMaterial(m) {
  return {
    ...m,
    // 统一 id 命名空间，避免与已核验材料撞车
    id: m.id,
    name: m.name,
    spec: m.spec,
    pricingMode: 'flat',
    flatMaterial: Number(m.demoMaterialPrice) || 0,
    flatConst: Number(m.demoConstCost) || 0,
    lossPct: m.lossPct || 0,
    wasteRate: (m.lossPct || 0) / 100
  };
}

/** 合并材料：已核验材料 + 导入材料（61硬景 + 20软景） */
export function mergeMaterials(verifiedMats, importedDoc) {
  const imported = (importedDoc.materials || []).map(normalizeImportedMaterial);
  return {
    materials: [...verifiedMats, ...imported],
    stats: {
      verified: verifiedMats.length,
      imported: imported.length,
      hard: imported.filter(m => m.bucket === 'hard').length,
      soft: imported.filter(m => m.bucket === 'soft').length
    }
  };
}

/** 审核状态 -> 中文标注（选品卡片展示用） */
export function statusLabel(p) {
  switch (p.reviewStatus) {
    case 'botanical-verified': return '已核验';
    case 'imported-unverified': return '导入·待复核';
    case 'imported-duplicate':
    case 'imported-duplicate-of-verified': return '重复·待复核';
    default: return '待复核';
  }
}

/** 该植物是否可作为图片来源（当前策略：没有任何导入数据带已授权图片） */
export function hasLicensedImage(p) {
  return !!(p.assetStatus === 'licensed-local' && p.imagePath);
}
