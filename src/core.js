/**
 * 庭院设计百宝箱 · 核心计算模块
 * 纯函数，无 DOM 依赖，可被浏览器与 Node 测试共用。
 * 植物学事实来自 plants.json；本模块只做空间配平、选品筛选与 BOQ 计价。
 */

/** 空间配平：绿化 + 铺装 + 水景 = 100%，水景自动补差 */
export function balanceSpace(area, greenPct, pavingPct) {
  const g = clampPct(greenPct);
  let p = clampPct(pavingPct);
  if (g + p > 100) p = 100 - g;              // 铺装被压缩，保证不为负
  const w = round(100 - g - p, 4);
  const a = Math.max(0, Number(area) || 0);
  return {
    greenPct: g,
    pavingPct: p,
    waterPct: w,
    greenArea: round(a * g / 100, 2),
    pavingArea: round(a * p / 100, 2),
    waterArea: round(a * w / 100, 2),
    totalArea: a,
    closed: absDiff(g + p + w, 100) < 1e-6
  };
}

/** 气候区匹配：植物的 sourceDistribution(省份) 命中该气候区省份表即可 */
export function matchClimate(plant, climate, engineering) {
  if (!climate || climate === '全部') return true;
  const provinces = engineering.climateRegionByProvince[climate];
  if (!provinces) return false;
  const dist = plant.sourceDistribution || [];
  if (!Array.isArray(dist) || !dist.length) return false;   // 无分布记录不冒充适配
  return dist.some(d => provinces.some(pv => String(d).includes(pv) || String(pv).includes(String(d))));
}

/** 选品筛选：气候区 + 分类 + 观赏属性 + 季相(月份) + 关键词 */
export function filterPlants(plants, engineering, f = {}) {
  const kw = (f.keyword || '').trim().toLowerCase();
  return plants.filter(p => {
    if (!matchClimate(p, f.climate, engineering)) return false;
    if (f.category && f.category !== '全部' && !(p.categories || []).includes(f.category)) return false;
    if (f.feature && f.feature !== '全部' && !(p.ornamentalFeatures || []).includes(f.feature)) return false;
    if (f.season && f.season !== '全部' && !inSeason(p.phenology || {}, f.season)) return false;
    if (f.month && !inMonth(p.phenology || {}, Number(f.month))) return false;
    if (kw) {
      const hay = [p.name, p.latinName, ...(p.aliases || []), ...(p.categories || [])].join(' ').toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/** 季相判断：春3-5 夏6-8 秋9-11 冬12,1,2；有任一物候月份落在区间即命中 */
export function inSeason(phenology, season) {
  const months = allMonths(phenology);
  const ranges = { '春': [3,4,5], '夏': [6,7,8], '秋': [9,10,11], '冬': [12,1,2] };
  const r = ranges[season];
  if (!r) return false;
  return months.some(m => r.includes(m));
}

export function inMonth(phenology, month) {
  return allMonths(phenology).includes(month);
}

function allMonths(ph) {
  return [...new Set([...(ph.flowerMonths || []), ...(ph.fruitMonths || []), ...(ph.colorMonths || [])])];
}

/** 单株/单方价格：演示基线 × 品质档位 */
export function plantUnitPrice(entry, grade = 1) {
  return Math.round((entry.base || 0) * (Number(grade) || 1));
}

/** 工程量：perPlant 按绿化面积×密度估算株数；perArea 按分摊的绿化面积计㎡ */
export function quantity(plant, entry, state, groundCount = 1) {
  const space = balanceSpace(state.area, state.green, state.paving);
  if (entry.qtyMode === 'perArea') {
    return round(space.greenArea / Math.max(1, groundCount), 2);
  }
  // perPlant：该植物按其在乔木/灌木组内的占比分摊绿化面积，再乘密度
  const groupKey = entry.target;
  const groupSize = (state.chosen && state.chosen[groupKey] || []).length || 1;
  const shareArea = space.greenArea / groupSize;
  return Math.max(1, Math.round(shareArea * (entry.density || 0.01)));
}

/** 生成 BOQ 行。硬景单价按构造层工料机拆解汇总，绿化按真实植物+工程参数 */
export function buildBOQ(state, plants, engineering, materials, features = []) {
  const rows = [];
  const space = balanceSpace(state.area, state.green, state.paving);
  const grade = Number(state.grade) || 1;
  const byId = Object.fromEntries(plants.map(p => [p.id, p]));
  const groundCount = (state.chosen && state.chosen.chosenGround || []).length || 1;

  // 硬景：所选材料，按铺装面积
  const mat = materials.find(m => m.id === state.selectedMaterial) || materials[0];
  if (mat && space.pavingArea > 0) {
    rows.push({
      division: '硬景', name: mat.name, spec: mat.spec, unit: '㎡',
      qty: space.pavingArea, unitPrice: materialUnitPrice(mat, grade),
      source: 'demo-baseline'
    });
  }

  // 绿化：真实植物库
  for (const key of ['chosenTrees', 'chosenShrubs', 'chosenGround']) {
    for (const id of (state.chosen && state.chosen[key] || [])) {
      const p = byId[id];
      const e = engineering.entries[id];
      if (!p || !e) continue;                               // 数据缺失直接跳过，不造假补位
      rows.push({
        division: '绿化', name: `${p.name}（${p.latinName}）`, spec: e.spec,
        unit: e.unit, qty: quantity(p, e, state, groundCount),
        unitPrice: plantUnitPrice(e, grade), source: 'demo-baseline',
        plantId: id, reviewStatus: p.reviewStatus
      });
    }
  }

  // 景观小品/水系：独立选配
  for (const id of (state.chosenFeatures || [])) {
    const f = features.find(x => x.id === id);
    if (!f) continue;
    let qty = 1;
    if (f.unit === '㎡') qty = f.category === '水系' ? space.waterArea : round(space.waterArea * 0.4, 2);
    rows.push({
      division: f.category, name: f.name, spec: f.spec, unit: f.unit,
      qty, unitPrice: Math.round((f.price || 0) * grade), source: 'demo-baseline'
    });
  }

  // 水景/构筑：未选配小品时保留空间提示，不虚构单价
  if (space.waterArea > 0 && !(state.chosenFeatures || []).length) {
    rows.push({
      division: '水景/构筑', name: '空间预留', spec: '可在小品模块中选配廊架/景墙/置石/鱼池',
      unit: '㎡', qty: space.waterArea, unitPrice: 0, source: 'placeholder'
    });
  }
  return rows;
}

/** 材料工料机拆解：主材+基层辅材+人工+机械+物流+损耗+措施 */
export function materialBreakdown(mat, grade = 1) {
  const layers = (mat.constructionLayers || []);
  const main = layers.length ? layers[0].cost : 0;
  const sub = layers.slice(1).reduce((s, l) => s + (Number(l.cost) || 0), 0);
  const p = mat.pricing || {};
  const labor = Number(p.labor) || 0;
  const machine = Number(p.machine) || 0;
  const logistics = Number(p.logistics) || 0;
  const measure = Number(p.measure) || 0;
  const waste = round((main + sub) * (Number(mat.wasteRate) || 0));
  const subtotal = main + sub + labor + machine + logistics + waste + measure;
  const g = Number(grade) || 1;
  const rows = {
    main: round(main * g), sub: round(sub * g), labor: round(labor * g),
    machine: round(machine * g), logistics: round(logistics * g),
    waste: round(waste * g), measure: round(measure * g)
  };
  const total = round(Object.values(rows).reduce((a, b) => a + b, 0));
  return { rows, subtotal: round(subtotal * g), total, closed: absDiff(subtotal, Object.values(rows).reduce((a,b)=>a+b,0) / g) < 0.01 };
}

/** 材料综合单价：工料机拆解合计 × 品质档位（演示）
 *  导入层材料用 pricingMode:'flat'，直接 材料价+施工价 同乘品质档位，
 *  保证卡片标价与 BOQ 单价完全同源（避免 poke 版卡片/清单价不一致的缺陷）。 */
export function materialUnitPrice(mat, grade = 1) {
  const g = Number(grade) || 1;
  if (mat && mat.pricingMode === 'flat') {
    return round(((Number(mat.flatMaterial) || 0) + (Number(mat.flatConst) || 0)) * g);
  }
  return materialBreakdown(mat, grade).total;
}

/** 材料拆解行：兼容扁平计价材料（返回材料价/施工价两项） */
export function materialBreakdownRows(mat, grade = 1) {
  const g = Number(grade) || 1;
  if (mat && mat.pricingMode === 'flat') {
    return {
      rows: { main: round((Number(mat.flatMaterial) || 0) * g), const: round((Number(mat.flatConst) || 0) * g) },
      total: materialUnitPrice(mat, g)
    };
  }
  const b = materialBreakdown(mat, g);
  return { rows: b.rows, total: b.total };
}

export function boqTotal(rows) {
  return rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0), 0);
}

/** CSV 导出（带 BOM，Excel 中文不乱码） */
export function toCSV(rows) {
  const head = ['分部', '项目', '规格/特征', '单位', '工程量', '综合单价', '合价', '数据状态'];
  const body = rows.map(r => [r.division, r.name, r.spec, r.unit, r.qty, r.unitPrice,
    round((Number(r.qty) || 0) * (Number(r.unitPrice) || 0), 2), r.source || '']);
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return '\uFEFF' + [head, ...body].map(r => r.map(esc).join(',')).join('\r\n');
}

/** 方案快照校验：结构是否完整 */
export function validSnapshot(s) {
  return !!(s && s.area !== undefined && s.green !== undefined && s.paving !== undefined &&
    s.chosen && s.selectedMaterial);
}

export function clampPct(v) { return Math.min(100, Math.max(0, Number(v) || 0)); }
export function round(v, n = 2) { const f = Math.pow(10, n); return Math.round((Number(v) || 0) * f) / f; }
export function absDiff(a, b) { return Math.abs((Number(a) || 0) - (Number(b) || 0)); }
