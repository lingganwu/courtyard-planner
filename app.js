/**
 * 庭院设计百宝箱 · 前端主控
 * 数据：plants.json(已核验植物学) + engineering.json/materials.json/features.json(演示工程参数)
 * 计算：src/core.js 纯函数（与测试共用）
 */
import {
  balanceSpace, filterPlants, buildBOQ, boqTotal, toCSV,
  materialBreakdown, materialBreakdownRows, validSnapshot, plantUnitPrice, quantity, round
} from './src/core.js';
import {
  mergePlants, mergeMaterials, statusLabel, hasLicensedImage, imagePath, priceLabel, priceTypeTag
} from './src/catalog.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => '¥' + Math.round(n || 0).toLocaleString('zh-CN');

// 运行时数据（从 JSON 加载，不再内嵌假数据）
let PLANTS = [], ENGINEERING = null, MATERIALS = [], FEATURES = [], PLANTS_BY_ID = {}, STYLES = [];
let CATALOG_STATS = null;
let PICKER_PAGE = 1;
const PAGE_SIZE = 24;

// 分类/属性/季相选项从真实数据统计得出
let CATEGORIES = ['全部'], FEATURES_OPT = ['全部'], SEASONS = ['全部', '春', '夏', '秋', '冬'];
const MONTHS = ['全部', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const state = {
  chosen: { chosenTrees: [], chosenShrubs: [], chosenGround: [] },
  chosenFeatures: [],
  selectedMaterial: 'granite',
  selectedStyle: null,
  specTiers: {},      // { plantId: 'eco'|'std'|'premium' }
  qtyAdjust: {},      // { plantId: number } 手动数量覆盖
  priceOverrides: {}, // { rowKey: number } 单价覆写
  filters: { category: '全部', feature: '全部', season: '全部', month: null, source: '全部' },
  view: 'cost'
};

function toast(t) {
  const x = $('#toast');
  x.textContent = t;
  x.classList.add('show');
  setTimeout(() => x.classList.remove('show'), 1500);
}

/* ---------------- 数据加载 ---------------- */
async function loadData() {
  const files = [
    './src/data/plants.verified.enriched.json', './src/data/engineering.json',
    './src/data/materials.json', './src/data/features.json',
    './src/data/plants.enriched.json', './src/data/materials.imported.json',
    './src/data/plants.regional.json', './src/data/styles.json'
  ];
  const res = await Promise.all(files.map(f => fetch(f)));
  if (res.some(r => !r.ok)) throw new Error('数据文件加载失败');
  const [plantsDoc, eng, matDoc, featDoc, plantsEnriched, matsImp, plantsRegional, stylesDoc] = await Promise.all(res.map(r => r.json()));

  // 合并三层：已核验层 + poke导入层 + 区域补充层（均整合图片/价格/物候，严格分层标注）
  const merged = mergePlants(plantsDoc, {
    plants: [...plantsEnriched.plants, ...plantsRegional.plants],
    importMeta: { importedAt: plantsEnriched.builtAt }
  });
  const mergedMats = mergeMaterials(matDoc.materials, matsImp);
  PLANTS = merged.plants;
  ENGINEERING = eng;
  // 把导入植物的工程参数并入 entries，供 BOQ/价格复用
  Object.assign(ENGINEERING.entries, merged.engineeringEntries);
  MATERIALS = mergedMats.materials;
  FEATURES = featDoc.features;
  STYLES = stylesDoc.styles || [];
  PLANTS_BY_ID = Object.fromEntries(PLANTS.map(p => [p.id, p]));
  CATALOG_STATS = { plants: merged.stats, materials: mergedMats.stats, builtAt: plantsEnriched.builtAt };

  // 从真数据统计筛选项
  const cats = new Set(), feats = new Set();
  for (const p of PLANTS) {
    (p.categories || []).forEach(c => cats.add(c));
    (p.ornamentalFeatures || []).forEach(f => feats.add(f));
  }
  CATEGORIES = ['全部', ...[...cats].sort()];
  FEATURES_OPT = ['全部', ...[...feats].sort()];

  const v = merged.stats.verified, im = merged.stats.imported;
  const imgCount = PLANTS.filter(p => p.image && p.image.file).length;
  const priceCount = PLANTS.filter(p => p.price && p.price.status === 'verified').length;
  $('#dataStatus').textContent = `植物 ${PLANTS.length} 条（已核验 ${v} · 导入待复核 ${im}）· 材料 ${MATERIALS.length} 项 · 本地图片 ${imgCount} 张 · 查证价 ${priceCount} 条`;
  $('#plantLibStat').textContent = `共 ${PLANTS.length} 条（已核验 ${v}）`;
  $('#pickerSource').textContent = `全目录 ${PLANTS.length} 条 · 已核验 ${v} / 导入 ${im}（导入层未经植物学复核）`;
}

/* ---------------- 状态读取 ---------------- */
function currentState() {
  return {
    area: +$('#area').value || 0,
    green: +$('#green').value || 0,
    paving: +$('#paving').value || 0,
    grade: +$('#grade').value || 1,
    city: $('#city').value,
    climate: $('#climate').value,
    sun: $('#sun').value,
    site: $('#site').value,
    chosen: JSON.parse(JSON.stringify(state.chosen)),
    chosenFeatures: [...state.chosenFeatures],
    selectedMaterial: state.selectedMaterial,
    selectedStyle: state.selectedStyle,
    specTiers: JSON.parse(JSON.stringify(state.specTiers)),
    qtyAdjust: JSON.parse(JSON.stringify(state.qtyAdjust)),
    priceOverrides: JSON.parse(JSON.stringify(state.priceOverrides))
  };
}

/* ---------------- 渲染 ---------------- */
function renderSpace() {
  const s = balanceSpace($('#area').value, $('#green').value, $('#paving').value);
  const set = (id, v) => $(id).textContent = v;
  set('#greenText', s.greenPct + '%');
  set('#pavingText', s.pavingPct + '%');
  set('#waterText', s.waterPct + '%');
  set('#greenArea', s.greenArea + '㎡');
  set('#pavingArea', s.pavingArea + '㎡');
  set('#waterArea', s.waterArea + '㎡');
  set('#kArea', s.totalArea + '㎡');
  set('#kGreen', s.greenArea + '㎡');
  set('#kPaving', s.pavingArea + '㎡');
  set('#kWater', s.waterArea + '㎡');
  set('#greenRate', s.greenPct + '%');
  set('#hardRate', (100 - s.greenPct) + '%');
  $('#segGreen').style.width = s.greenPct + '%';
  $('#segPaving').style.width = s.pavingPct + '%';
  $('#segWater').style.width = s.waterPct + '%';
  $('#water').value = s.waterPct;
}

function renderChosen() {
  const st = currentState();
  for (const [key, box] of [['chosenTrees', '#chosenTrees'], ['chosenShrubs', '#chosenShrubs'], ['chosenGround', '#chosenGround']]) {
    const el = $(box);
    const ids = state.chosen[key];
    el.innerHTML = ids.length ? ids.map(id => {
      const p = PLANTS_BY_ID[id];
      const e = ENGINEERING.entries[id];
      if (!p || !e) return '';
      const tier = state.specTiers[id] || 'std';
      const autoQty = quantity(p, e, st, (state.chosen.chosenGround.length) || 1);
      const qty = state.qtyAdjust[id] !== undefined ? Number(state.qtyAdjust[id]) : autoQty;
      const unit = plantUnitPrice(e, st.grade, tier);
      const ipath = imagePath(p);
      const thumb = ipath
        ? `<img class="plant-thumb" src="${ipath}" alt="${p.name}" loading="lazy" onerror="this.style.visibility='hidden'">`
        : '<span class="plant-thumb"></span>';
      const tiers = [['eco','经济'],['std','标配'],['premium','特选']].map(([k,label]) =>
        `<button data-tier="${k}" data-plant="${id}" class="${tier===k?'active':''}">${label}</button>`).join('');
      const feat = (p.ornamentalFeatures || []).slice(0,3).join(' / ');
      return `<article class="plant-card">
        <div class="pc-top">${thumb}<div style="min-width:0"><h4 style="margin:0">${p.name}</h4><small>${p.latinName}</small>
          <div style="margin-top:4px">${feat ? '<span class="tag">'+feat+'</span>' : ''}</div></div>
          <button data-remove="${id}" data-target="${key}" title="移除" style="margin-left:auto;border:0;background:transparent;color:#a23b35;cursor:pointer;font-size:16px">×</button>
        </div>
        <div class="pc-tier">${tiers}<small>${e.spec}</small></div>
        <div class="pc-qty">
          <div class="qty-stepper"><button data-qty="dec" data-plant="${id}">−</button><b>${qty}</b><button data-qty="inc" data-plant="${id}">＋</button></div>
          <span style="font-size:11px;color:var(--muted)">${e.unit} · ${state.qtyAdjust[id]!==undefined?'手动':'按面积'}</span>
          <div class="pc-price"><b>${money(unit)}</b><small>×${qty} = ${money(unit*qty)}</small></div>
        </div>
      </article>`;
    }).join('') : '<div class="empty">尚未选择。点击上方按钮从分层植物目录添加。</div>';
  }
}

function renderFeatures() {
  $('#featureGrid').innerHTML = FEATURES.map(f => {
    const on = state.chosenFeatures.includes(f.id);
    return `<article class="feature-card ${on ? 'active' : ''}" data-feature="${f.id}">
      <header><div><h4>${f.name}</h4><small>${f.category} · ${f.spec}</small></div><span class="sel">${on ? '已选' : '＋ 选配'}</span></header>
      <footer><b>${money(f.price)}/${f.unit}</b><small>${f.qtyHint} · 演示基线</small></footer>
      <ul>${(f.layers || []).map(l => `<li>${l}</li>`).join('')}</ul>
    </article>`;
  }).join('');
}

function renderMaterials() {
  const st = currentState();
  $('#materialGrid').innerHTML = MATERIALS.map(m =>
    `<button class="material ${m.id === state.selectedMaterial ? 'active' : ''}" data-mat="${m.id}">
      <b>${m.name}</b><small>${m.spec}</small><strong>${money(materialBreakdownRows(m, st.grade).total)}/${m.unit || '㎡'}</strong>
    </button>`).join('');
  const m = MATERIALS.find(x => x.id === state.selectedMaterial) || MATERIALS[0];
  $('#buildTitle').textContent = m.name + ' · ' + m.spec;
  const flat = m.pricingMode === 'flat';
  const layerColors = ['#8a6f52','#b9b2a3','#9aa7ad','#7d8b80','#c0b79a','#a89a86'];
  $('#buildLayers').innerHTML = flat
    ? (m.buildUp || []).map((l,i) => `<li><i class="layer-visual" style="background:${layerColors[i%layerColors.length]}"></i><b style="color:var(--ink)">层次 ${i+1}</b> <span>${l}</span></li>`).join('') || '<li>构造断面待补充</li>'
    : (m.constructionLayers || []).map((l,i) => `<li><i class="layer-visual" style="background:${layerColors[i%layerColors.length]}"></i><b>${l.name}</b><span>${l.desc}</span></li>`).join('');
  const b = materialBreakdownRows(m, st.grade);
  $('#costTitle').textContent = money(b.total) + ' /' + (m.unit || '㎡');
  const entries = flat
    ? [['主材', b.rows.main], ['施工', b.rows.const]]
    : [['主材', b.rows.main], ['基层/辅材', b.rows.sub], ['人工', b.rows.labor], ['机械', b.rows.machine],
       ['物流', b.rows.logistics], ['损耗', b.rows.waste], ['措施', b.rows.measure]];
  $('#costRows').innerHTML = entries.map(([v, val]) =>
    `<li><span>${v}</span><b>${money(val)}</b></li>`).join('');
  $('#wasteNote').textContent = (flat
    ? `损耗率 ${(m.lossPct || 0).toFixed(0)}%`
    : `损耗率 ${((m.wasteRate || 0) * 100).toFixed(0)}%`) + ' · 来源:' + (m.sourceType || 'baseline') + ' · 演示价非正式询价';
}

function renderBOQ() {
  const st = currentState();
  const rows = buildBOQ(st, PLANTS, ENGINEERING, MATERIALS, FEATURES);
  const total = boqTotal(rows);
  $('#boqTotal').textContent = money(total);
  $('#kCost').textContent = money(total);
  $('#boqBody').innerHTML = rows.map(r => {
    const sum = r.qty * r.unitPrice;
    const badge = r.source === 'placeholder' ? ' <small class="tag">预留</small>' : '';
    return `<tr><td>${r.division}</td><td>${r.name}${badge}</td><td>${r.spec}</td><td>${r.unit}</td><td>${r.qty}</td><td>${money(r.unitPrice)}</td><td>${money(sum)}</td></tr>`;
  }).join('');
  renderOwnerView(rows, total, st);
  renderBudget(rows, total, st);
  persistCurrent();
}

function renderOwnerView(rows, total, st) {
  const byDiv = {};
  for (const r of rows) {
    const sum = r.qty * r.unitPrice;
    byDiv[r.division] = (byDiv[r.division] || 0) + sum;
  }
  const plantCount = Object.values(st.chosen).flat().length;
  const box = $('#ownerView');
  box.innerHTML = `
    <div class="owner-summary">
      <div class="owner-hero"><small>项目估算总额（演示基线）</small><strong>${money(total)}</strong><p>${st.city || '—'} · ${st.climate} · ${st.area}㎡ · ${$('#grade').selectedOptions[0].text}</p></div>
      <div class="owner-chart">${Object.entries(byDiv).map(([k, v]) => {
        const pct = total ? (v / total * 100) : 0;
        return `<div class="owner-bar"><div class="owner-bar-label"><span>${k}</span><b>${money(v)} · ${pct.toFixed(0)}%</b></div><div class="owner-bar-track"><i style="width:${pct}%"></i></div></div>`;
      }).join('')}</div>
    </div>
    <div class="owner-points">
      <div><small>绿地率</small><b>${st.green}%</b></div>
      <div><small>硬景率</small><b>${100 - st.green}%</b></div>
      <div><small>已选植物</small><b>${plantCount} 种</b></div>
      <div><small>已选小品</small><b>${state.chosenFeatures.length} 项</b></div>
    </div>
    <p class="note">业主汇报版仅做汇总呈现，金额与施工算量版同源。所有价格为演示基线，正式汇报前须替换为经核实的地区询价。</p>`;
}

/* ---------------- 风格选择 ---------------- */
// 用内联 SVG 生成风格封面（无外链、可复现、许可无忧）
function styleCover(s) {
  const c = s.accent;
  const scenes = {
    'new-chinese': `<rect width="280" height="118" fill="#eef1ea"/><path d="M0 60 Q70 20 140 60 Q210 100 280 60 L280 0 L0 0Z" fill="#5c6b5a"/><circle cx="140" cy="62" r="30" fill="none" stroke="#eef1ea" stroke-width="7"/><rect x="20" y="70" width="240" height="48" fill="#dfe4d9"/><text x="140" y="98" text-anchor="middle" font-size="9" fill="#6a756f">月洞门 · 青砖 · 松</text>`,
    'minimal-modern': `<rect width="280" height="118" fill="#eef0f0"/><rect x="0" y="70" width="280" height="48" fill="#d8dedd"/><rect x="40" y="80" width="200" height="6" fill="${c}"/><rect x="70" y="92" width="140" height="4" fill="#b9c2c1"/><path d="M140 70 L140 30 M140 40 l20 -12 M140 48 l-18 -10" stroke="#6f7c78" stroke-width="2"/><circle cx="140" cy="28" r="9" fill="#9fb0a6"/>`,
    'cottage-natural': `<rect width="280" height="118" fill="#eef2e6"/><path d="M0 90 Q60 60 140 85 Q220 110 280 80 L280 118 L0 118Z" fill="#c6d2a8"/><g fill="#b06c8a"><circle cx="60" cy="78" r="6"/><circle cx="95" cy="70" r="5"/><circle cx="180" cy="82" r="7"/><circle cx="220" cy="72" r="5"/></g><g fill="#d8b24a"><circle cx="130" cy="88" r="5"/><circle cx="205" cy="92" r="4"/></g><text x="140" y="24" text-anchor="middle" font-size="9" fill="#6a756f">自然花境 · 混播宿根</text>`,
    'zen-shansui': `<rect width="280" height="118" fill="#f2f0e9"/><path d="M0 60 Q140 30 280 60 M0 80 Q140 55 280 85" stroke="#d6d2c4" stroke-width="3" fill="none"/><ellipse cx="110" cy="78" rx="26" ry="14" fill="#8d958a"/><ellipse cx="180" cy="88" rx="16" ry="9" fill="#a7ada2"/><circle cx="215" cy="50" r="14" fill="#b0563f"/><text x="140" y="24" text-anchor="middle" font-size="9" fill="#8a8a7e">白砂 · 置石 · 红枫</text>`
  };
  return `<svg viewBox="0 0 280 118" preserveAspectRatio="xMidYMid slice">${scenes[s.id] || scenes['new-chinese']}</svg>`;
}

function renderStyles() {
  if (!STYLES.length) return;
  $('#styleGrid').innerHTML = STYLES.map(s => `
    <button class="style-card ${state.selectedStyle===s.id?'active':''}" data-style="${s.id}">
      <div class="style-cover">${styleCover(s)}<span class="style-check">✓</span></div>
      <div class="style-body"><h4>${s.name}</h4><span class="en">${s.nameEn}</span>
        <div class="tagline">${s.tagline}</div></div>
    </button>`).join('');
  const cur = STYLES.find(s => s.id === state.selectedStyle);
  const stat = $('#styleStat'); if (stat) stat.textContent = cur ? '当前：' + cur.name : '未选择';
  const detail = $('#styleDetail');
  if (detail) detail.innerHTML = cur ? `<div class="style-desc">
      <div><small>植物配置</small><p>${cur.desc.plants}</p></div>
      <div><small>铺装 / 材料</small><p>${cur.desc.materials}</p></div>
      <div><small>构筑物 / 水景</small><p>${cur.desc.structures}</p></div>
    </div>` : '';
}

function applyStyle(id) {
  const s = STYLES.find(x => x.id === id);
  if (!s) return;
  state.selectedStyle = id;
  const d = s.defaults;
  state.chosen.chosenTrees = [...(d.trees || [])];
  state.chosen.chosenShrubs = [...(d.shrubs || [])];
  state.chosen.chosenGround = [...(d.ground || [])];
  state.chosenFeatures = [...(d.features || [])];
  state.selectedMaterial = d.material || 'granite';
  state.specTiers = {};
  state.qtyAdjust = {};
  renderAll();
  toast('已应用风格：' + s.name);
}

/* ---------------- 单价覆写表 ---------------- */
function renderOverrides() {
  const body = $('#overrideBody'); if (!body) return;
  const st = currentState();
  const rows = buildBOQ(st, PLANTS, ENGINEERING, MATERIALS, FEATURES);
  // 无覆写版本，取默认单价
  const defaultRows = buildBOQ({ ...st, priceOverrides: {} }, PLANTS, ENGINEERING, MATERIALS, FEATURES);
  const defMap = {}; defaultRows.forEach(r => { if (r.rowKey) defMap[r.rowKey] = r.unitPrice; });
  const byKey = {};
  rows.forEach(r => { if (r.rowKey) byKey[r.rowKey] = r; });
  const entries = Object.entries(byKey);
  body.innerHTML = entries.length ? entries.map(([key, r]) => {
    const ov = state.priceOverrides[key];
    const custom = ov !== undefined && ov !== '';
    return `<tr><td>${r.name}<br><small style="color:var(--muted)">${r.spec}</small></td>
      <td>${r.unit}</td><td>${money(defMap[key])}</td>
      <td><input type="number" min="0" data-ov="${key}" value="${ov!==undefined?ov:''}" placeholder="—"></td>
      <td class="ov-current">${money(r.unitPrice)}${custom?'<span class="ov-custom">自定</span>':''}</td></tr>`;
  }).join('') : '<tr><td colspan="5" style="color:var(--muted)">先在上方选配植物与材料后，可在此覆写单价。</td></tr>';
}

/* ---------------- 底部预算条 + Hero ---------------- */
function renderBudget(rows, total, st) {
  const perM2 = st.area ? Math.round(total / st.area) : 0;
  const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  set('#heroCost', money(total)); set('#heroPerM2', '约 ' + money(perM2) + '/㎡');
  set('#bbCost', money(total)); set('#bbPerM2', '约 ' + money(perM2) + '/㎡');
  set('#bbArea', st.area + '㎡');
  const space = balanceSpace(st.area, st.green, st.paving);
  set('#heroGreen', space.greenArea + '㎡'); set('#heroPaving', space.pavingArea + '㎡'); set('#heroWater', space.waterArea + '㎡');
  const byDiv = {};
  rows.forEach(r => { byDiv[r.division] = (byDiv[r.division] || 0) + r.qty * r.unitPrice; });
  const colors = { '硬景':'#344252','绿化':'#1f684c','小品':'#8a6fb0','构筑物':'#b07a3f','水系':'#1676a5' };
  const bb = $('#bbBreak');
  if (bb) bb.innerHTML = Object.entries(byDiv).slice(0,6).map(([k,v]) =>
    `<span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[k]||'#888'};margin-right:5px"></i>${k} <b>${money(v)}</b></span>`).join('');
}

function renderAll() {
  renderSpace();
  renderChosen();
  renderFeatures();
  renderMaterials();
  renderBOQ();
  renderStyles();
  renderOverrides();
}

/* ---------------- 选品抽屉 ---------------- */
function chips(id, items, key) {
  $(id).innerHTML = items.map(x => {
    const label = x === '全部' ? '全部' : (key === 'month' ? x + '月' : x);
    return `<button class="chip ${String(state.filters[key]) === String(x) ? 'active' : ''}" data-filter="${key}" data-value="${x}">${label}</button>`;
  }).join('');
}

function renderPicker() {
  chips('#categoryTabs', CATEGORIES, 'category');
  chips('#featureTabs', FEATURES_OPT, 'feature');
  chips('#seasonTabs', SEASONS, 'season');
  chips('#monthTabs', MONTHS, 'month');
  chips('#sourceTabs', ['全部', '已核验', '导入待复核'], 'source');
  $('#pickerClimate').textContent = $('#climate').value + ' · 气候匹配仅供参考';

  let list = filterPlants(PLANTS, ENGINEERING, {
    climate: $('#climate').value,
    category: state.filters.category,
    feature: state.filters.feature,
    season: state.filters.season,
    month: state.filters.month,
    keyword: $('#search').value
  });
  // 数据源分层筛选
  if (state.filters.source === '已核验') list = list.filter(p => p.reviewStatus === 'botanical-verified');
  if (state.filters.source === '导入待复核') list = list.filter(p => String(p.reviewStatus).startsWith('imported'));

  $('#matchCount').textContent = list.length + ' / ' + PLANTS.length + ' 条匹配';
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (PICKER_PAGE > pages) PICKER_PAGE = pages;
  const pageList = list.slice((PICKER_PAGE - 1) * PAGE_SIZE, PICKER_PAGE * PAGE_SIZE);

  $('#pickerGrid').innerHTML = pageList.map(p => {
    const e = ENGINEERING.entries[p.id];
    const target = e.target;
    const added = state.chosen[target].includes(p.id);
    const label = statusLabel(p);
    const cls = label === '已核验' ? 'ok' : 'warn';
    const ipath = imagePath(p);
    const thumb = ipath
      ? `<div class="pick-thumb"><img src="${ipath}" alt="${p.name}" loading="lazy" onerror="this.parentElement.classList.add('img-fail')"><span class="img-badge">${p.image?.visualType === 'whole-or-habit' ? '整株' : '细节'}</span></div>`
      : '<div class="pick-thumb no-img"><span>图片待补</span></div>';
    const ph = p.phenology || {};
    const pheno = (ph.flowerMonths?.length ? '花' + ph.flowerMonths.join(',') : '') +
      (ph.fruitMonths?.length ? ' 果' + ph.fruitMonths.join(',') : '') +
      (ph.colorMonths?.length ? ' 色' + ph.colorMonths.join(',') : '');
    const priceSrc = priceLabel(p);
    const priceCls = p.price?.status === 'verified' ? 'verified' : 'pending';
    return `<article class="pick">
      ${thumb}
      <h4>${p.name} ${added ? '<small class="tag">已加入</small>' : ''}<span class="review ${cls}">${label}</span></h4>
      <em>${p.latinName}</em>
      <p>${(p.categories || []).join(' / ')}${(p.ornamentalFeatures || []).length ? '<br>' + p.ornamentalFeatures.join(' / ') : ''}${pheno ? '<br><span class="pheno">物候 ' + pheno + '</span>' : ''}<br>${e.spec}</p>
      <footer><b>${money(plantUnitPrice(e, +$('#grade').value || 1))}/${e.unit}</b><button data-add="${p.id}" data-target="${target}" ${added ? 'disabled' : ''}>${added ? '已加入' : '加入'}</button></footer>
      <div class="pick-source">${priceSrc}<span class="price-tag ${priceCls}">${priceTypeTag(p)}</span>${p.image ? ' · 图源Wikimedia/' + (p.image.license || 'CC') : ''}</div>
    </article>`;
  }).join('') || '<div class="empty">当前筛选无匹配项。已核验库不补假条目。</div>';

  // 分页控件
  const pager = $('#pickerPager');
  if (pager) {
    pager.innerHTML = pages <= 1 ? '' :
      `<button data-page="prev" ${PICKER_PAGE === 1 ? 'disabled' : ''}>‹ 上一页</button>
       <span>第 ${PICKER_PAGE} / ${pages} 页</span>
       <button data-page="next" ${PICKER_PAGE === pages ? 'disabled' : ''}>下一页 ›</button>`;
  }
}

function openPicker(def) {
  state.filters.category = def === '灌木' ? '灌木与球类' : def === '地被' ? '地被草本' : '全部';
  state.filters.feature = '全部';
  state.filters.season = '全部';
  state.filters.month = null;
  state.filters.source = '全部';
  PICKER_PAGE = 1;
  $('#search').value = '';
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  renderPicker();
}

/* ---------------- 方案 ---------------- */
function snapshot() {
  const s = currentState();
  s.total = boqTotal(buildBOQ(s, PLANTS, ENGINEERING, MATERIALS, FEATURES));
  return s;
}
function applySnapshot(s) {
  if (!validSnapshot(s)) return;
  $('#city').value = s.city || '';
  $('#climate').value = s.climate || '华北温带';
  $('#area').value = s.area;
  $('#sun').value = s.sun || '南向 / 全日照';
  $('#grade').value = s.grade || 1;
  $('#site').value = s.site || '毛坯新院';
  $('#green').value = s.green;
  $('#paving').value = s.paving;
  state.chosen = JSON.parse(JSON.stringify(s.chosen));
  state.chosenFeatures = [...(s.chosenFeatures || [])];
  state.selectedMaterial = s.selectedMaterial;
  state.selectedStyle = s.selectedStyle || null;
  state.specTiers = JSON.parse(JSON.stringify(s.specTiers || {}));
  state.qtyAdjust = JSON.parse(JSON.stringify(s.qtyAdjust || {}));
  state.priceOverrides = JSON.parse(JSON.stringify(s.priceOverrides || {}));
  renderAll();
}
function persistCurrent() {
  try { localStorage.setItem('courtyard-current', JSON.stringify(snapshot())); } catch {}
}
function loadCurrent() {
  try {
    const s = JSON.parse(localStorage.getItem('courtyard-current'));
    if (s && validSnapshot(s)) applySnapshot(s);
  } catch {}
}
function renderCompare() {
  const cur = snapshot();
  const cards = [['当前', cur], ...['A', 'B', 'C'].map(k => {
    try { return [k, JSON.parse(localStorage.getItem('courtyard-slot-' + k))]; } catch { return [k, null]; }
  })];
  $('#compareGrid').innerHTML = cards.map(([k, s]) => s && validSnapshot(s)
    ? `<article class="compare-card"><small>方案 ${k}</small><h3>${s.city} · ${s.climate}</h3><strong>${money(s.total)}</strong>
       <p>${s.area}㎡ · 绿化 ${s.green}% · 铺装 ${s.paving}%</p>
       <p>植物 ${Object.values(s.chosen).flat().length} 种 · 小品 ${(s.chosenFeatures || []).length} 项</p>
       ${k !== '当前' ? `<button class="button apply-slot" data-slot="${k}">应用此方案</button>` : ''}</article>`
    : `<article class="compare-card empty-slot"><small>方案 ${k}</small><p>尚未保存</p></article>`).join('');
}

/* ---------------- 事件 ---------------- */
function bindEvents() {
  $$('.open-picker').forEach(b => b.onclick = () => openPicker(b.dataset.default));
  $$('[data-close]').forEach(b => b.onclick = () => {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
  });
  $('#drawer').addEventListener('click', e => {
    if (e.target.dataset.filter) {
      const key = e.target.dataset.filter;
      let v = e.target.dataset.value;
      if (key === 'month') v = v === '全部' ? null : Number(v);
      state.filters[key] = v;
      PICKER_PAGE = 1;
      renderPicker();
    }
    if (e.target.dataset.page) {
      PICKER_PAGE += e.target.dataset.page === 'next' ? 1 : -1;
      renderPicker();
      $('#drawer').scrollTop = 0;
    }
    if (e.target.dataset.add) {
      const id = e.target.dataset.add;
      const target = e.target.dataset.target;
      if (!state.chosen[target].includes(id)) {
        state.chosen[target].push(id);
        renderAll();
        renderPicker();
        toast('已加入选配方案');
      }
    }
  });
  $('#search').oninput = renderPicker;
  $('#plants').addEventListener('click', e => {
    if (e.target.dataset.remove) {
      const key = e.target.dataset.target;
      state.chosen[key] = state.chosen[key].filter(x => x !== e.target.dataset.remove);
      renderAll();
    }
  });
  $('#featureGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-feature]');
    if (!card) return;
    const id = card.dataset.feature;
    state.chosenFeatures = state.chosenFeatures.includes(id)
      ? state.chosenFeatures.filter(x => x !== id)
      : [...state.chosenFeatures, id];
    renderFeatures();
    renderBOQ();
  });
  $('#materialGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-mat]');
    if (b) { state.selectedMaterial = b.dataset.mat; renderMaterials(); renderBOQ(); }
  });
  ['#area', '#green', '#paving'].forEach(id => $(id).addEventListener('input', () => { renderSpace(); renderChosen(); renderMaterials(); renderBOQ(); }));
  ['#grade', '#climate'].forEach(id => $(id).addEventListener('change', () => { renderChosen(); renderMaterials(); renderBOQ(); }));
  $$('.slot-save').forEach(b => b.onclick = () => {
    localStorage.setItem('courtyard-slot-' + b.dataset.slot, JSON.stringify(snapshot()));
    toast('方案 ' + b.dataset.slot + ' 已保存');
  });
  $('#compare').onclick = () => { renderCompare(); $('#compareModal').classList.add('open'); };
  $$('.compare-close').forEach(b => b.onclick = () => $('#compareModal').classList.remove('open'));
  $('#compareModal').addEventListener('click', e => {
    const b = e.target.closest('.apply-slot');
    if (b) {
      applySnapshot(JSON.parse(localStorage.getItem('courtyard-slot-' + b.dataset.slot)));
      $('#compareModal').classList.remove('open');
      toast('已应用方案 ' + b.dataset.slot);
    }
  });
  $('#theme').onclick = () => {
    const dark = document.body.classList.toggle('dark');
    $('#theme').textContent = dark ? '浅色' : '深色';
  };
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    state.view = t.dataset.view;
    const isCost = state.view === 'cost';
    $('.table').hidden = !isCost;
    $('#ownerView').hidden = isCost;
  });
  $('#export').onclick = () => {
    const rows = buildBOQ(currentState(), PLANTS, ENGINEERING, MATERIALS, FEATURES);
    const csv = toCSV(rows);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = '庭院设计百宝箱-施工算量.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已导出 ' + rows.length + ' 条清单');
  };

  // —— poke 风格深化交互 ——
  $('#styleGrid').addEventListener('click', e => {
    const card = e.target.closest('[data-style]');
    if (card) applyStyle(card.dataset.style);
  });
  // 已选植物：规格档次 + 数量加减
  $('#plants').addEventListener('click', e => {
    const tierBtn = e.target.closest('[data-tier]');
    if (tierBtn) {
      state.specTiers[tierBtn.dataset.plant] = tierBtn.dataset.tier;
      renderChosen(); renderBOQ(); renderOverrides();
      return;
    }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const id = qtyBtn.dataset.plant;
      const st = currentState();
      const p = PLANTS_BY_ID[id], en = ENGINEERING.entries[id];
      const cur = state.qtyAdjust[id] !== undefined ? Number(state.qtyAdjust[id])
        : quantity(p, en, st, (state.chosen.chosenGround.length) || 1);
      const next = Math.max(0, cur + (qtyBtn.dataset.qty === 'inc' ? 1 : -1));
      state.qtyAdjust[id] = next;
      renderChosen(); renderBOQ(); renderOverrides();
    }
  });
  // 单价覆写输入
  const ovBody = $('#overrideBody');
  if (ovBody) {
    ovBody.addEventListener('change', e => {
      const inp = e.target.closest('[data-ov]'); if (!inp) return;
      const key = inp.dataset.ov;
      if (inp.value === '') delete state.priceOverrides[key];
      else state.priceOverrides[key] = Number(inp.value);
      renderBOQ(); renderOverrides();
    });
  }
  const resetBtn = $('#resetOverrides');
  if (resetBtn) resetBtn.onclick = () => { state.priceOverrides = {}; renderBOQ(); renderOverrides(); toast('已重置全部覆写单价'); };
  // 底部预算条视图切换 / Hero 按钮定位 / 步骤导航滚动高亮
  $$('.bb-view').forEach(b => b.onclick = () => {
    const view = b.dataset.bbview;
    const tab = [...document.querySelectorAll('.tab')].find(t => t.dataset.view === view);
    if (tab) tab.click();
    $$('.bb-view').forEach(x => x.classList.toggle('active', x === b));
    $('#boq').scrollIntoView({ behavior: 'smooth' });
  });
  $$('[data-goto]').forEach(b => b.onclick = () => $(b.dataset.goto).scrollIntoView({ behavior: 'smooth' }));
  const stepLinks = [...document.querySelectorAll('.steps a')];
  if (stepLinks.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          stepLinks.forEach(a => a.classList.toggle('active', a.dataset.step === en.target.id));
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    ['project','style','space','plants','features','materials','boq'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
}

/* ---------------- 启动 ---------------- */
(async function init() {
  try {
    await loadData();
    // 默认选配：从真实库各取一个代表
    state.chosen.chosenTrees = ['ginkgo-biloba'];
    state.chosen.chosenShrubs = ['syringa-oblata'];
    state.chosen.chosenGround = ['hosta-plantaginea'];
    bindEvents();
    loadCurrent();
    renderAll();
  } catch (err) {
    console.error(err);
    $('#dataStatus').textContent = '数据加载失败：' + err.message + '（请通过本地 HTTP 服务器或 GitHub Pages 打开，勿直接双击 HTML）';
    $('#dataStrip').classList.add('error');
  }
})();
