#!/usr/bin/env node
/**
 * 价格基准库第三批：补齐之前无查证价的 263 株中的可搜品种。
 * 来源（全部为公开可追溯）：
 *  - 汕头市中心城区 2026 二季度材料综合价格表（政府信息价，含税到场）
 *  - 太原地区 2026 春季常用园林苗木价格信息（住建局信息价，元/㎡ 与藤本分档）
 *  - 成都动物园 2026 园庭景观绿化苗木采购合同（政府采购中标单价）
 *  - 园林苗木网 / 中华园林网 / 西北苗木网 / 宜昌沛林（供应商规格报价）
 *  - 百度爱采购 2026 实时起批量价（供应商/地区/更新时间齐全）
 *  - 一亩田产地行情（蕨类批量价）
 * 异常值（单位错位、明显偏离）一律剔除；台币报价标注 currency 不进 BOQ；绝不编造。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FILE = path.join(ROOT, 'src/data/price-benchmarks.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));

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

let seq = Math.max(...doc.records.map(r => Number(String(r.id).replace('PR-', '')) || 0));
const fresh = [];
function add(name, pairs, meta) {
  for (const [spec, price, note] of pairs) {
    if (!Number.isFinite(price) || price <= 0) continue;
    const rec = {
      id: `PR-${String(++seq).padStart(3, '0')}`,
      name: normName(name), rawName: name, spec, specParsed: parseSpec(spec),
      unit: meta.unit || '株', price, priceType: meta.priceType,
      province: meta.province, climate: climateOf(meta.province),
      source: meta.source, sourceUrl: meta.sourceUrl, date: meta.date,
      note: note || meta.note || '',
    };
    if (meta.currency) rec.currency = meta.currency;
    fresh.push(rec);
  }
}
const S = {
  ylmmJzz: { source: '园林苗木网·江西奉新丰盛苗木场鸡爪槭规格价目表', sourceUrl: 'https://www.ylmm.com/b2b/sell_detail_2586235.html', date: '2026-11-12', priceType: '行情价', province: '江西' },
  ycplJzz: { source: '宜昌沛林景观苗木·鸡爪槭2026年11月行情参考', sourceUrl: 'http://www.ycplmm.com/product/847.html', date: '2026-11-20', priceType: '行情价', province: '湖北' },
  ylmmXfht: { source: '园林网·西府海棠2026-11-18报价', sourceUrl: 'https://news.ylmm.com/detail/1391082.htm', date: '2026-11-18', priceType: '行情价', province: '河北' },
  st2026: { source: '汕头市中心城区(北区)2026年第二季度材料综合价格表（到达工地含税参考价）', sourceUrl: 'https://www.shantou.gov.cn/attachment/0/157/157303/2554983.pdf', date: '2026-Q2', priceType: '信息价', province: '广东' },
  ty2026: { source: '太原地区2026年常用园林苗木春季价格信息（住建局）', sourceUrl: 'https://zjt.shanxi.gov.cn/fwzl/bzdexx/jgxx/202607/P020260720602292347125.pdf', date: '2026-07', priceType: '信息价', province: '山西' },
  cdzoo: { source: '成都动物园2026年园庭景观绿化苗木采购项目中标合同', sourceUrl: 'https://www.ccgp-sichuan.gov.cn/maincms-web/article?channel=c5bff13f-21ca-4dac-b158-cb40accd3035&id=23edef07-edf5-44b4-aa37-0a9322864fe4', date: '2026-06-24', priceType: '中标价', province: '四川', unit: '盆' },
  acq1: { source: '百度爱采购·2026年苗木实时起批量报价（江苏常州供应商）', sourceUrl: 'https://b2b.baidu.com/land/e62d8e63d0c76b7f30a87f006a51d023?fid=403116032', date: '2026-09', priceType: '批发价', province: '江苏' },
  acqFlower: { source: '百度爱采购·2026年宿根花卉实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/b132841aa7315237eb358f9c12f719b6?fid=403116032', date: '2026-10', priceType: '批发价', province: '江苏' },
  acqGrass: { source: '百度爱采购·2026年观赏草实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/a19efcd7a95dc9519ecff6280f886848?fid=403116032', date: '2026-08', priceType: '批发价', province: '江苏' },
  acqVine: { source: '百度爱采购·2026年藤本植物实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/f13ed8707c9e9712e99b9995bd814087?fid=403116032', date: '2026-09', priceType: '批发价', province: '江苏' },
  acqWater: { source: '百度爱采购·2026年水生植物实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/df881debcf9641d9d81d46f3ed943036?fid=403116032', date: '2026-10', priceType: '批发价', province: '江苏' },
  acqFern: { source: '百度爱采购·2026年蕨类植物实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/9bc098d532391599052f486ce635dc0c?fid=403116032', date: '2026-09', priceType: '批发价', province: '江苏' },
  acqSouth: { source: '百度爱采购·2026年华南绿化苗木实时起批量报价', sourceUrl: 'https://b2b.baidu.com/land/688877b1a711b6472f7a6d0ed88eecd6?fid=403116032', date: '2026-09', priceType: '批发价', province: '江苏' },
  xbWater: { source: '西北苗木网·水生植物基地报价（江苏宿迁梵昌苗木）', sourceUrl: 'https://www.xbmiaomu.com/gongyingxinxi/list.php?catid=2949', date: '2026-10-24', priceType: '批发价', province: '江苏' },
  yl365Water: { source: '中华园林网·江苏水生植物报价表（2026-11-17）', sourceUrl: 'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_9_1.shtml', date: '2026-11-17', priceType: '行情价', province: '江苏' },
  yl365Yuzan: { source: '西北苗木网·玉簪种植基地规格价目表', sourceUrl: 'https://www.xbmiaomu.com/vip/18936843003/sell/itemid-411913.html', date: '2026-11-12', priceType: '批发价', province: '江苏' },
  yimutian: { source: '一亩田·蕨类产地货源行情（批量起售）', sourceUrl: 'https://www.ymt.com/hangqing/chandi_detail-306356-0-1157', date: '2026-11', priceType: '批发价', province: '四川' },
  ylmmGaoshan: { source: '园林苗木网·高山榕规格报价（广东广州）', sourceUrl: 'https://www.ylmm.com/b2b/product_detail_448.html', date: '2026-11-19', priceType: '行情价', province: '广东' },
};

/* ================= 1. 乔木（补齐此前无价品种） ================= */
add('鸡爪槭', [
  ['地径2cm', 32, '区间28~35取中值'], ['地径3cm', 60, '区间55~65取中值'], ['地径4cm', 80, '区间65~95取中值'],
  ['地径5cm', 130, '区间100~160取中值'], ['地径6cm', 235, '区间200~270取中值'], ['地径7cm', 315, '区间260~370取中值'],
  ['地径8cm', 375, '区间300~450取中值'], ['地径9cm', 525, '区间400~650取中值'], ['地径10cm', 675, '区间550~800取中值'],
  ['地径11cm', 800, '区间600~1000取中值'], ['地径12cm', 1350, '区间1300~1400取中值'],
], S.ylmmJzz);
add('鸡爪槭', [
  ['地径3cm', 10], ['地径5cm', 50], ['地径8cm', 260], ['地径10cm', 380],
  ['地径12cm', 1200], ['地径15cm', 1800], ['地径20cm', 3400], ['地径22cm', 4300], ['地径35cm', 12000],
], S.ycplJzz);
add('西府海棠', [
  ['胸径4cm/高300cm', 18.8], ['胸径5cm/高250cm', 100], ['胸径6cm/高250cm', 180],
  ['胸径8cm/高300cm', 350], ['胸径9cm/高350cm', 450], ['胸径10cm/高450cm', 1400],
  ['胸径12cm/高400cm', 1600], ['胸径14cm/高450cm', 4500], ['胸径16cm/高500cm', 6800],
], S.ylmmXfht);
add('西府海棠', [['胸径15cm', 150, '10000棵起批150元，30000棵起批145元']], { ...S.acq1, province: '江苏', date: '2026-08-11' });
add('黄栌', [['地径16cm', 110, '多杆丛生，16公分110元/棵']], { ...S.acq1, province: '山东', date: '2026-09-18' });
add('玉兰', [['苗高约100cm', 35, '牡丹玉兰树苗，100棵起批35元']], { ...S.acq1, province: '江苏', date: '2026-08-10' });
add('罗汉松', [['造型盆栽/地栽', 198, '10棵起批198元，30棵起批180元']], { ...S.acq1, province: '山东', date: '2026-10-14' });
add('雪松', [['苗高1-8m', 280, '100棵起批280元，300棵起批260元']], { ...S.acq1, province: '浙江', date: '2026-09-05' });
add('云杉', [['小苗/高度约50cm', 5, '1000棵起批5元，3000棵起批3元']], { ...S.acq1, province: '江苏', date: '2026-08-11' });
add('圆柏', [['工程苗/造型树', 68, '100棵起批68元，300棵起批66元']], { ...S.acq1, province: '江苏', date: '2026-10-17' });
add('红豆杉', [['绿化苗/约100cm', 35, '100棵起批35元，300棵起批33元']], { ...S.acq1, province: '江苏', date: '2026-09-20' });
// 汕头官方到场含税价：原文两列为「基准价 / 到场含税价」，取含税价入账，基准价留 note
add('樟树', [['胸径11-12cm/高4.6-5.0m', 303, '原基准价207元'], ['胸径13-15cm/高5.1-5.5m', 430, '原基准价262元']], S.st2026);
add('高山榕', [['胸径11-12cm/高4.6-5.0m', 274, '原基准价212元'], ['胸径13-15cm/高5.1-5.5m', 417, '原基准价273元']], S.st2026);
add('细叶榕', [['胸径11-12cm/高4.6-5.0m', 349, '原基准价262元'], ['胸径13-15cm/高5.1-5.5m', 448, '原基准价298元']], S.st2026);
add('大叶榕', [['胸径11-12cm/高4.6-5.0m', 259, '原基准价212元'], ['胸径13-15cm/高5.1-5.5m', 383, '原基准价252元']], S.st2026);
add('大叶紫薇', [['胸径9-10cm/高3.6-4.0m', 325, '原基准价262元'], ['胸径11-12cm/高4.1-4.5m', 488, '原基准价293元']], S.st2026);
add('美丽异木棉', [['胸径11-12cm/高4.6-5.0m', 327, '原基准价232元'], ['胸径13-15cm/高5.1-5.5m', 413, '原基准价257元']], S.st2026);
add('细叶榄仁', [['胸径11-12cm/高4.6-5.0m', 378, '原基准价257元'], ['胸径13-15cm/高5.1-5.5m', 465, '原基准价303元']], S.st2026);
add('桃花心木', [['胸径11-12cm/高4.6-5.0m', 339, '原基准价237元'], ['胸径13-15cm/高5.1-5.5m', 433, '原基准价278元']], S.st2026);
add('白兰', [['胸径9-10cm/高3.5-3.7m', 409, '原基准价252元'], ['胸径11-12cm/高3.8-4.0m', 522, '原基准价343元']], S.st2026);
add('高山榕', [
  ['胸径13cm/高550cm', 780], ['胸径20cm/高500cm', 2500], ['胸径25cm/高750cm', 1500],
  ['胸径40cm/高800cm', 3000], ['胸径80cm/高1200cm', 48000, '超大规格精品移栽苗'], ['胸径100cm/高1100cm', 17000, '超大规格精品移栽苗'],
], S.ylmmGaoshan);
add('木棉', [
  ['米径8-10cm', 40], ['米径13-15cm', 130], ['米径18-20cm', 350],
  ['米径20cm', 600], ['米径25-28cm', 1400],
], { source: '中华园林网·木棉价格表（揭阳/漳州）', sourceUrl: 'http://m.yuanlin365.com/miaomujiage/160778.shtml', date: '2026-11-16', priceType: '行情价', province: '广东' });
add('木棉', [['移植苗/庭院观赏', 150, '100棵起批150元，300棵起批130元']], { ...S.acq1, province: '江苏', date: '2026-08-11' });
add('王棕', [['容器苗/规格齐全', 580, '10棵起批580元，30棵起批550元']], { ...S.acq1, province: '江苏', date: '2026-08-11' });
add('鱼尾葵', [['盆栽/观叶', 80, '100棵起批80元']], { ...S.acq1, province: '江苏', date: '2026-08-11' });

/* ================= 2. 宿根花卉（爱采购 + 太原官方信息价） ================= */
add('芍药', [['花坛花境苗', 8, '1000棵起批8元，3000棵起批6元']], { ...S.acqFlower, province: '江苏', date: '2026-10-14' });
add('黑心菊', [['地被盆栽苗', 0.3, '1000株起批0.30元']], { ...S.acqFlower, province: '浙江', date: '2026-08-11' });
add('火炬花', [['营养钵盆栽苗', 1.8, '1000棵起批1.80元']], { ...S.acqFlower, province: '浙江', date: '2026-10-15' });
add('大花飞燕草', [['盆栽观赏苗', 5, '1000棵起批5元，3000棵起批4元']], { ...S.acqFlower, province: '江苏', date: '2026-09-19' });
add('大花葱', [['盆栽/切花材料', 0.32, '1000棵起批0.32元']], { ...S.acqFlower, province: '江苏', date: '2026-08-11' });
add('葱兰', [['地被观赏苗', 1.5, '1000棵起批1.50元']], { ...S.acqFlower, province: '江苏', date: '2026-08-11' });
add('韭兰', [['花坛花境苗', 0.5, '1000棵起批0.50元']], { ...S.acqFlower, province: '浙江', date: '2026-08-11' });
add('紫花地丁', [['观花绿化苗', 0.6, '1000棵起批0.60元']], { ...S.acqFlower, province: '江苏', date: '2026-09-24' });
add('二月兰', [['花海专用苗', 0.25, '10000株起批0.25元']], { ...S.acqFlower, province: '浙江', date: '2026-08-10' });
add('玉簪', [['高度20cm', 0.4], ['高度30cm', 0.55], ['高度40cm', 0.6], ['高度50cm', 1.2]], S.yl365Yuzan);
add('金边玉簪', [['高度25cm', 0.65], ['高度35cm', 0.8], ['高度40cm', 1.1]], S.yl365Yuzan);
add('花叶玉簪', [['杯苗', 0.7, '100棵起批0.70元']], { ...S.acqFlower, province: '江苏', date: '2026-08-11' });
add('马蔺', [['高度30-40cm', 2.2], ['高度30-40cm/≥2年生/蓬径15cm', 64, '太原官方信息价，元/㎡']], { ...S.ty2026, priceType: '信息价', unit: '株' });
// 太原官方地被信息价（元/㎡）——工程按面积计价惯例，单独按㎡记录
for (const [name, price] of [
  ['丰花月季', 88], ['大花品种月季', 150], ['三七景天', 49], ['八宝景天', 49],
  ['扶芳藤', 62], ['宿根福禄考', 82], ['玉簪', 98], ['金针', 63],
  ['萱草', 69], ['鸢尾', 65], ['德国鸢尾', 65], ['射干', 57], ['美人蕉', 81],
  ['草坪卷', 16], ['荷花', 64], ['睡莲', 64], ['地被菊', 86],
]) add(name, [['地被成片/≥2年生', price, '太原官方信息价，元/㎡']], { ...S.ty2026, unit: '㎡' });

/* ================= 3. 观赏草 ================= */
add('花叶芒', [['地栽苗', 0.5, '5000棵起批0.50元']], { ...S.acqGrass, province: '山东', date: '2026-09-03' });
add('斑叶芒', [['地栽袋苗', 0.2, '10000棵起批0.20元'], ['大杯小杯苗', 0.65, '10000株起批0.65元']], { ...S.acqGrass, province: '江苏', date: '2026-08-11' });
add('矮蒲苇', [['水生矮蒲苇苗', 0.21, '10000棵起批0.21元'], ['工程草', 0.4, '10000株起批0.40元']], { ...S.acqGrass, province: '江苏', date: '2026-08-11' });
add('蓝羊茅', [['常绿草本工程苗', 0.6, '1000棵起批0.60元']], { ...S.acqGrass, province: '江苏', date: '2026-08-11' });
add('细茎针茅', [['大杯小杯工程苗', 0.6, '1000棵起批0.60元']], { ...S.acqGrass, province: '江苏', date: '2026-08-11' });
add('画眉草', [['护土固坡苗/盆', 0.25, '1000盆起批0.25元']], { ...S.acqGrass, province: '江苏', date: '2026-08-11', unit: '盆' });
add('大油芒', [['110盆规格', 0.28, '1000盆起批0.28元']], { ...S.acqGrass, province: '山东', date: '2026-09-02', unit: '盆' });

/* ================= 4. 藤本 ================= */
add('铁线莲', [['爬藤苗', 20, '1000棵起批20元'], ['爬藤苗/小规格', 3, '1000棵起批3元']], { ...S.acqVine, province: '江苏', date: '2026-09-19' });
add('铁线莲', [['盆栽/100盆', 20]], S.cdzoo);
add('金银花', [['盆栽苗', 5], ['藤本苗', 15, '1000株起批15元']], { ...S.acqVine, province: '江苏', date: '2026-10-19' });
add('炮仗花', [['爬藤苗', 11, '1000棵起批11元'], ['墙体绿化苗', 15, '1000棵起批15元']], { ...S.acqVine, province: '江苏', date: '2026-08-11' });
add('风车茉莉', [['棚架藤本苗', 6, '1000棵起批6元']], { ...S.acqVine, province: '江苏', date: '2026-08-11' });
add('络石', [['青叶络石工程苗', 3.15, '1000棵起批3.15元']], { ...S.acqVine, province: '江苏', date: '2026-09-12' });
add('花叶络石', [['盆栽/90盆', 2.5]], S.cdzoo);
add('蔓马缨丹', [['工程绿化苗', 0.4, '10000棵起批0.40元']], { ...S.acqVine, province: '江苏', date: '2026-09-21' });
add('紫藤', [['苗高≥0.6m/地径≥1cm', 27, '太原官方信息价'], ['苗高≥0.8m/地径≥2cm', 45, '太原官方信息价'], ['苗高≥1.0m/地径≥3cm', 86, '太原官方信息价']], { ...S.ty2026, unit: '株' });
add('蔷薇', [['苗高≥0.6m/地径≥0.6cm', 15, '太原官方信息价'], ['苗高≥0.8m/地径≥2cm', 45, '太原官方信息价'], ['苗高≥1.0m/地径≥3cm', 86, '太原官方信息价']], { ...S.ty2026, unit: '株' });
add('藤本月季', [['苗高≥0.8m/4枝/地径≥1cm', 28, '太原官方信息价'], ['苗高≥1.5m/3枝/地径≥4cm', 120, '太原官方信息价']], { ...S.ty2026, unit: '株' });
add('三叶地锦', [['两年生/苗高≥0.5m', 3, '太原官方信息价'], ['苗高≥0.8m/地径≥0.8cm', 25, '太原官方信息价']], { ...S.ty2026, unit: '株' });
add('五叶地锦', [['两年生/苗高≥0.5m', 2, '太原官方信息价']], { ...S.ty2026, unit: '株' });

/* ================= 5. 水生 ================= */
add('香蒲', [['双色杯苗', 0.35, '10000棵起批0.35元'], ['水生苗', 0.5]], { ...S.acqWater, province: '浙江', date: '2026-08-11' });
add('黄菖蒲', [['水体绿化苗', 0.5, '10000棵起批0.50元'], ['杯苗高20cm', 2.0, '产区杯苗1.5~3.0元/株，按中值']], { ...S.acqWater, province: '江苏', date: '2026-10-10' });
add('黄菖蒲', [['水生苗', 0.14]], { ...S.yl365Water, province: '江苏' });
add('慈姑', [['12*10cm营养钵', 2, '100棵起批2元，10000棵起批1元']], { ...S.acqWater, province: '山东', date: '2026-09-17' });
add('水葱', [['高度20cm', 0.16, '60棵起订'], ['水生苗', 0.4]], { ...S.xbWater, province: '江苏' });
add('花叶水葱', [['净化水质苗', 0.3, '1000棵起批0.30元']], { ...S.acqWater, province: '江苏', date: '2026-08-11' });
add('铜钱草', [['香菇草盆栽', 9, '100棵起批9元']], { ...S.acqWater, province: '山东', date: '2026-08-11' });
add('泽泻', [['水景工程苗', 0.55, '5000棵起批0.55元']], { ...S.acqWater, province: '江苏', date: '2026-10-11' });
add('旱伞草', [['湿地造景苗', 0.36, '1000棵起批0.36元'], ['盆栽/200盆', 10]], { ...S.acqWater, province: '江苏', date: '2026-08-11' });
add('荇菜', [['水面造景苗', 0.6, '10000株起批0.60元']], { ...S.acqWater, province: '江苏', date: '2026-10-19' });
add('芡实', [['水体绿化苗', 0.3, '10000棵起批0.30元']], { ...S.acqWater, province: '江苏', date: '2026-10-16' });
add('菖蒲', [['高度20cm', 0.1, '10棵起订']], { ...S.xbWater, province: '江苏' });
add('睡莲', [['盆栽/100盆', 18]], S.cdzoo);
add('花叶芦竹', [['高度50cm', 0.52, '10棵起订'], ['水生苗', 0.78]], { ...S.xbWater, province: '江苏' });
add('再力花', [['盆栽/100盆', 10]], S.cdzoo);
add('梭鱼草', [['盆栽/80盆', 11]], S.cdzoo);
add('水生美人蕉', [['盆栽/200盆', 12]], S.cdzoo);
add('水生鸢尾', [['盆栽/200盆', 9]], S.cdzoo);

/* ================= 6. 蕨类与苔藓 ================= */
add('铁线蕨', [['盆栽/100盆', 28, '100盆起批28元，室内绿植口径'], ['盆栽/大规格', 40, '静态盆栽价'], ['地栽苗/批量', 3.5, '产地批量价']], { ...S.acqFern, province: '江苏', date: '2026-09-18' });
add('铁线蕨', [['优质地栽苗', 3.5, '山东青州产地直发']], { ...S.yimutian, province: '山东' });
add('贯众', [['蕨苗', 3.8, '1000棵起批3.80元']], { ...S.acqFern, province: '江苏', date: '2026-09-10' });
add('凤尾蕨', [['杯苗', 2, '四川郫都基地，1000棵起售']], { ...S.yimutian, province: '四川' });
add('波斯顿蕨', [['造景苗', 3, '10棵起批3元'], ['110盆栽', 4.5, '广东荔湾产地']], { ...S.acqFern, province: '江苏', date: '2026-09-21' });
add('巢蕨', [['观赏造景苗', 9, '1000棵起批9元']], { ...S.acqFern, province: '浙江', date: '2026-10-13' });
add('富贵蕨', [['地被绿化苗', 3.5, '四川郫都基地直供']], { ...S.yimutian, province: '四川' });
// 鹿角蕨：台湾产区报价为新台币，保留资料但不作为人民币工程价
add('鹿角蕨', [['3吋盆/二叉鹿角蕨', 100, '新台币，不可直接用于人民币 BOQ']], {
  source: '微體溫室·2026 鹿角蕨品種價格一覽表（台湾产区）',
  sourceUrl: 'https://micro-oasis.com/posts/staghorn-fern-type-price/',
  date: '2026', priceType: '行情价', province: '中国台湾', currency: 'TWD', unit: '盆',
});

/* ================= 7. 华南/西南区域植物（灌木与地被） ================= */
add('龙船花', [['小红盆', 3, '1000棵起批3元']], { ...S.acqSouth, province: '江苏', date: '2026-10-22' });
add('变叶木', [['多色工程苗', 18, '1000棵起批18元']], { ...S.acqSouth, province: '江苏', date: '2026-08-11' });
add('鹤望兰', [['绿化植株/小苗', 0.7, '100棵起批0.70元']], { ...S.acqSouth, province: '浙江', date: '2026-09-01' });
add('山茶', [['盆栽/工程苗', 12]], S.cdzoo);

/* ---------- 合并去重并记录 ---------- */
const seen = new Set(doc.records.map(r => `${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`));
let added = 0;
for (const r of fresh) {
  const k = `${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`;
  if (seen.has(k)) continue;
  seen.add(k); doc.records.push(r); added++;
}
const byName = {};
for (const r of doc.records) (byName[r.name] ||= []).push(r);
doc.byName = byName;
const priceTypes = {};
for (const r of doc.records) priceTypes[r.priceType] = (priceTypes[r.priceType] || 0) + 1;
const climates = {};
for (const r of doc.records) climates[r.climate] = (climates[r.climate] || 0) + 1;
doc.counts = {
  totalRecords: doc.records.length,
  speciesCovered: Object.keys(byName).length,
  byPriceType: priceTypes,
  byClimate: climates,
};
doc.collectedAt = '2026-11-21';
doc.notice = '公开查证价格基准，非政府定价；台币/异常单位记录已标注或剔除，使用前须结合项目复核。';
fs.writeFileSync(FILE, JSON.stringify(doc, null, 2));
console.log(`本批新增 ${added} 条，总计 ${doc.records.length} 条 / ${doc.counts.speciesCovered} 个品种`);
console.log('价格口径:', JSON.stringify(priceTypes));
