#!/usr/bin/env node
/**
 * 价格基准库第五批：常见灌木/乔木/草花的最后一轮补齐。
 * 来源：切它网潢川花木规格价目表、365园林网紫荆价格表、园林网紫荆报价、
 *       百度爱采购2026灌木实时报价、大庄绿宝草花批发价、一亩田云南昆明苗圃、
 *       青州三江花卉、湖南林之泉苗木基地。
 * 单位错位/提取物等非苗木价格一律剔除。
 */
import fs from 'node:fs';
import path from 'node:path';
const FILE=path.join(process.cwd(),'src/data/price-benchmarks.json');
const doc=JSON.parse(fs.readFileSync(FILE,'utf8'));
const climateOf=p=>({'北京':'华北温带','河北':'华北温带','河南':'华北温带','天津':'华北温带','山西':'华北温带','江苏':'华东暖温带','浙江':'华东暖温带','上海':'华东暖温带','山东':'华东暖温带','安徽':'华东暖温带','湖北':'华中过渡','湖南':'华中过渡','江西':'华中过渡','广东':'华南亚热带','广西':'华南亚热带','海南':'华南亚热带','福建':'华南亚热带','四川':'西南高原亚热带','云南':'西南高原亚热带','贵州':'西南高原亚热带','重庆':'西南高原亚热带'}[p]||'全国参考');
const normName=n=>String(n).replace(/[（(].*?[)）]/g,'').replace(/\s/g,'').trim();
function parseSpec(s){const t=String(s);const m=t.match(/(胸径|地径|米径|杆径|径|冠径|冠幅|高度|高)[^\d]{0,4}(\d+(?:\.\d+)?)/);if(m){const map={'胸径':'dbh','地径':'ground','米径':'dbh','杆径':'ground','径':'dbh','冠径':'crown','冠幅':'crown','高度':'height','高':'height'};return{type:map[m[1]]||'other',value:Number(m[2])}}const h=t.match(/(\d+(?:\.\d+)?)\s*(?:cm|厘米|公分)/);return h?{type:'height',value:Number(h[1])}:{type:'other',value:null}}
let seq=Math.max(...doc.records.map(r=>Number(String(r.id).replace('PR-',''))||0));
const fresh=[];
function add(name,pairs,meta){for(const[spec,price,note]of pairs){if(!Number.isFinite(price)||price<=0)continue;fresh.push({id:`PR-${String(++seq).padStart(3,'0')}`,name:normName(name),rawName:name,spec,specParsed:parseSpec(spec),unit:meta.unit||'株',price,priceType:meta.priceType,province:meta.province,climate:climateOf(meta.province),source:meta.source,sourceUrl:meta.sourceUrl,date:meta.date,note:note||meta.note||''})}}
const qieta1={source:'切它网·潢川花木紫荆/含笑/塔柏价格表',sourceUrl:'http://www.qieta.com/sell/show-3410183.html',date:'2026-11-07',priceType:'行情价',province:'河南'};
const qieta2={source:'切它网·绿化工程报价（红瑞木/苏铁/罗汉松等）',sourceUrl:'http://www.qieta.com/sell/show-5060217.html',date:'2026',priceType:'行情价',province:'河南'};
const yl365Zijing={source:'365园林网·紫荆价格表',sourceUrl:'http://m.yuanlin365.com/miaomujiage/1363951.shtml',date:'2026-09-05',priceType:'行情价',province:'江苏'};
const ylZijing={source:'园林网·紫荆2026-07-31报价',sourceUrl:'https://news.ylmm.com/detail/2026731/1329597.htm',date:'2026-07-31',priceType:'行情价',province:'江苏'};
const acqShrub={source:'百度爱采购·2026灌木实时起批量报价',sourceUrl:'https://b2b.baidu.com/land/2d98ecab62eee8b3854c0e555bacbe55?fid=403116032',date:'2026-10',priceType:'批发价',province:'江苏'};
const lvbadFlower={source:'大庄绿宝园林网·山西草花苗木批发价格',sourceUrl:'https://www.lvbad.com/zhiwuku/721980.html',date:'2026-02',priceType:'行情价',province:'山西'};
const ymtKm={source:'一亩田·云南昆明草花地被苗圃一手货源',sourceUrl:'https://m.ymt.com/shop/9666123',date:'2026-11',priceType:'批发价',province:'云南'};
const sjhh={source:'中国园林网·青州市三江花卉苗木专业合作社产品报价',sourceUrl:'http://www.zjylw.com/u-sjhh6688/',date:'2026-06-08',priceType:'批发价',province:'山东'};
const lnqm={source:'湖南林之泉苗木基地·草本花卉价格表',sourceUrl:'http://hunanmiaomu.com/price/huahui/index.html',date:'2026-11',priceType:'行情价',province:'湖南'};

/* ---- 灌木/小乔木 ---- */
add('紫荆',[['高度150cm',6],['高度180cm',10],['高度220cm',16],['冠径150cm',40],['地径8cm',380]],qieta1);
add('紫荆',[['米径5-6cm/高300cm',60],['米径8-9cm/高300cm',150],['米径10-11cm/高400cm',240],['米径12-13cm/高500cm',450],['米径15-16cm/高600cm',900]],yl365Zijing);
add('紫荆',[['地径2cm',5],['地径3cm',18],['地径4cm',20],['地径6cm',55],['胸径12cm/高800cm',800],['胸径15cm/高800cm',1600]],ylZijing);
add('加拿大紫荆',[['工程苗/10棵起批',1200,'10棵起批1200元，30棵起批1000元']],acqShrub);
add('乐昌含笑',[['冠径15-300cm',3,'潢川花木报价，按小规格']],qieta1);
add('蜡梅',[['独杆棒棒型',52,'100棵起批52元，300棵起批50元']],acqShrub);
add('木芙蓉',[['冠径100cm',20],['冠径150cm',60]],qieta1);
add('木芙蓉',[['地栽苗/高80-500cm',23,'1000棵起批23元']],acqShrub);
add('红瑞木',[['高度80-100cm',1.2],['高度130cm',1.6],['高度150cm',2]],qieta1);
add('红瑞木',[['绿化苗',0.25,'1000棵起批0.25元']],acqShrub);
add('苏铁',[['高度100cm',120],['高度150cm',230]],qieta2);
add('珍珠梅',[['高度20-60cm',90,'100棵起批90元']],acqShrub);
add('八角金盘',[['工程苗',0.75,'1000棵起批0.75元']],acqShrub);
add('六道木',[['大花六道木',0.35,'云南昆明苗圃一手货源']],ymtKm);
add('迷迭香',[['种植园小苗',0.35,'云南昆明基地直销']],ymtKm);
add('薰衣草',[['种植园苗',0.35,'云南昆明一手货源']],ymtKm);
add('贴梗海棠',[['皱皮木瓜苗',9,'10000棵起批9元']],acqShrub);
add('绣球荚蒾',[['木本绣球/冠径100cm',30],['木本绣球/冠径150cm',60]],qieta1);
add('黄金槐',[['香花槐/地径3cm',30],['地径5cm',80],['地径8cm',360],['地径12cm',800]],qieta2);
add('龙爪槐',[['地径3cm',30],['地径5cm',80],['地径8cm',360]],qieta2);
add('复叶槭',[['地径3cm',30],['地径5cm',80],['地径8cm',360]],qieta2);

/* ---- 草花与宿根 ---- */
for(const[name,price]of[['虞美人',0.8],['一串红',1.0],['美女樱',1.2],['波斯菊',0.3],['万寿菊',0.4],['百日草',0.9],['石竹',0.6]]){
  add(name,[[`草花苗/${name}`,price,'苗高约10-35cm']],lvbadFlower);
}
add('一串红',[['高30cm/冠30cm',0.73],['高30cm/冠20cm',0.70],['杯苗高20cm',0.35]],{source:'园林苗木网·一串红报价',sourceUrl:'https://www.ylmm.com/b2b/product_detail_428.html',date:'2026-11',priceType:'行情价',province:'江苏'});
add('一串红',[['高21cm/冠幅15cm',0.16,'营养钵精品苗']],sjhh);
add('美女樱',[['细叶美女樱/袋',0.25],['红花美女樱',0.30]],ymtKm);
add('柳叶马鞭草',[['营养钵苗',0.35,'云南昆明一手货源']],ymtKm);
add('千日红',[['草花苗',2.8]],{source:'中华园林网·江苏草花报价表',sourceUrl:'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_9_1.shtml',date:'2026-11-17',priceType:'行情价',province:'江苏'});
add('翠菊',[['草花苗',2.8]],{source:'中华园林网·江苏草花报价表',sourceUrl:'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_9_1.shtml',date:'2026-11-17',priceType:'行情价',province:'江苏'});
add('金鱼草',[['草花苗',2.8]],{source:'中华园林网·江苏草花报价表',sourceUrl:'http://m.yuanlin365.com/miaomu/mmiaomu_%BD%AD%CB%D5__1_9_1.shtml',date:'2026-11-17',priceType:'行情价',province:'江苏'});
add('孔雀草',[['高23cm/冠幅13cm',0.15,'营养钵工程苗']],sjhh);
add('鸡冠花',[['盆栽',0.8]],lnqm);
add('葱兰',[['白花葱兰',0.2],['红花葱兰',0.4,'单位：斤']],lnqm);
add('太阳花',[['草本花卉',0.7]],lnqm);
add('马鞭草',[['草花苗',0.7,'湖南林之泉报价']],lnqm);
add('蓝亚麻',[['宿根花卉',0.35,'青州三江花卉宿根系列']],sjhh);

const seen=new Set(doc.records.map(r=>`${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`));
let added=0;
for(const r of fresh){const k=`${r.name}|${r.spec}|${r.price}|${r.sourceUrl}`;if(seen.has(k))continue;seen.add(k);doc.records.push(r);added++}
const byName={};for(const r of doc.records)(byName[r.name]||=[]).push(r);doc.byName=byName;
const pt={},cl={};for(const r of doc.records){pt[r.priceType]=(pt[r.priceType]||0)+1;cl[r.climate]=(cl[r.climate]||0)+1}
doc.counts={totalRecords:doc.records.length,speciesCovered:Object.keys(byName).length,byPriceType:pt,byClimate:cl};
fs.writeFileSync(FILE,JSON.stringify(doc,null,2));
console.log(`第五批新增 ${added} 条，总计 ${doc.records.length} 条 / ${doc.counts.speciesCovered} 个品种`);
