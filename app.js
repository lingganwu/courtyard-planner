/**
 * 庭院设计百宝箱 · 前端主控
 * 数据：plants.json(已核验植物学) + engineering.json/materials.json/features.json(演示工程参数)
 * 计算：src/core.js 纯函数（与测试共用）
 */
import {
  balanceSpace, filterPlants, buildBOQ, boqTotal, toCSV,
  materialBreakdown, validSnapshot, plantUnitPrice, quantity, round
} from './src/core.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const money = n => '¥' + Math.round(n || 0).toLocaleString('zh-CN');

// 运行时数据（从 JSON 加载，不再内嵌假数据）
let PLANTS = [], ENGINEERING = null, MATERIALS = [], FEATURES = [], PLANTS_BY_ID = {};

// 分类/属性/季相选项从真实数据统计得出
let CATEGORIES = ['全部'], FEATURES_OPT = ['全部'], SEASONS = ['全部', '春', '夏', '秋', '冬'];
const MONTHS = ['全部', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const state = {
  chosen: { chosenTrees: [], chosenShrubs: [], chosenGround: [] },
  chosenFeatures: [],
  selectedMaterial: 'granite',
  filters: { category: '全部', feature: '全部', season: '全部', month: null },
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
  const [plantsRes, engRes, matRes, featRes] = await Promise.all([
    fetch('./src/data/plants.json'),
    fetch('./src/data/engineering.json'),
    fetch('./src/data/materials.json'),
    fetch('./src/data/features.json')
  ]);
  if (!plantsRes.ok || !engRes.ok || !matRes.ok || !featRes.ok) {
    throw new Error('数据文件加载失败');
  }
  const [plantsDoc, eng, matDoc, featDoc] = await Promise.all([
    plantsRes.json(), engRes.json(), matRes.json(), featRes.json()
  ]);
  PLANTS = plantsDoc.plants;
  ENGINEERING = eng;
  MATERIALS = matDoc.materials;
  FEATURES = featDoc.features;
  PLANTS_BY_ID = Object.fromEntries(PLANTS.map(p => [p.id, p]));

  // 从真数据统计筛选项
  const cats = new Set(), feats = new Set();
  for (const p of PLANTS) {
    (p.categories || []).forEach(c => cats.add(c));
    (p.ornamentalFeatures || []).forEach(f => feats.add(f));
  }
  CATEGORIES = ['全部', ...[...cats].sort()];
  FEATURES_OPT = ['全部', ...[...feats].sort()];

  const verified = PLANTS.filter(p => p.reviewStatus === 'botanical-verified').length;
  $('#dataStatus').textContent = `已加载 ${PLANTS.length} 条植物学核验记录（${verified} 条 botanical-verified）· 价格与图片为演示基线`;
  $('#plantLibStat').textContent = `已核验 ${verified} 条`;
  $('#pickerSource').textContent = `已核验库 ${PLANTS.length} 条 · 非完整图库`;
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
    selectedMaterial: state.selectedMaterial
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
      const qty = quantity(p, e, st, (state.chosen.chosenGround.length) || 1);
      return `<article class="plant-card">
        <header><div><h4>${p.name}</h4><small>${p.latinName}</small></div><b>${money(plantUnitPrice(e, st.grade))}/${e.unit}</b></header>
        <p>${(p.categories || []).join(' · ')}<br>${(p.ornamentalFeatures || []).join(' / ')} · ${e.spec}</p>
        <footer><small>${e.unit === '㎡' ? qty + '㎡' : qty + '株'} · 演示价</small><button data-remove="${id}" data-target="${key}">移除</button></footer>
      </article>`;
    }).join('') : '<div class="empty">尚未选择。点击上方按钮从已核验植物库添加。</div>';
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
      <b>${m.name}</b><small>${m.spec}</small><strong>${money(materialBreakdown(m, st.grade).total)}/㎡</strong>
    </button>`).join('');
  const m = MATERIALS.find(x => x.id === state.selectedMaterial) || MATERIALS[0];
  $('#buildTitle').textContent = m.name + ' · ' + m.spec;
  $('#buildLayers').innerHTML = (m.constructionLayers || []).map(l => `<li><b>${l.name}</b><span>${l.desc}</span></li>`).join('');
  const b = materialBreakdown(m, st.grade);
  $('#costTitle').textContent = money(b.total) + ' /㎡';
  const label = { main: '主材', sub: '基层/辅材', labor: '人工', machine: '机械', logistics: '物流', waste: '损耗', measure: '措施' };
  $('#costRows').innerHTML = Object.entries(label).map(([k, v]) =>
    `<li><span>${v}</span><b>${money(b.rows[k])}</b></li>`).join('');
  $('#wasteNote').textContent = `损耗率 ${(m.wasteRate * 100).toFixed(0)}% · 单价为演示基线，非正式询价`;
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

function renderAll() {
  renderSpace();
  renderChosen();
  renderFeatures();
  renderMaterials();
  renderBOQ();
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
  $('#pickerClimate').textContent = $('#climate').value + ' · 气候匹配仅供参考';
  const list = filterPlants(PLANTS, ENGINEERING, {
    climate: $('#climate').value,
    category: state.filters.category,
    feature: state.filters.feature,
    season: state.filters.season,
    month: state.filters.month,
    keyword: $('#search').value
  });
  $('#matchCount').textContent = list.length + ' / ' + PLANTS.length + ' 条匹配';
  $('#pickerGrid').innerHTML = list.map(p => {
    const e = ENGINEERING.entries[p.id];
    const target = e.target;
    const added = state.chosen[target].includes(p.id);
    return `<article class="pick">
      <h4>${p.name} ${added ? '<small class="tag">已加入</small>' : ''}</h4>
      <em>${p.latinName}</em>
      <p>${(p.categories || []).join(' / ')}<br>${(p.ornamentalFeatures || []).join(' / ')}<br>${e.spec}</p>
      <footer><b>${money(plantUnitPrice(e, +$('#grade').value || 1))}/${e.unit}</b><button data-add="${p.id}" data-target="${target}" ${added ? 'disabled' : ''}>${added ? '已加入' : '加入'}</button></footer>
      <div class="pick-source">来源：${p.sourceType} · ${p.reviewStatus}</div>
    </article>`;
  }).join('') || '<div class="empty">当前筛选无匹配项。已核验库不补假条目。</div>';
}

function openPicker(def) {
  state.filters.category = def === '灌木' ? '灌木与球类' : def === '地被' ? '地被草本' : '全部';
  state.filters.feature = '全部';
  state.filters.season = '全部';
  state.filters.month = null;
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
      renderPicker();
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
  $('#theme').onclick = () => document.body.classList.toggle('dark');
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
