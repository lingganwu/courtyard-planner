#!/usr/bin/env node
/**
 * 价格基准库第四批：草花、竹类与成都动物园合同剩余品种。
 * 来源：中华园林网江苏草花报价表(2026-11-17)、成都动物园2026采购合同、
 *       大庄绿宝园林网地被花卉报价(2026)。
 */
import fs from 'node:fs';
import path from 'node:path';
const FILE = path.join(process.cwd(), 'src/data/price-benchmarks.json');
const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const climateOf = p => ({
  '北京':'华北温带','河北':'华北温带','河南':'华北温带','天津':'华北温带','山西':'华北温带',
  '江苏':'华东暖温带','浙江':'华东暖温带','上海':'华东暖温带','山东':'华东暖温带','安徽':'华东暖温带',
  '湖北':'华中过渡','湖南':'华中过渡','江西':'华中过渡',
  '广东':'华南亚热带','广西':'华南亚热带','海南':'华南亚热带','福建':'华南亚热带',
  '四川':'西南高原亚热带','云南':'西南高原亚热带','贵州':'西南高原亚热带','重庆':'西南高原亚热带',
}[p]||'全国参考');
const normName = n => String(n).replace(/[（(].*?[)）]/g,'').replace(/\s/g,'').trim();
function parseSpec(s){const t=String(s);const m=t.match(/(胸径|地径|米径|杆径|径|冠径|冠幅|高度|高)[^\d]{0,4}(\d+(?:\.\d+)?)/);if(m){const map={'胸径':'dbh','地径':'ground','米径':'dbh','杆径':'ground','径':'dbh','冠径':'crown','冠幅':'crown','高度':'height','高':'height'};return{type:map[m[1]]||'other',value:Number(m[2])}}const h=t.match(/(\d+(?:\.\d+)?)\s*(?:cm|厘米|公分)/);return h?{type:'height',value:Number(h[1])}:{type:'other',value:null}}
let seq=Math.max(...doc.records.map(r=>Number(String(r.id).replace('PR-',''))||0));
const fresh=[];
function add(name,pairs,meta){for(const[spec,price,note]of pairs){if(!Number.isFinite(price)||price<=0)continue;fresh.push({id:`PR-${String(++seq).padStart(3,'0')}`,name:normName(name),rawName:name,spec,specParsed:parseSpec(spec),unit:meta.unit||'株',price,priceType:meta.priceType,province:meta.province,climate:climateOf(meta.province),source:meta.source,sourceUrl:meta.sourceUrl,date:meta.date,note:note||meta.note||''})}}
const yl365Grass={source:'中华园林网·江苏草花类苗木报价表(2026-11-17)',sourceUrl:'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_9_1.shtml',date:'2026-11-17',priceType:'行情价',province:'江苏'};
const cdzoo={source:'成都动物园2026年园庭景观绿化苗木采购中标合同',sourceUrl:'https://www.ccgp-sichuan.gov.cn/maincms-web/article?channel=c5bff13f-21ca-4dac-b158-cb40accd3035&id=23edef07-edf5-44b4-aa37-0a9322864fe4',date:'2026-06-24',priceType:'中标价',province:'四川',unit:'盆'};
const lvbad={source:'大庄绿宝园林网·地被花卉培育报价(2026)',sourceUrl:'https://www.lvbad.com/chandixinwen/1147162.html',date:'2026',priceType:'行情价',province:'江苏'};

/* 草花（中华园林网江苏统一规格苗高30cm/冠幅25cm，2.8元/株） */
for(const name of ['百日草','波斯菊','孔雀草','石竹','矮牵牛','万寿菊','皇帝菊','五星花','洋凤仙','四季海棠']){
  add(name,[['苗高30cm/冠幅25cm',2.8]],yl365Grass);
}
/* 成都动物园合同中的草花与球根 */
for(const[name,price]of[['郁金香',11],['紫罗兰',1.7],['旅人蕉',80],['文殊兰',50],['花叶良姜',15],['熊猫堇',1],['大花芙蓉葵',8],['飘香藤',8],['黄木香花',20],['多花素馨',20],['绿萝',5],['水生美人蕉',12]]){
  add(name,[[`盆栽/${name}`,price]],cdzoo);
}
/* 竹类（成都动物园合同，注意单位：根/丛/盆） */
add('金镶玉竹',[['竹根/200根',8]],[...[cdzoo]][0]);
add('凤尾竹',[['盆栽/1200盆',60]],cdzoo);
add('小琴丝竹',[['丛/200丛',50]],cdzoo);
/* 大庄绿宝地被花卉报价（行情价，单位明确） */
for(const[name,price,unit,note]of[
  ['紫花地丁',10,'株',''],['麦冬',5,'株',''],['马蹄莲',12,'株',''],['万年青',15,'株',''],
  ['小叶黄杨',20,'株',''],['红叶石楠',40,'株',''],['金叶女贞',25,'株',''],['红花继木',35,'株',''],
  ['爬山虎',15,'株',''],['凌霄',20,'株',''],['金银花',18,'株',''],['常春藤',12,'株',''],['络石',16,'株',''],
  ['苔藓',50,'㎡',''],['铁线蕨',15,'盆',''],['地被菊',10,'株',''],['天人菊',12,'株',''],['蓝羊茅',18,'株',''],
]) add(name,[[`地被培育苗/${unit}`,price,note]],{...lvbad,unit});

const seen=new Set(doc.records.map(r=>`${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`));
let added=0;
for(const r of fresh){const k=`${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`;if(seen.has(k))continue;seen.add(k);doc.records.push(r);added++}
const byName={};for(const r of doc.records)(byName[r.name]||=[]).push(r);doc.byName=byName;
const pt={},cl={};for(const r of doc.records){pt[r.priceType]=(pt[r.priceType]||0)+1;cl[r.climate]=(cl[r.climate]||0)+1}
doc.counts={totalRecords:doc.records.length,speciesCovered:Object.keys(byName).length,byPriceType:pt,byClimate:cl};
fs.writeFileSync(FILE,JSON.stringify(doc,null,2));
console.log(`第四批新增 ${added} 条，总计 ${doc.records.length} 条 / ${doc.counts.speciesCovered} 个品种`);
