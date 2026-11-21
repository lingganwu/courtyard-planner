import fs from 'node:fs';
const db=JSON.parse(fs.readFileSync('src/data/plants.json','utf8'));
const errors=[];const ids=new Set();const latin=new Set();
for(const p of db.plants){
 for(const k of ['id','name','latinName','family','genus','growthForm','categories','ornamentalFeatures','phenology','sourceUrl','sourceType','reviewStatus','pricingStatus','assetStatus']) if(p[k]===undefined||p[k]===null||p[k]==='') errors.push(`${p.id||'unknown'} missing ${k}`);
 if(ids.has(p.id))errors.push(`duplicate id ${p.id}`);ids.add(p.id);
 if(latin.has(p.latinName))errors.push(`duplicate latinName ${p.latinName}`);latin.add(p.latinName);
 if(p.reviewStatus!=='botanical-verified')errors.push(`${p.id} is not botanically verified`);
 if(!/^https:\/\//.test(p.sourceUrl))errors.push(`${p.id} sourceUrl invalid`);
 if(!Array.isArray(p.categories)||!p.categories.length)errors.push(`${p.id} categories missing`);
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`Plant audit passed: ${db.plants.length} verified records.`);
