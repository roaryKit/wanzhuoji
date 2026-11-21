const C=require('./constants');
const plazaFields=['_id','wineName','abv','place','moodTags','text','image','images','likeCount','commentCount','createdAt'];
const MAX_IMAGES=3;
// 兼容旧记录的单图字段 image：读取/保存时统一迁移为 images 数组。
function imagesOf(r){if(!r)return [];if(Array.isArray(r.images))return r.images.filter(x=>typeof x==='string'&&x);return typeof r.image==='string'&&r.image?[r.image]:[]}
function text(x,max,required=false){if(x===undefined||x===null)x='';if(typeof x!=='string'||[...x.trim()].length>max||required&&!x.trim())throw Error(required?'请填写酒款名':'文字长度或类型不正确');return x.trim()}
function validate(e){const r={wineName:text(e.wineName,30,true),category:e.category||'其他',place:text(e.place,10),moodTags:e.moodTags||[],text:text(e.text,200),isSolo:e.isSolo,privacy:e.privacy||'private'};if(!C.categories.includes(r.category)||typeof r.isSolo!=='boolean'||!['private','public'].includes(r.privacy)||!r.isSolo&&r.privacy==='public')throw Error('仅单人独酌可公开');if(!Array.isArray(r.moodTags)||r.moodTags.length>3||new Set(r.moodTags).size!==r.moodTags.length)throw Error('情绪标签最多3个');r.moodTags=r.moodTags.map(t=>text(t,20,true));const raw=e.images!==undefined?e.images:(e.image?[e.image]:[]);if(!Array.isArray(raw))throw Error('图片格式不正确');const imgs=[...new Set(raw.map(x=>text(x,1024,true)))];if(imgs.length>MAX_IMAGES)throw Error('最多3张图片');r.images=imgs;r.image=imgs[0]||'';if(new Set(r.moodTags).size!==r.moodTags.length)throw Error('情绪标签不能重复');for(const k of ['abv','volumeMl']){if(e[k]!==undefined&&e[k]!==''&&e[k]!==null){if(typeof e[k]!=='number'||!Number.isFinite(e[k])||e[k]<0||k==='abv'&&e[k]>100)throw Error('度数或容量不正确');r[k]=e[k]}}return r}
function content(r){return [r.wineName,r.category,r.place,...r.moodTags,r.text].join(' ')}
function visible(r){return r.privacy==='public'&&r.auditStatus==='pass'&&r.isSolo===true&&!r.reportHold}
function project(r){return Object.fromEntries(plazaFields.map(k=>[k,r[k]===undefined?null:r[k]]))}
function callbackAllowed(r,e){return !!r&&r.privacy==='public'&&r.auditStatus==='pending'&&!r.reportHold&&r.auditVersion===e.version&&Array.isArray(r.auditImages)&&r.auditImages.some(x=>x&&x.trace===e.trace&&x.status==='pending')}
module.exports={imagesOf,MAX_IMAGES,validate,content,visible,project,plazaFields,callbackAllowed};
