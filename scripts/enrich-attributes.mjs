#!/usr/bin/env node
/**
 * 补齐观赏属性(ornamentalFeatures)与物候月份(phenology)缺口。
 * 原则：
 *  - 观赏属性按已确认的园艺用途/品类补齐（观赏草、竹、地被、蕨类苔藓、水生等），source 标 horticultural-reference。
 *  - 物候月份只在有可靠共识的范围补齐（如芒属花期8-10月、桂花9-10月）；发育不全或无法可靠判断的保持空，绝不臆测。
 *  - 已存在的字段一律不覆盖（幂等）。
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT=process.cwd();
const FILES=['plants.verified.enriched.json','plants.enriched.json','plants.regional.json'];

// 品类 → 观赏属性（保守：只列该品类公认的观赏价值）
const CATEGORY_TRAITS={
  '竹类':['观姿','观叶','观干'],
  '观赏草':['观叶','观姿'],
  '草坪地被':['观叶'],
  '蕨类苔藓':['观叶'],
  '水生植物':['观叶','观花'],
};
// 名称关键词 → 追加属性
const KEY_TRAITS=[
  [/花叶|斑叶|金边|银边|紫叶|红叶|彩叶|变叶|金镶玉|花叶|白斑/, '观叶'],
  [/红瑞|金枝|红枝|紫竹|金竹|黄金|白桦/, '观枝'],
  [/火把|火炬|红花|粉花|紫花|白花|黄花|蓝花|花色/, '观花'],
  [/果|柿|石榴|枸骨|冬青/, '观果'],
  [/桂花|茉莉|米兰|含笑|腊梅|蜡梅|薰衣草|迷迭香|九里香|芳香/, '芳香'],
];
// 花期共识（月份）；仅对有稳定共识的品类/品种补充
const BLOOM={
  '芒':[8,9,10],'芒草':[8,9,10],'细叶芒':[8,9,10],'花叶芒':[7,8,9,10],'斑叶芒':[8,9,10],
  '矮蒲苇':[9,10,11],'蒲苇':[9,10,11],'狼尾草':[7,8,9,10],'紫穗狼尾草':[7,8,9,10],
  '细茎针茅':[5,6,7],'蓝羊茅':[5,6],'画眉草':[8,9],'大油芒':[8,9],'斑茅':[9,10],
  '桂花':[9,10],'腊梅':[12,1],'蜡梅':[12,1],'迎春':[2,3,4],'迎春花':[2,3,4],
  '紫荆':[3,4],'木芙蓉':[9,10,11],'红瑞木':[5,6],'珍珠梅':[6,7,8],
  '二月兰':[3,4,5],'虞美人':[5,6,7],'波斯菊':[6,7,8,9],'百日草':[6,7,8,9],
  '一串红':[6,7,8,9,10],'千日红':[6,7,8,9],'翠菊':[7,8,9],'金鱼草':[4,5,6],
  '美女樱':[5,6,7,8,9],'柳叶马鞭草':[6,7,8,9],'薰衣草':[6,7,8],'迷迭香':[5,6],
  '铁线莲':[5,6,7,8,9],'金银花':[5,6,7],'炮仗花':[1,2,3],'使君子':[5,6,7,8,9],
  '睡莲':[6,7,8,9],'荷花':[6,7,8],'再力花':[6,7,8,9],'梭鱼草':[6,7,8,9],
  '黄菖蒲':[5,6],'花菖蒲':[5,6],'香蒲':[6,7,8],'慈姑':[7,8],'泽泻':[6,7,8],
  '山茶':[1,2,3],'茶梅':[11,12,1],'含笑':[4,5],'茉莉':[5,6,7,8,9],
  '杜鹃':[4,5],'马缨杜鹃':[4,5],'绣球':[6,7,8],'绣线菊':[5,6,7],
  '芍药':[5,6],'玉簪':[7,8,9],'金边玉簪':[7,8,9],'花叶玉簪':[7,8,9],
  '火炬花':[6,7,8],'大花葱':[5,6],'葱兰':[7,8,9],'韭兰':[7,8,9],
  '黑心菊':[6,7,8,9],'天人菊':[6,7,8],'松果菊':[6,7,8],'落新妇':[6,7,8],
};
// 果期共识
const FRUIT={
  '枸骨':[10,11,12],'构骨':[10,11,12],'冬青':[10,11],'龟甲冬青':[10,11],
  '火棘':[10,11,12],'海棠':[9,10],'西府海棠':[9,10],'石榴':[9,10],'柿':[10,11],
  '银杏':[9,10],'紫荆':[8,9],'白蜡':[9,10],'栾树':[9,10],'栾':[9,10],
  '慈姑':[9,10],'芡实':[9,10],'菱':[9,10],
};
// 色叶期共识（秋色叶/春色叶）
const COLOR={
  '银杏':[10,11],'黄栌':[10,11],'红枫':[10,11],'鸡爪槭':[10,11],'红花槭':[10,11],
  '美国红枫':[10,11],'乌桕':[10,11],'五角枫':[10,11],'元宝枫':[10,11],'三角枫':[10,11],
  '蒙古栎':[10,11],'栓皮栎':[10,11],'榉树':[10,11],'白蜡':[10,11],'栾树':[9,10],
  '爬山虎':[10,11],'爬山虎(彩叶)':[10,11],'爬墙虎/地锦':[10,11],'五叶地锦':[10,11],
  '-red':[10,11],
};

let ornAdded=0,bloomAdded=0,fruitAdded=0,colorAdded=0;
for(const rel of FILES){
  const p=path.join(ROOT,'src/data',rel);
  const doc=JSON.parse(fs.readFileSync(p,'utf8'));
  for(const plant of doc.plants){
    const name=String(plant.name||'');
    const form=String(plant.growthForm||'');
    const cat=Array.isArray(plant.categories)?plant.categories.join(','):'';
    // 1) 观赏属性
    if(!Array.isArray(plant.ornamentalFeatures)||plant.ornamentalFeatures.length===0){
      let traits=[];
      for(const[k,v]of Object.entries(CATEGORY_TRAITS)) if(form.includes(k)||cat.includes(k)) traits.push(...v);
      if(!traits.length){
        // 按名称兜底（保守）
        if(/芒|蒲苇|狼尾草|针茅|画眉草|油芒|茅|草$/.test(name)) traits=['观叶','观姿'];
        else if(/竹/.test(name)) traits=['观姿','观叶','观干'];
        else if(/蕨|藓|苔|地钱/.test(name)) traits=['观叶'];
        else if(/草坪|地被|麦冬|马蹄金|沿阶草|委陵菜|细辛/.test(name)) traits=['观叶'];
        else if(/水生|菖蒲|香蒲|泽泻|慈姑|荇菜|芡实|水葱|芦竹|菱|睡莲|荷花/.test(name)) traits=['观叶','观花'];
      }
      for(const[re,t]of KEY_TRAITS) if(re.test(name)&&!traits.includes(t)) traits.push(t);
      if(traits.length){plant.ornamentalFeatures=[...new Set(traits)];ornAdded++;}
    }
    // 2) 物候月份（只在可靠共识表内补，且原字段为空）
    plant.phenology=plant.phenology||{};
    if((!plant.phenology.flowerMonths||!plant.phenology.flowerMonths.length)&&BLOOM[name]){
      plant.phenology.flowerMonths=BLOOM[name];bloomAdded++;
    }
    if((!plant.phenology.fruitMonths||!plant.phenology.fruitMonths.length)&&FRUIT[name]){
      plant.phenology.fruitMonths=FRUIT[name];fruitAdded++;
    }
    if((!plant.phenology.colorMonths||!plant.phenology.colorMonths.length)&&COLOR[name]){
      plant.phenology.colorMonths=COLOR[name];colorAdded++;
    }
    if(!plant.phenology.source) plant.phenology.source='horticultural-reference';
  }
  fs.writeFileSync(p,JSON.stringify(doc,null,2));
}
console.log(`观赏属性补齐 ${ornAdded} 株；花期 ${bloomAdded}、果期 ${fruitAdded}、色叶期 ${colorAdded} 条`);
