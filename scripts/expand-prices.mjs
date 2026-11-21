#!/usr/bin/env node
/**
 * 扩充价格基准库（第二批公开查证源）。
 * 源：中国园林网、园林苗木网、切它网、百度爱采购、花木网、
 *     北京市京西林场政府采购、上海松江城投苗木补种、兰州大学花卉采购结算价。
 * 每条保留规格、口径、地区、来源 URL、日期；区间价用中点入账并在 note 保留原区间。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PRICE_FILE = path.join(ROOT, 'src/data/price-benchmarks.json');
const doc = JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8'));

const climateOf = p => ({
  '北京': '华北温带', '河北': '华北温带', '河南': '华北温带', '天津': '华北温带', '山西': '华北温带',
  '江苏': '华东暖温带', '浙江': '华东暖温带', '上海': '华东暖温带', '山东': '华东暖温带', '安徽': '华东暖温带',
  '湖北': '华中过渡', '湖南': '华中过渡', '江西': '华中过渡',
  '广东': '华南亚热带', '广西': '华南亚热带', '海南': '华南亚热带', '福建': '华南亚热带',
  '四川': '西南高原亚热带', '云南': '西南高原亚热带', '贵州': '西南高原亚热带', '重庆': '西南高原亚热带',
}[p] || '全国参考');

const normName = n => String(n).replace(/[（(].*?[)）]/g, '').replace(/\s/g, '').trim();

function parseSpec(s) {
  const t = String(s);
  const m = t.match(/(胸径|地径|米径|杆径|径|冠径|冠幅|高度|高)[^\d]{0,4}(\d+(?:\.\d+)?)/);
  if (m) {
    const map = { '胸径': 'dbh', '地径': 'ground', '米径': 'dbh', '杆径': 'ground', '径': 'dbh', '冠径': 'crown', '冠幅': 'crown', '高度': 'height', '高': 'height' };
    return { type: map[m[1]] || 'other', value: Number(m[2]) };
  }
  const h = t.match(/(\d+(?:\.\d+)?)\s*(?:cm|厘米|公分)/);
  return h ? { type: 'height', value: Number(h[1]) } : { type: 'other', value: null };
}

let seq = 234;
const records = [];
function add(name, pairs, meta) {
  for (const [spec, price, note] of pairs) {
    if (!Number.isFinite(price) || price <= 0) continue;
    records.push({
      id: `PR-${String(++seq).padStart(3, '0')}`,
      name: normName(name),
      rawName: name,
      spec,
      specParsed: parseSpec(spec),
      unit: meta.unit || '株',
      price,
      priceType: meta.priceType,
      province: meta.province,
      climate: climateOf(meta.province),
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      date: meta.date,
      note: note || meta.note || '',
    });
  }
}

/* ---------- 1. 园林苗木网（江苏南京，规格价目表，2026-09-22） ---------- */
const YL = 'https://www.ylmm.com/u-wan138/sell_detail_858535.html';
const YL2 = 'https://www.ylmm.com/b2b/sell_detail_532605.html';
const YL3 = 'https://www.ylmm.com/b2b/sell_detail_661549.html';
const YL4 = 'http://www.zjylw.com/u-wan138/sell_detail_625602.html';
const ylMeta = { priceType: '行情价', province: '江苏', source: '园林苗木网·苗圃上车价（南京市浦口区默客园艺场报价）', sourceUrl: YL, date: '2026-09' };
add('香樟', [['截干胸径5cm', 24], ['截干胸径6cm', 40], ['截干胸径8cm', 80], ['截干胸径10cm', 140], ['截干胸径12cm', 200], ['截干胸径15cm', 300], ['截干胸径18cm', 500], ['截干胸径20cm', 650], ['骨架胸径10cm', 240], ['骨架胸径12cm', 350], ['骨架胸径15cm', 650], ['骨架胸径18cm', 1200], ['骨架胸径20cm', 1500], ['骨架胸径25cm', 2300], ['骨架胸径30cm', 2800]], ylMeta);
add('桂花', [['地径2cm', 18], ['地径3cm', 30], ['地径4cm', 45], ['地径5cm', 80], ['地径6cm', 150], ['地径8cm', 320], ['地径10cm', 700], ['地径12cm', 1200], ['地径15cm', 5000]], ylMeta);
add('紫玉兰', [['地径3cm', 15], ['地径4cm', 30], ['地径5cm', 50], ['地径6cm', 100], ['地径7cm', 150], ['地径8cm', 300]], ylMeta);
add('龙柏', [['高1.5m', 12], ['高2m', 25], ['高2.5m', 40], ['高3m', 80], ['高3.5m', 120], ['高4m', 200], ['高4.5m', 230], ['高5m', 300]], ylMeta);
add('杜仲', [['胸径6cm', 45], ['胸径8cm', 100], ['胸径10cm', 230], ['胸径12cm', 350], ['胸径13cm', 450], ['胸径15cm', 600], ['胸径18cm', 800], ['胸径20cm', 1000], ['胸径25cm', 1600]], ylMeta);
add('红叶李', [['地径2cm', 10], ['地径3cm', 18], ['地径4cm', 28], ['地径5cm', 40], ['地径6cm', 60], ['地径7cm', 90], ['地径8cm', 150], ['地径10cm', 350], ['地径12cm', 600]], ylMeta);
add('水杉', [['胸径3cm', 8], ['胸径4cm', 15], ['胸径5cm', 25], ['胸径6cm', 40], ['胸径7cm', 65], ['胸径8cm', 80], ['胸径10cm', 130], ['胸径15cm', 400]], ylMeta);
add('红枫', [['地径2cm', 28], ['地径3cm', 45], ['地径4cm', 80], ['地径5cm', 180], ['地径6cm', 300], ['地径7cm', 450], ['地径8cm', 700]], ylMeta);
add('杜英', [['胸径4cm', 15], ['胸径6cm', 30], ['胸径8cm', 80], ['胸径10cm', 150], ['胸径12cm', 240], ['胸径15cm', 500], ['胸径18cm', 700], ['胸径20cm', 900]], ylMeta);
add('臭椿', [['胸径8cm', 150], ['胸径10cm', 200], ['胸径12cm', 320], ['胸径15cm', 550], ['胸径18cm', 750], ['胸径20cm', 950], ['胸径25cm', 1600], ['胸径30cm', 2500]], ylMeta);
add('意杨', [['胸径5cm', 20], ['胸径6cm', 30], ['胸径7cm', 40], ['胸径8cm', 55], ['胸径10cm', 80], ['胸径15cm', 300]], ylMeta);
add('栾树', [['胸径4cm', 26], ['胸径5cm', 35], ['胸径7cm', 90], ['胸径8cm', 140], ['胸径9cm', 190], ['胸径10cm', 260], ['胸径11cm', 350], ['胸径12cm', 460], ['胸径13cm', 600], ['胸径15cm', 1200]], { ...ylMeta, sourceUrl: YL3 });
add('无患子', [['胸径4cm', 20], ['胸径6cm', 50], ['胸径8cm', 120], ['胸径10cm', 450], ['胸径12cm', 1000]], { ...ylMeta, sourceUrl: YL3 });
add('重阳木', [['胸径5cm', 35], ['胸径7cm', 60], ['胸径9cm', 180], ['胸径11cm', 280], ['胸径13cm', 550], ['胸径15cm', 800]], { ...ylMeta, sourceUrl: YL3 });
add('黄连木', [['胸径8cm', 160], ['胸径10cm', 260], ['胸径12cm', 400], ['胸径15cm', 800], ['胸径18cm', 1200], ['胸径20cm', 1400], ['胸径25cm', 2300], ['胸径30cm', 3200], ['胸径40cm', 5000], ['胸径45cm', 6000]], { ...ylMeta, sourceUrl: YL3 });
add('国槐', [['胸径3cm', 12], ['胸径5cm', 25], ['胸径6cm', 40], ['胸径8cm', 110], ['胸径10cm', 280]], { ...ylMeta, sourceUrl: YL3 });
add('榉树', [['胸径5cm', 70], ['胸径8cm', 300], ['胸径10cm', 600], ['胸径15cm', 1200], ['胸径20cm', 2000], ['胸径25cm', 3000], ['胸径30cm', 4500], ['胸径35cm', 5500], ['胸径40cm', 8000]], { ...ylMeta, sourceUrl: YL4 });
add('榆树', [['胸径8cm', 160], ['胸径10cm', 280], ['胸径12cm', 450], ['胸径15cm', 800], ['胸径18cm', 1200], ['胸径20cm', 1600], ['胸径25cm', 2500], ['胸径30cm', 3500], ['胸径40cm', 5000]], { ...ylMeta, sourceUrl: YL4 });
add('皂荚', [['胸径10cm', 350], ['胸径12cm', 600], ['胸径15cm', 1400], ['胸径18cm', 2000], ['胸径20cm', 2400], ['胸径25cm', 3000], ['胸径30cm', 4500], ['胸径40cm', 6500]], { ...ylMeta, sourceUrl: YL4 });
add('樱花', [['地径2cm', 8], ['地径3cm', 20], ['地径4cm', 40], ['地径5cm', 80], ['地径6cm', 120], ['地径7cm', 250], ['地径8cm', 400], ['地径10cm', 700]], { ...ylMeta, sourceUrl: YL4 });
add('枇杷', [['杆径5cm', 35], ['杆径6cm', 70], ['杆径7cm', 140], ['杆径8cm', 280], ['杆径9cm', 450], ['杆径10cm', 700]], { ...ylMeta, sourceUrl: YL4 });
add('木槿', [['地径1cm', 3], ['地径2cm', 10], ['地径3cm', 26], ['地径4cm', 45], ['地径5cm', 85]], { ...ylMeta, sourceUrl: YL4 });
add('枫香', [['胸径5cm', 35], ['胸径6cm', 50], ['胸径7cm', 90], ['胸径8cm', 180], ['胸径10cm', 450], ['胸径15cm', 1000], ['胸径20cm', 2200]], { ...ylMeta, sourceUrl: YL4 });
add('七叶树', [['胸径3cm', 30], ['胸径5cm', 90], ['胸径7cm', 260], ['胸径9cm', 500], ['胸径10cm', 750]], { ...ylMeta, sourceUrl: YL4 });
add('枫杨', [['胸径8cm', 60], ['胸径10cm', 120], ['胸径12cm', 240], ['胸径15cm', 450], ['胸径18cm', 600], ['胸径25cm', 800]], { ...ylMeta, sourceUrl: YL4 });
add('红叶石楠', [['冠径50cm', 8], ['冠径80cm', 22], ['冠径100cm', 40], ['冠径120cm', 55], ['冠径130cm', 70], ['冠径150cm', 100], ['冠径180cm', 200], ['冠径200cm', 260], ['冠径250cm', 600], ['冠径300cm', 850], ['独杆地径2cm', 20], ['独杆地径3cm', 50], ['独杆地径4cm', 130], ['独杆地径5cm', 200], ['独杆地径6cm', 300], ['独杆地径7cm', 500], ['独杆地径8cm', 700], ['独杆地径10cm', 1000]], { ...ylMeta, sourceUrl: YL2, source: '园林苗木网·红叶石楠上车价（南京）' });
add('大叶女贞', [['胸径2cm', 8], ['胸径3cm', 16], ['胸径4cm', 26], ['胸径5cm', 38], ['胸径6cm', 60], ['胸径7cm', 100], ['胸径8cm', 140], ['胸径9cm', 280], ['胸径10cm', 550], ['胸径12cm', 750]], { ...ylMeta, sourceUrl: YL2 });
add('白玉兰', [['地径3cm', 25], ['地径4cm', 30], ['地径5cm', 40], ['地径6cm', 50], ['地径7cm', 90], ['地径8cm', 130], ['地径9cm', 350]], { ...ylMeta, sourceUrl: YL2 });
add('垂柳', [['胸径2cm', 4], ['胸径4cm', 20], ['胸径6cm', 60], ['胸径8cm', 120], ['胸径10cm', 230], ['胸径12cm', 350], ['胸径15cm', 450]], { ...ylMeta, sourceUrl: YL2 });
add('鹅掌楸', [['地径5cm', 18], ['地径6cm', 40], ['地径7cm', 55], ['地径8cm', 70], ['地径10cm', 130], ['地径12cm', 320], ['地径15cm', 650]], { ...ylMeta, sourceUrl: YL2, note: '原表名称“马褂木”即鹅掌楸' });
add('紫薇', [['地径1cm', 6], ['地径2cm', 18], ['地径3cm', 25], ['地径4cm', 45], ['地径5cm', 80], ['地径6cm', 130], ['地径7cm', 280], ['地径8cm', 500], ['地径9cm', 1200]], { ...ylMeta, sourceUrl: YL2 });
add('紫叶李', [['地径2cm', 5], ['地径3cm', 10], ['地径4cm', 15], ['地径5cm', 25], ['地径6cm', 60], ['地径8cm', 180], ['地径10cm', 350]], { ...ylMeta, sourceUrl: YL2 });
add('蜀桧', [['高50cm', 3], ['高100cm', 9], ['高150cm', 30], ['高200cm', 65], ['高250cm', 80], ['高300cm', 90], ['高350cm', 100], ['高400cm', 130], ['高500cm', 260], ['高600cm', 350]], { ...ylMeta, sourceUrl: YL2 });
add('朴树', [['胸径8cm', 160], ['胸径10cm', 280], ['胸径12cm', 450], ['胸径15cm', 800], ['胸径18cm', 1200]], { ...ylMeta, sourceUrl: YL2 });
add('红玉兰', [['地径4cm', 40], ['地径5cm', 60], ['地径6cm', 90], ['地径7cm', 160], ['地径8cm', 320], ['地径9cm', 550], ['地径10cm', 850]], { ...ylMeta, sourceUrl: YL2 });

/* ---------- 2. 百度爱采购 2026 批发价（带供应商、地区、更新时间） ---------- */
const bShrub = 'https://b2b.baidu.com/land/495b6ac4901b6cc3f5be196c3347d4bd?fid=403116032';
const bFlower = 'https://b2b.baidu.com/land/f347df1b137406ea6f71274e8b66750d?fid=403116032';
const bTree = 'https://b2b.baidu.com/land/9e8d78a531a67e01a5046df3cf6e2c22?fid=403116032';
const bVine = 'https://b2b.baidu.com/land/f0d6a860a46c4ed483525911f78f8827?fid=403116032';
const bGrass = 'https://b2b.baidu.com/land/ed4069c3acd238dbe42d0ae2a75ca22a?fid=403116032';
const bFruit = 'https://b2b.baidu.com/land/fb31f7b61a282beedea99e38bbda5ca9?fid=403116032';
const bPrice = (name, spec, price, province, sourceUrl, date, unit = '株', note = '') =>
  add(name, [[spec, price]], { priceType: '批发价', province, source: `百度爱采购公开报价（${province}供应商，起批量价）`, sourceUrl, date, unit, note });
bPrice('红叶石楠球', '高杆工程苗', 1.3, '江苏', bShrub, '2026-09');
bPrice('小叶黄杨', '地栽苗', 0.65, '山东', bShrub, '2026-08');
bPrice('金叶女贞', '球类造型苗', 0.57, '山东', bShrub, '2026-08');
bPrice('栀子', '四季常绿地栽苗', 0.5, '江苏', bShrub, '2026-08');
bPrice('杜鹃', '高山杜鹃 冠幅60-70cm', 610, '浙江', bShrub, '2026-10', '株', '高山杜鹃品种苗，非常规绿化毛鹃');
bPrice('红叶石楠', '独杆米径4-5cm', 170, '浙江', bShrub, '2026-11');
bPrice('小叶黄杨', '球类', 65, '江苏', bShrub, '2026-08');
bPrice('亮晶女贞', '绿化带苗', 6, '江苏', bShrub, '2026-08');
bPrice('栀子', '小叶栀子花', 0.35, '江苏', bShrub, '2026-09');
bPrice('玉簪', '甜心玉簪杯苗', 0.7, '江苏', bFlower, '2026-08');
bPrice('月季', '造型球/柱 150cm', 260, '山东', bFlower, '2026-08');
bPrice('绣球', '木绣球工程苗', 50, '江苏', bFlower, '2026-08');
bPrice('百子莲', '绿化工程苗', 0.5, '江苏', bFlower, '2026-08');
bPrice('松果菊', '小杯/双色杯', 2.8, '江苏', bFlower, '2026-10', '盆');
bPrice('宿根福禄考', '丛生福禄考', 0.8, '江苏', bFlower, '2026-08');
bPrice('绣球', '圆锥绣球', 6, '浙江', bFlower, '2026-08');
bPrice('月季', '花球', 180, '江苏', bFlower, '2026-08');
bPrice('百子莲', '高度20-80cm', 0.2, '江苏', bFlower, '2026-08');
bPrice('樱花', '东京樱花苗', 50, '江苏', bTree, '2026-09');
bPrice('红枫', '日本红枫工程苗', 360, '江苏', bTree, '2026-08');
bPrice('紫叶李', '工程苗', 29, '江苏', bTree, '2026-08');
bPrice('栾树', '台湾栾树', 170, '江苏', bTree, '2026-08');
bPrice('无患子', '胸径8cm', 80, '四川', bTree, '2026-09');
bPrice('朴树', '工程苗', 32, '江苏', bTree, '2026-08');
bPrice('榉树', '1-20cm规格', 200, '江苏', bTree, '2026-08');
bPrice('樱花', '胸径16cm', 120, '山东', bTree, '2026-09');
bPrice('红枫', '日本红枫小苗', 6, '江苏', bTree, '2026-08');
bPrice('紫叶李', '美国紫叶李品种苗', 1300, '江苏', bTree, '2026-08', '株', '彩色品种苗，非常规紫叶李');
bPrice('刚竹', '高2-4m', 8, '浙江', bVine, '2026-08', '株');
bPrice('紫竹', '观赏竹苗', 8, '江苏', bVine, '2026-08', '株');
bPrice('紫藤', '小苗', 15, '江苏', bVine, '2026-10', '株');
bPrice('睡莲', '浮叶水生苗', 2, '浙江', bVine, '2026-08', '株');
bPrice('再力花', '水生造景苗', 0.32, '浙江', bVine, '2026-08', '株');
bPrice('梭鱼草', '湿地浅水苗', 0.35, '浙江', bVine, '2026-08', '株');
bPrice('紫竹', '观赏竹苗', 1.5, '山东', bVine, '2026-08', '株');
bPrice('爬山虎', '爬藤工程苗', 0.8, '江苏', bVine, '2026-08', '株');
bPrice('狗牙根', '混播草籽', 10, '江苏', bGrass, '2026-08', '斤', '种子价，非草坪成品价');
bPrice('结缕草', '中华结缕草', 50, '安徽', bGrass, '2026-11', '平方米', '原平台标注单位，需现场核算播种量');
bPrice('矮生百慕大', '草籽', 8, '江苏', bGrass, '2026-08', '斤', '种子价');
bPrice('黑麦草', '草坪草籽', 8, '浙江', bGrass, '2026-08', '斤', '种子价');
bPrice('石榴', '果树苗', 45, '江苏', bFruit, '2026-10');
bPrice('柿', '甜柿嫁接苗', 8, '江苏', bFruit, '2026-08');
bPrice('枇杷', '果树苗', 35, '江苏', bFruit, '2026-10');
bPrice('杨梅', '多杆绿化苗', 68, '浙江', bFruit, '2026-10');
bPrice('樱桃', '晚熟大樱桃 5cm', 15, '山东', bFruit, '2026-10');
bPrice('柑橘', '长叶香橙苗', 3.6, '江苏', bFruit, '2026-08');
bPrice('石榴', '2年甜石榴苗', 20, '山东', bFruit, '2026-10');
bPrice('枇杷', '绿化观赏苗', 58, '浙江', bFruit, '2026-09');
bPrice('杨梅', '庭院观果苗', 25, '江苏', bFruit, '2026-10');

/* ---------- 3. 切它网 河南潢川苗圃规格报价表 ---------- */
const QT1 = 'http://www.qieta.com/sell/show-3323028.html';
const QT2 = 'http://www.qieta.com/sell/show-3413619.html';
const QT3 = 'http://sell.qieta.com.cn/show-5060263.html';
const qtMeta = { priceType: '批发价', province: '河南', source: '切它网·河南潢川花木苗木销售公司规格报价表', sourceUrl: QT1, date: '2026-09' };
add('小叶女贞', [['高40-60cm三分枝', 0.1], ['冠径60cm', 3], ['冠径80cm', 12], ['冠径100cm', 20]], { ...qtMeta, unit: '株' });
add('龟甲冬青', [['冠径25cm', 0.8], ['冠径30cm', 1.2], ['冠径60cm', 15], ['冠径100cm', 35]], { ...qtMeta, unit: '株' });
add('金叶女贞', [['高40-60cm三分枝', 0.2], ['冠径100cm', 30]], { ...qtMeta, unit: '株' });
add('金森女贞', [['高40-60cm', 0.5], ['冠径50cm', 1], ['冠径60cm', 3]], { ...qtMeta, unit: '株' });
add('紫叶小檗', [['高40-60cm', 0.4], ['冠径50cm', 0.6], ['冠径60cm', 1]], { ...qtMeta, unit: '株', note: '原表名称“红叶小檗”' });
add('洒金珊瑚', [['冠径40cm', 6], ['冠径50cm', 12], ['冠径60cm', 18], ['冠径80cm', 26], ['冠径100cm', 35], ['冠径120cm', 50], ['冠径150cm', 80], ['冠径180cm', 180], ['冠径200cm', 230]], { ...qtMeta, unit: '株' });
add('栀子', [['高40-60cm 冠30-50cm', 1], ['高80-100cm 冠60-80cm', 6], ['冠径100cm', 40]], { ...qtMeta, unit: '株', note: '大叶/小叶栀子同价' });
add('红花继木', [['高40cm 冠25cm', 0.6], ['高50cm 冠30cm', 1], ['高80cm 冠60cm', 8], ['高100cm 冠80cm', 20], ['高120cm 冠100cm', 40], ['冠径150cm', 120]], { ...qtMeta, unit: '株' });
add('石楠', [['冠径60cm', 6], ['冠径80cm', 20], ['冠径100cm', 30], ['冠径120cm', 40]], { ...qtMeta, unit: '株', note: '原表名称“石楠球”' });
add('红叶石楠', [['高30-50cm 冠25cm', 0.3], ['高60-70cm 冠30cm', 1.3], ['高70-100cm 冠40cm', 1.5], ['高100-120cm 冠60cm', 6], ['冠径80cm', 10], ['冠径100cm', 25], ['冠径150cm', 70]], { ...qtMeta, unit: '株' });
add('火棘', [['冠径30cm', 0.5], ['冠径60cm', 3], ['冠径80cm', 10], ['冠径100cm', 20], ['冠径120cm', 30], ['冠径150cm', 60]], { ...qtMeta, unit: '株', note: '原表名称“火棘球”' });
add('构骨', [['冠径30cm', 1.5], ['冠径60cm', 3], ['冠径80cm', 20], ['冠径100cm', 40], ['冠径120cm', 60], ['冠径150cm', 120]], { ...qtMeta, unit: '株', note: '原表名称“构骨球”' });
add('海桐', [['冠径25cm', 0.8], ['冠径30cm', 1], ['冠径60cm', 3], ['冠径80cm', 23], ['冠径100cm', 40], ['冠径120cm', 90]], { ...qtMeta, unit: '株', note: '原表名称“海桐球”' });
add('小龙柏', [['高30cm 冠15-25cm', 0.6], ['冠径30cm', 1], ['冠径60cm', 6], ['冠径80cm', 20], ['冠径100cm', 35]], { ...qtMeta, unit: '株' });
add('铺地柏', [['冠径30cm', 2], ['冠径40cm', 3], ['冠径50cm', 4], ['冠径60cm', 5]], { ...qtMeta, unit: '株' });
add('六月雪', [['冠径30cm', 2], ['冠径40cm', 3], ['冠径50cm', 5]], { ...qtMeta, unit: '株' });
add('狼尾草', [['丛苗', 0.3]], { ...qtMeta, unit: '丛' });
add('美人蕉', [['地栽苗', 1.2]], { ...qtMeta, unit: '株' });
add('吉祥草', [['丛苗', 0.3]], { ...qtMeta, unit: '丛' });
add('红花酢浆草', [['丛苗', 0.2]], { ...qtMeta, unit: '丛' });
add('紫叶酢浆草', [['丛苗', 1.2]], { ...qtMeta, unit: '丛' });
add('肾蕨', [['高30-50cm', 1]], { ...qtMeta, unit: '株' });
add('紫藤', [['地径1cm', 2], ['地径2cm', 5], ['地径3cm', 8], ['地径4cm', 30], ['地径6cm', 50], ['地径8cm', 380]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('常春藤', [['长60cm', 0.6]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('凌霄', [['长60cm', 0.6]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('爬山虎', [['长60-150cm', 0.2]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('麦冬', [['细叶/阔叶 每平方米', 11]], { ...qtMeta, unit: '平方米', sourceUrl: QT3 });
add('德国鸢尾', [['地栽苗', 0.12]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('玉簪', [['地栽苗', 0.3]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('荷花', [['高60-120cm', 2]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('千屈菜', [['高60-120cm', 0.2]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('蒲苇', [['高60-120cm', 0.2]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('灯心草', [['高30-60cm 冠30cm', 0.5]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('刚竹', [['高2-4m', 2]], { ...qtMeta, unit: '枝', sourceUrl: QT3 });
add('淡竹', [['高2-4m', 2]], { ...qtMeta, unit: '枝', sourceUrl: QT3 });
add('早园竹', [['高2-4m', 2]], { ...qtMeta, unit: '枝', sourceUrl: QT3 });
add('紫竹', [['高3-4m', 4]], { ...qtMeta, unit: '枝', sourceUrl: QT3 });
add('孝顺竹', [['高200-350cm', 60]], { ...qtMeta, unit: '丛', sourceUrl: QT3 });
add('佛肚竹', [['高150-300cm', 5]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('毛竹', [['米径3cm', 5], ['米径6cm', 15], ['米径8cm', 30], ['米径10cm', 50]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('箬竹', [['高50cm', 3], ['高100-150cm', 1.5]], { ...qtMeta, unit: '丛', sourceUrl: QT3 });
add('垂丝海棠', [['冠径30cm', 1], ['冠径40cm', 2], ['冠径50cm', 3], ['冠径60cm', 10], ['冠径100cm', 30]], { ...qtMeta, unit: '株', sourceUrl: QT3, note: '原表“贴梗海棠/梨花海棠等”同价，按庭院常用垂丝海棠归集' });
add('牡丹', [['高30-50cm', 5]], { ...qtMeta, unit: '株', sourceUrl: QT2 });
add('结香', [['高60-120cm 冠30-40cm', 3], ['冠径50cm', 5], ['冠径80cm', 26]], { ...qtMeta, unit: '株', sourceUrl: QT2 });
add('杜鹃', [['冠径30cm', 1], ['冠径50cm', 3], ['冠径60cm', 10], ['冠径100cm', 40]], { ...qtMeta, unit: '株', sourceUrl: QT2, note: '夏鹃/毛鹃/春鹃/紫鹃同价' });
add('棣棠', [['高60-80cm 冠30-40cm', 1.6], ['高80-100cm 冠50-60cm', 2]], { ...qtMeta, unit: '株', sourceUrl: QT2 });
add('紫穗槐', [['高60cm', 0.08]], { ...qtMeta, unit: '株', sourceUrl: QT2 });
add('石竹', [['常夏石竹', 0.6]], { ...qtMeta, unit: '丛', sourceUrl: QT2 });
add('芭蕉', [['高3m', 60]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('杏', [['米径10cm', 260], ['米径12cm', 330], ['米径15cm', 460], ['米径20cm', 830]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('梨', [['米径10cm', 260], ['米径12cm', 330], ['米径15cm', 460], ['米径20cm', 830]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('柿', [['米径10cm', 260], ['米径12cm', 330], ['米径15cm', 460], ['米径20cm', 830]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('葡萄', [['地径3cm', 30], ['地径5cm', 60], ['地径8cm', 230]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('枇杷', [['米径10cm', 480], ['米径12cm', 600], ['米径15cm', 1100]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('樱桃', [['米径10cm', 480], ['米径12cm', 600], ['米径15cm', 1100]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('枣', [['米径10cm', 330], ['米径12cm', 580]], { ...qtMeta, unit: '株', sourceUrl: QT3 });
add('狗牙根', [['草坪每平方米', 6]], { ...qtMeta, unit: '平方米', sourceUrl: QT3, note: '含马尼拉/剪股颖/结缕草/黑麦草/白三叶等通用草坪价' });
add('结缕草', [['草坪每平方米', 6]], { ...qtMeta, unit: '平方米', sourceUrl: QT3 });
add('白三叶', [['草坪每平方米', 6]], { ...qtMeta, unit: '平方米', sourceUrl: QT3 });
add('剪股颖', [['草坪每平方米', 6]], { ...qtMeta, unit: '平方米', sourceUrl: QT3 });

/* ---------- 4. 政府采购 / 中标与结算价 ---------- */
const BJ = 'https://yllhj.beijing.gov.cn/zwgk/zfcg/qtgg/202606/P020260608540703838466.pdf';
const bjMeta = { priceType: '中标价', province: '北京', source: '北京市京西林场管理处2026年义务植树基地补助项目（苗木采购）分项报价表', sourceUrl: BJ, date: '2026-05', note: '含场地整理费、二次搬运费及运输费' };
add('栓皮栎', [['高30-50cm', 6.5]], bjMeta);
add('白皮松', [['高1.2-1.5m', 46]], bjMeta);
add('榆叶梅', [['地径3-4cm', 20]], bjMeta);
add('油松', [['高1.2-1.5m', 28]], bjMeta);
add('连翘', [['高1m以上', 5]], bjMeta);
add('迎春', [['高30cm以上', 3]], bjMeta);
add('紫丁香', [['高1m以上', 40]], bjMeta);
add('卫矛', [['高80cm以上', 22]], bjMeta);
add('扶芳藤', [['高60cm以上', 2.5]], bjMeta);
add('月季', [['三分支以上', 4.5]], bjMeta);
add('柿', [['胸径5-7cm', 165]], bjMeta);
add('香椿', [['胸径5-7cm', 155]], bjMeta);
add('杏', [['地径6-8cm', 180]], bjMeta);
add('溲疏', [['高50cm以上', 20]], bjMeta);
add('细叶芒', [['高30cm以上', 5]], bjMeta);
add('玉簪', [['高30cm以上', 1.5]], bjMeta);
add('绣球', [['高30cm以上', 7]], bjMeta);
add('木香', [['高60cm以上', 3.5]], bjMeta);
add('胡枝子', [['高60cm以上', 5.5]], bjMeta);
add('桑', [['胸径4-5cm', 140]], bjMeta);
add('李', [['地径4-5cm', 160]], bjMeta);
add('石榴', [['地径4-5cm', 180]], bjMeta);
add('海棠', [['地径4-5cm 大果海棠', 125]], bjMeta);

const SH = 'https://www.sjctjt.com/ksjs/007003/007003003/20261014/441fdb08-237d-440a-af50-3a8b07dc9df4.html';
const shMeta = { priceType: '行情价', province: '上海', source: '上海松江城投·公共绿地养护行道树苗木补种单价限价（招标控制价）', sourceUrl: SH, date: '2026-10', note: '招标控制价，非最终中标价' };
add('榉树', [['胸径14-16cm', 820]], shMeta);
add('樱花', [['关山樱 地径8-10cm', 605]], shMeta);
add('银杏', [['胸径12-14cm', 650], ['嫁接胸径16-18cm', 1250]], shMeta);
add('香橼', [['胸径16-18cm', 3000]], shMeta);
add('栾树', [['胸径12-14cm', 580]], shMeta);
add('朴树', [['胸径14-16cm', 1266]], shMeta);
add('香樟', [['胸径12-14cm', 590]], shMeta);
add('无患子', [['胸径12-14cm', 560]], shMeta);
add('三角枫', [['胸径12-14cm', 1070]], shMeta);
add('国槐', [['胸径12-14cm', 800]], shMeta);
add('枫香', [['北美枫香 胸径18-20cm', 3200]], shMeta);
add('合欢', [['胸径12-14cm', 850]], shMeta);

const LZ = 'https://hq.lzu.edu.cn/hdupf/fil/202604/202604101775803131572269.pdf';
const lzMeta = { priceType: '中标价', province: '甘肃', source: '兰州大学后勤保障部2026年花卉采购项目结算价格', sourceUrl: LZ, date: '2026-04', note: '采购结算价，规格为容器规格' };
add('粉黛乱子草', [['120杯', 4]], lzMeta);
add('四季海棠', [['120杯', 5]], lzMeta);
add('千屈菜', [['1加仑', 15]], lzMeta);
add('鼠尾草', [['玫红奇迹 1加仑', 20]], lzMeta);
add('紫叶狼尾草', [['2加仑', 27]], lzMeta);
add('美人蕉', [['1加仑', 32]], lzMeta);
add('大丽花', [['1加仑', 25]], lzMeta);
add('山桃草', [['1加仑', 14]], lzMeta);
add('大花飞燕草', [['150杯', 5]], lzMeta);
add('毛地黄', [['150杯', 5]], lzMeta);
add('大滨菊', [['1加仑', 31]], lzMeta);
add('矾根', [['150杯', 5]], lzMeta);
add('万寿菊', [['南非万寿菊 150杯', 5]], lzMeta);
add('天竺葵', [['150杯', 10]], lzMeta);
add('玛格丽特', [['150杯', 8]], lzMeta);
add('银叶菊', [['150杯', 5]], lzMeta);
add('佛甲草', [['150杯', 5]], lzMeta);
add('角堇', [['150杯', 4]], lzMeta);
add('松果菊', [['150杯', 5]], lzMeta);
add('荷兰菊', [['150杯', 5]], lzMeta);
add('绣球', [['欧洲绣球 1加仑', 20]], lzMeta);
add('绣线菊', [['1加仑', 6]], lzMeta);
add('蔷薇', [['株高50cm', 20]], lzMeta);
add('五叶地锦', [['地栽苗', 7]], lzMeta);
add('扶芳藤', [['株高50cm', 2]], lzMeta);
add('月季', [['爬藤月季 高1m', 42]], lzMeta);
add('玉簪', [['15cm', 5]], lzMeta);
add('菊花', [['地被菊 120杯', 4]], lzMeta);

/* ---------- 5. 宿根与区域行情 ---------- */
add('玉簪', [['高20cm', 0.4], ['高30cm', 0.55], ['高40cm', 0.6], ['高50cm', 1.2]], { priceType: '批发价', province: '江苏', source: '西北苗木网·沭阳靓景园林玉簪价格表', sourceUrl: 'https://www.xbmiaomu.com/vip/18936843003/sell/itemid-411913.html', date: '2026-11', unit: '株' });
add('金边玉簪', [['高25cm', 0.65], ['高35cm', 0.8], ['高40cm', 1.1]], { priceType: '批发价', province: '江苏', source: '西北苗木网·沭阳靓景园林玉簪价格表', sourceUrl: 'https://www.xbmiaomu.com/vip/18936843003/sell/itemid-411913.html', date: '2026-11', unit: '株' });
const HB = { priceType: '批发价', province: '河北', source: '大庄绿宝园林网·河北宿根苗木批发价格', sourceUrl: 'https://www.lvbad.com/zhiwuku/723769.html', date: '2026', unit: '株' };
add('萱草', [['1年生', 0.5], ['2年生', 1], ['3年生', 1.5]], HB);
add('玉簪', [['1年生', 1], ['2年生', 2], ['3年生', 3]], HB);
add('蜀葵', [['1年生', 0.8], ['2年生', 1.5], ['3年生', 2.5]], HB);
add('大花萱草', [['1年生', 1.2], ['2年生', 2.5], ['3年生', 4]], HB);
add('紫茉莉', [['1年生', 0.6], ['2年生', 1.2], ['3年生', 2]], HB);
add('石竹', [['1年生', 0.7], ['2年生', 1.3], ['3年生', 2.2]], HB);
add('金鸡菊', [['1年生', 0.9], ['2年生', 1.8], ['3年生', 3]], HB);
add('宿根福禄考', [['1年生', 1.5], ['2年生', 3], ['3年生', 5]], HB);

const YC = { priceType: '行情价', province: '湖北', source: '宜昌沛林景观苗木·枇杷行情报价', sourceUrl: 'http://www.ycplmm.com/product/708.html', date: '2026-11', unit: '株' };
add('枇杷', [['高250cm 胸径3cm', 40], ['高250cm 胸径4cm', 55], ['高500cm 冠200cm 地径10cm', 160], ['胸径10cm', 350], ['高600cm 冠500cm 地径19cm', 1400], ['地径5cm', 35], ['地径8cm', 120], ['地径12cm', 400], ['地径16cm', 1900], ['大五星嫁接苗 高30cm', 2.8], ['大五星嫁接苗 高120cm', 5], ['大五星 高200cm 冠150cm 地径7cm', 100], ['大五星 高300cm 冠300cm 地径11cm', 260], ['大五星 高400cm 冠350cm 地径12cm', 300], ['大五星 高400cm 冠300cm 地径16cm', 700], ['大五星 高500cm 冠200cm 地径10cm', 220]], YC);

const HM = { priceType: '批发价', source: '花木网·果树苗木公开报价', sourceUrl: 'https://m.huamu.com/fenlei/15_1_guoshumiaomu.html', unit: '株' };
add('梨', [['翠冠梨 高80cm 地径0.8cm', 2.1]], { ...HM, province: '浙江', date: '2026-10' });
add('柿', [['高500cm 地径15cm', 270]], { ...HM, province: '江苏', date: '2026-09' });
add('桃', [['地径3cm', 5]], { ...HM, province: '江苏', date: '2026-09' });
add('柑橘', [['南丰蜜橘 高300cm 地径15cm', 1700]], { ...HM, province: '湖南', date: '2026-09' });
add('山楂', [['高250cm 地径15cm', 180]], { ...HM, province: '山西', date: '2026-08' });
add('石榴', [['地径25cm', 100]], { ...HM, province: '四川', date: '2026-08' });

const JS = { priceType: '行情价', province: '江苏', source: '中华园林网·江苏苗木报价表', sourceUrl: 'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_5_1.shtml', date: '2026-11', unit: '株' };
add('桃', [['1年籽播苗', 0.3]], JS);
add('紫叶桃', [['1年籽播苗', 2.6]], JS);
add('樱桃', [['50-80cm 1-2年', 2]], JS);
add('石榴', [['1年扦插苗', 2]], JS);
add('银杏', [['1年籽播苗', 1]], JS);
add('枣', [['1年嫁接苗', 6]], JS);
add('红叶李', [['1年籽播苗', 0.8]], JS);
add('葡萄', [['1年嫁接苗', 2.8]], JS);
add('无花果', [['2年分株苗', 9]], JS);
add('猕猴桃', [['2年籽播苗', 8]], JS);
add('枇杷', [['1年籽播苗', 3]], JS);
add('柑橘', [['1年籽播苗', 3]], JS);
add('柿', [['2年籽播苗', 5]], JS);
add('杏', [['1年籽播苗', 2]], JS);
add('山楂', [['1年籽播苗', 4]], JS);

const MP = { priceType: '行情价', province: '全国', source: '桂林诚品苗圃网·绿化树苗品种及价格一览表（区间中值入账）', sourceUrl: 'https://www.miaopu.cn/?p=12831', date: '2026-08', unit: '株' };
add('香樟', [['胸径3-5cm 区间80-150元', 115], ['胸径8-10cm 区间800-1500元', 1150]], MP);
add('银杏', [['胸径5-8cm 区间300-600元', 450], ['胸径10-12cm 区间1200-2500元', 1850]], MP);
add('桂花', [['地径3-5cm 区间50-120元', 85]], MP);
add('国槐', [['胸径4-6cm 区间60-120元', 90]], MP);
add('栾树', [['胸径3-5cm 区间40-90元', 65]], MP);
add('樱花', [['胸径3-4cm 区间50-100元', 75]], MP);
add('红叶石楠', [['高50-80cm 区间3-8元', 5.5]], MP);

/* ---------- 合并 ---------- */
const existing = new Set(doc.records.map(r => `${r.name}|${r.spec}|${r.price}`));
let added = 0;
for (const r of records) {
  const key = `${r.name}|${r.spec}|${r.price}`;
  if (existing.has(key)) continue;
  existing.add(key);
  doc.records.push(r);
  added++;
}
doc.counts.totalRecords = doc.records.length;
doc.counts.speciesCovered = new Set(doc.records.map(r => r.name)).size;
doc.counts.byPriceType = {};
doc.counts.byClimate = {};
doc.byName = {};
for (const r of doc.records) {
  doc.counts.byPriceType[r.priceType] = (doc.counts.byPriceType[r.priceType] || 0) + 1;
  doc.counts.byClimate[r.climate] = (doc.counts.byClimate[r.climate] || 0) + 1;
  (doc.byName[r.name] ||= []).push(r);
}
doc.collectedAt = '2026-11-21';
doc.notice = '公开查证价格基准库。来源包括政府造价信息、政府采购中标/结算价、招标控制价、园林苗木平台规格报价与百度爱采购 2026 年公开批发价。每条带规格、口径、地区、来源 URL 与日期；区间价以中值入账并在 note 保留原区间。仅作方案阶段参考，不构成市场定价。';
doc.priceTypes['批发价'] = '苗圃/基地批量上车价或电商起批量价，通常不含运输栽植';
doc.priceTypes['行情价'] = '园林苗木平台/行业文章公开参考报价，含招标控制价等口径，需结合项目复核';
fs.writeFileSync(PRICE_FILE, JSON.stringify(doc, null, 2));
console.log(`新增 ${added} 条，价格库合计 ${doc.records.length} 条，覆盖 ${doc.counts.speciesCovered} 个品种。`);
console.log('口径:', JSON.stringify(doc.counts.byPriceType, null, 0));
