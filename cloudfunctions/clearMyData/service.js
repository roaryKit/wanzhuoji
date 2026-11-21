const Threads=require('./threads');
const crypto=require('node:crypto'),V=require('./domain'),C=require('./constants'),config=require('./config.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const uid=o=>'u'+hash(o),wid=(o,n)=>'w'+hash(o+'\0'+n),rid=()=>crypto.randomUUID();
const fail=s=>{throw Error(s)};
function create(cloud){cloud.init({env:config.envId});const db=cloud.database({throwOnNotFound:false});
// 只缓存已授权文件的签名链接，不缓存审核/隐私判断。每次仍先读取当前用户与记录状态。
// 最多256项、60秒短缓存，签名有效期至少300秒；不把用户资料写入缓存。
const rt=require('./roundtable').create({db,cloud,get,locked,user,profiles,textPass,deadline});
const linkCache=new Map();
async function tempLinks(fileList,force=false){const out=[],miss=[],now=Date.now();for(const entry of fileList){const fileID=typeof entry==='string'?entry:entry.fileID,c=force?null:linkCache.get(fileID);if(c&&c.until>now)out.push({fileID,tempFileURL:c.url});else{linkCache.delete(fileID);miss.push(typeof entry==='string'?{fileID,maxAge:300}:entry)}}
if(miss.length){const r=await cloud.getTempFileURL({fileList:miss});for(const f of r.fileList||[]){out.push(f);if(f.tempFileURL){linkCache.set(f.fileID,{url:f.tempFileURL,until:now+60000});while(linkCache.size>256)linkCache.delete(linkCache.keys().next().value)}}}return {fileList:out}}

async function get(coll,id,source=db){const r=await source.collection(coll).doc(id).get();return r.data||null}
function identity(){const c=cloud.getWXContext();if(!c.OPENID||c.APPID!=='YOUR_WECHAT_APPID')fail('无法确认微信身份');return c.OPENID}
async function locked(o,fn,allow=false){return db.runTransaction(async tx=>{const u=await get('users',uid(o),tx);if(!u||!u.ageConfirmed)fail('请先确认已年满18岁');if(u.deleting&&!allow)fail('数据清理中，请继续清除数据');const result=await fn(tx,u);await tx.collection('users').doc(u._id).update({data:{revision:(u.revision||0)+1}});return result})}
async function user(o){const u=await get('users',uid(o));if(!u?.ageConfirmed)fail('请先确认已年满18岁');if(u.deleting)fail('数据清理中，请继续清除数据');return u}
function userView(u,o){return {user:{theme:u.theme,defaultPrivacy:u.defaultPrivacy,reminderOn:u.reminderOn,ageConfirmed:u.ageConfirmed,ageDenied:!!u.ageDenied,customTags:u.customTags,customPlaces:u.customPlaces},uploadPath:'images/'+hash(o)+'/'}}
async function initUser(e,o){if(e.action==='profile')return profile(e,o)
// 常规恢复会话仅需读，不必每次开启写事务。创建与设置操作继续使用事务。
if(!e.action){const u=await get('users',uid(o));if(u)return withProfile(userView(u,o),o,u)}
return withProfile(await initUserTx(e,o),o)}
async function initUserTx(e,o){const id=uid(o);return db.runTransaction(async tx=>{let u=await get('users',id,tx);if(!u){u={_id:id,_openid:o,theme:'system',defaultPrivacy:'private',reminderOn:true,ageConfirmed:false,customTags:[],customPlaces:[],uploads:[],revision:0};await tx.collection('users').doc(id).set({data:withoutId(u)})}if(e.action==='denyAge'){u.ageDenied=true;u.ageConfirmed=false;await tx.collection('users').doc(id).update({data:{ageDenied:true,ageConfirmed:false}})}if(e.action==='confirmAge'){if(u.ageDenied)fail('本小程序仅供18岁以上成年人使用');if(e.confirm!==true)fail('请确认年龄');u.ageConfirmed=true;await tx.collection('users').doc(id).update({data:{ageConfirmed:true}})}if(e.action==='settings'){if(!u.ageConfirmed||u.deleting)fail('请先确认年龄或完成数据清理');const p={};if(e.theme!==undefined){if(!['system','dark','light'].includes(e.theme))fail('主题无效');p.theme=e.theme}if(e.defaultPrivacy!==undefined){if(!['private','public'].includes(e.defaultPrivacy))fail('隐私无效');p.defaultPrivacy=e.defaultPrivacy}if(e.reminderOn!==undefined){if(typeof e.reminderOn!=='boolean')fail('提醒无效');p.reminderOn=e.reminderOn}for(const k of ['customTags','customPlaces'])if(e[k]!==undefined){if(!Array.isArray(e[k])||e[k].length>50)fail('自定义数量过多');p[k]=[...new Set(e[k].map(v=>{if(typeof v!=='string'||!v.trim()||[...v].length>(k==='customPlaces'?10:20))fail('自定义内容无效');return v.trim()}))]}await tx.collection('users').doc(id).update({data:p});Object.assign(u,p)}return {user:{theme:u.theme,defaultPrivacy:u.defaultPrivacy,reminderOn:u.reminderOn,ageConfirmed:u.ageConfirmed,ageDenied:!!u.ageDenied,customTags:u.customTags,customPlaces:u.customPlaces},uploadPath:'images/'+hash(o)+'/'}})}
function withoutId(r){const {_id,...d}=r;return d}
function page(e,size){if(!Number.isInteger(e.page??0)||(e.page??0)<0||(e.page??0)>10000)fail('分页参数无效');return (e.page||0)*size}
async function audit(r,o){if(r.privacy==='private')return {auditStatus:'none',auditReason:'',auditImages:[]};const s=V.content(r);if(C.keywords.some(k=>s.includes(k)))return {auditStatus:'reject',auditReason:'内容包含不适宜公开的表述'};try{let a;try{a=await deadline(cloud.openapi.security.msgSecCheck({content:s,version:2,scene:4,openid:o}))}catch(err){if(Number(err?.errCode??err?.errcode)===87014)return {auditStatus:'reject',auditReason:'内容未通过安全审核'};throw err}if((a.errCode??a.errcode)!==0||a.result?.suggest!=='pass')return {auditStatus:'reject',auditReason:'内容未通过安全审核'};if(!r.images.length)return {auditStatus:'pass',auditReason:'',auditImages:[]};const urls=await cloud.getTempFileURL({fileList:r.images.map(fileID=>({fileID,maxAge:3600}))});const auditImages=[];for(const fileID of r.images){const mediaUrl=(urls.fileList||[]).find(f=>f.fileID===fileID)?.tempFileURL;if(!mediaUrl)throw Error('图片读取失败');const b=await deadline(cloud.openapi.security.mediaCheckAsync({mediaUrl,mediaType:2,version:2,scene:4,openid:o}));const trace=b.traceId||b.trace_id;if(!trace||(b.errCode??b.errcode)!==0)throw Error('审核提交失败');auditImages.push({fileID,trace,status:'pending'})}return {auditStatus:'pending',auditReason:'图片审核中',auditImages}}catch(_){return {auditStatus:'pending',auditReason:'审核服务暂不可用，请稍后重新提交',auditImages:[]}}}
async function imageUrls(rows){rows=rows.map(r=>({...r,images:V.imagesOf(r)}));const files=[...new Set(rows.flatMap(r=>r.images))];if(!files.length)return rows.map(r=>({...r,imageURLs:[],imageURL:''}));const urls=await tempLinks(files.map(fileID=>({fileID,maxAge:300})));const map=new Map((urls.fileList||[]).filter(f=>f.tempFileURL).map(f=>[f.fileID,f.tempFileURL]));return rows.map(r=>{const imageURLs=r.images.map(f=>map.get(f)||'');return {...r,imageURLs,imageURL:imageURLs[0]||''}})}
// 仅统计本月，读取窄字段且不签发照片链接；与首屏列表并行。旧客户端仍可按 page 读取。
async function ownStats(o){const now=new Date(),ym=new Date(+now+8*3600e3).toISOString().slice(0,7),from=new Date(ym+'-01T00:00:00+08:00'),rows=[]
for(let p=0;;p++){const batch=(await db.collection('records').where({_openid:o,createdAt:db.command.gte(from)}).orderBy('createdAt','desc').skip(p*100).limit(100).field({createdAt:true,moodTags:true,isSolo:true,category:true}).get()).data;rows.push(...batch);if(batch.length<100)break}
const monthRows=rows.filter(r=>new Date(+new Date(r.createdAt)+8*3600e3).toISOString().slice(0,7)===ym),key=x=>new Date(+new Date(x)+8*3600e3).toISOString().slice(0,10),tags=new Map(),cats=new Map()
const top=(map)=>[...map].sort((a,b)=>b[1].n-a[1].n||b[1].last-a[1].last||a[0].localeCompare(b[0]))[0]?.[0]||'—'
for(const r of monthRows){for(const [map,values] of [[tags,[...new Set(r.moodTags||[])]],[cats,[r.category]]])for(const v of values.filter(Boolean)){const t=map.get(v)||{n:0,last:0};t.n++;t.last=Math.max(t.last,+new Date(r.createdAt));map.set(v,t)}}
return {count:monthRows.length,nights:new Set(monthRows.filter(x=>x.isSolo).map(x=>key(x.createdAt))).size,tag:top(tags),category:top(cats)}}
async function submitRecord(e,o){const action=e.action||'save';if(action==='list'){await user(o);const query={_openid:o};let skip=page(e,15)
if(e.before!==undefined&&e.before!==null){if(!Number.isFinite(e.before)||e.before<=0)fail('分页参数无效');query.createdAt=db.command.lt(new Date(e.before));skip=0}
const rowsTask=(async()=>{const rows=(await db.collection('records').where(query).orderBy('createdAt','desc').skip(skip).limit(15).get()).data;return {rows:await imageUrls(rows),next:rows.length===15?+new Date(rows[rows.length-1].createdAt):null}})()
if(e.summary===true){const [r,stats]=await Promise.all([rowsTask,ownStats(o)]);return {...r,stats:{...stats,latest:r.rows.length?new Date(+new Date(r.rows[0].createdAt)+8*3600e3).toISOString().slice(0,10):'—'}}}
return rowsTask}
if(action==='get'){await user(o);const r=await get('records',String(e.id));if(!r||r._openid!==o)fail('记录不存在');return {record:(await imageUrls([r]))[0]}}
if(action==='wines'){await user(o);const rowsTask=db.collection('wines').where({_openid:o}).orderBy('createdAt','desc').skip(page(e,15)).limit(15).get();
// 只在第一页显式请求统计：服务端窄字段聚合，不向客户端下载全部酌记/图片签名。
const countsTask=e.summary===true&&(e.page||0)===0?(async()=>{const counts=new Map();for(let p=0;;p++){const batch=(await db.collection('records').where({_openid:o}).orderBy('createdAt','desc').skip(p*100).limit(100).field({wineName:true}).get()).data;for(const r of batch)if(typeof r.wineName==='string')counts.set(r.wineName,(counts.get(r.wineName)||0)+1);if(batch.length<100)break}return [...counts].map(([name,count])=>({name,count}))})():null;
const [result,counts]=await Promise.all([rowsTask,countsTask]);return {rows:result.data,...(counts?{counts}:{})}}
if(action==='wineUpdate')return locked(o,async tx=>{const w=await get('wines',String(e.id),tx);if(!w||w._openid!==o)fail('酒款不存在');if(!Number.isInteger(e.rating)||e.rating<0||e.rating>5||typeof e.note!=='string'||[...e.note].length>200)fail('评分或笔记无效');await tx.collection('wines').doc(w._id).update({data:{rating:e.rating,note:e.note}});return {ok:true}});
if(action==='upload'){await user(o);const fileID=typeof e.fileID==='string'?e.fileID:'';const m=/^cloud:\/\/([^/]+)\/(.+)$/.exec(fileID);const prefix='images/'+hash(o)+'/';if(fileID.length>1024||!m||(m[1]!==config.envId&&!m[1].startsWith(config.envId+'.'))||!m[2].startsWith(prefix)||!/^[A-Za-z0-9_-]{8,64}\.jpg$/.test(m[2].slice(prefix.length)))fail('图片路径无效，请重新选择');const drop=async()=>{try{await cloud.deleteFile({fileList:[fileID]})}catch(_){}};let buf;try{buf=(await cloud.downloadFile({fileID})).fileContent}catch(_){fail('图片上传未完成，请重新选择')}if(!Buffer.isBuffer(buf)||buf.length>2*1024*1024||buf.length<3||buf[0]!==0xff||buf[1]!==0xd8||buf[2]!==0xff){await drop();fail(Buffer.isBuffer(buf)&&buf.length>2*1024*1024?'图片必须小于2MB':'仅支持压缩后的JPEG图片')}try{await locked(o,async(tx,u)=>{if(u.uploads.includes(fileID))return;if(u.uploads.length>=1000)fail('图片数量过多，请先清理');await tx.collection('users').doc(u._id).update({data:{uploads:[...u.uploads,fileID]}})})}catch(err){await drop();throw err}const urls=await cloud.getTempFileURL({fileList:[{fileID,maxAge:300}]});return {fileID,imageURL:urls.fileList[0]?.tempFileURL||''}}
if(action==='delete')return locked(o,async tx=>{const r=await get('records',String(e.id),tx);if(!r||r._openid!==o)fail('记录不存在');await tx.collection('records').doc(r._id).remove();return {ok:true}});
if(action!=='save')fail('操作无效');const r=V.validate(e.record||{});const u=await user(o);const own='/images/'+hash(o)+'/';if(r.images.some(f=>!u.uploads.includes(f)||!f.includes(own)))fail('图片不属于当前用户');const id=e.id?String(e.id):rid();const before=e.id?await get('records',id):null;if(e.id&&(!before||before._openid!==o))fail('记录不存在');const a=await audit(r,o);return locked(o,async(tx,current)=>{const old=await get('records',id,tx);if(e.id&&(!old||old._openid!==o))fail('记录已删除');if(old&&(old.auditVersion||0)!==(before.auditVersion||0))fail('记录已变更，请重新打开');if(r.images.some(f=>!current.uploads.includes(f)))fail('图片无效');const hold=old?.reportHold||false;const data={...r,...a,_openid:o,reportHold:hold,reportCount:old?.reportCount||0,commentThreadVersion:old?.commentThreadVersion||0,likeCount:old?.likeCount||0,commentCount:old?.commentCount||0,auditImages:a.auditImages||[],auditTraceIds:(a.auditImages||[]).map(x=>x.trace),auditTrace:'',auditResolvedTrace:'',auditApiVersion:2,auditOwner:o,auditVersion:(old?.auditVersion||0)+1,createdAt:old?.createdAt||db.serverDate(),updatedAt:db.serverDate()};if(hold&&r.privacy==='public'){data.auditStatus='pending';data.auditReason='收到举报，暂不公开'}await tx.collection('records').doc(id).set({data});const w=wid(o,r.wineName);if(!await get('wines',w,tx))await tx.collection('wines').doc(w).set({data:{_openid:o,name:r.wineName,category:r.category,rating:0,note:'',createdAt:db.serverDate()}});return {id,auditStatus:data.auditStatus,auditReason:data.auditReason,selfHarm:C.selfHarm.some(k=>V.content(r).includes(k))}})}
async function getPlaza(e,o){if(e.action&&e.action!=='list'){const fn=socialActions[e.action];if(!fn)fail('操作无效');return fn(e,o)}await user(o);const query={privacy:'public',auditStatus:'pass',isSolo:true,reportHold:false};if(e.tag){if(!C.tags.includes(e.tag))fail('标签无效');query.moodTags=e.tag}// 游标分页：before=上一页最后一条的 createdAt（毫秒）。比 skip 稳定（新发布不会造成重复/漏条），也不随页数变慢；page 仅为兼容旧客户端。
let skip=0;if(e.before!==undefined&&e.before!==null){if(!Number.isFinite(e.before)||e.before<=0)fail('分页参数无效');query.createdAt=db.command.lt(new Date(e.before))}else skip=page(e,10)
const rows=(await db.collection('records').where(query).orderBy('createdAt','desc').skip(skip).limit(10).get()).data,vis=rows.filter(V.visible),ids=vis.map(r=>r._id)
// 图片临时链接、本页点赞状态（一次查询）、作者资料三者并行读取。
const [safe,likedRows,P]=await Promise.all([imageUrls(vis),ids.length?db.collection('likes').where({_openid:o,recordId:db.command.in(ids)}).limit(ids.length).get().then(r=>r.data):[],profiles(vis.map(r=>r._openid),o)])
const liked=new Set(likedRows.map(x=>x.recordId)),last=rows[rows.length-1]
return {rows:safe.map(r=>({...V.project({...r,image:r.imageURL||'',images:r.imageURLs.filter(Boolean)}),liked:liked.has(r._id),author:authorOf(r,P)})),next:rows.length===10&&last&&last.createdAt?new Date(last.createdAt).getTime():null}}
async function reportRecord(e,o){await user(o);if(!['内容不适宜','劝酒或酗酒','其他'].includes(e.reason))fail('请选择举报原因');return db.runTransaction(async tx=>{const u=await get('users',uid(o),tx);if(!u?.ageConfirmed||u.deleting)fail('请先确认年龄');const r=await get('records',String(e.recordId),tx);if(!r||r.privacy!=='public'||!r.isSolo||!['pass','pending'].includes(r.auditStatus))fail('记录不可举报');const id='p'+hash(o+'\0'+r._id);if(await get('reports',id,tx))return {ok:true,duplicate:true};await tx.collection('reports').doc(id).set({data:{recordId:r._id,reporterOpenid:o,_openid:o,reason:e.reason,createdAt:db.serverDate()}});const count=(r.reportCount||0)+1;const data={reportCount:count};if(count>=3)Object.assign(data,{reportHold:true,auditStatus:'pending',auditReason:'收到举报，暂不公开'});await tx.collection('records').doc(r._id).update({data});await tx.collection('users').doc(u._id).update({data:{revision:(u.revision||0)+1}});return {ok:true}})}
async function clearMyData(e,o){const id=uid(o);const existing=await get('users',id);if(!existing)return {done:true};await locked(o,async tx=>{await tx.collection('users').doc(id).update({data:{deleting:true}})},true);if(!await rt.cleanup(o))return {done:false};let u=await get('users',id);const files=u.uploads.slice(0,50);if(files.length){const res=await cloud.deleteFile({fileList:files});const succeeded=files.filter(id=>(res.fileList||[]).filter(f=>f.fileID===id).length===1&&(res.fileList||[]).find(f=>f.fileID===id).status===0);if(succeeded.length)await db.runTransaction(async tx=>{const latest=await get('users',id,tx);if(latest)await tx.collection('users').doc(id).update({data:{uploads:latest.uploads.filter(f=>!succeeded.includes(f))}})});if(succeeded.length!==files.length)fail('部分图片删除失败，请重试清除');return {done:false}}
for(const collection of ['comments','likes','records','wines']){const rows=(await db.collection(collection).where({_openid:o}).limit(50).get()).data;if(rows.length){for(const row of rows){if(collection==='comments'||collection==='likes'){await db.runTransaction(async tx=>{const cur=await get(collection,row._id,tx);if(!cur)return;const rec=await get('records',cur.recordId,tx),field=collection==='likes'?'likeCount':'commentCount';if(rec&&(collection==='likes'||cur.status==='pass'))await tx.collection('records').doc(rec._id).update({data:{[field]:Math.max(0,(rec[field]||0)-1)}});await tx.collection(collection).doc(cur._id).remove()})}else await db.collection(collection).doc(row._id).remove()}return {done:false}}}await db.collection('users').doc(id).remove();return {done:true}}
async function mediaCheckCallback(e){
// HTTP shape is not authentication. Only authenticated ciphertext reaches this writer.
if(cloud.getWXContext().OPENID)throw Error('拒绝客户端回调');
const verified=require('./callback').verify(e,process.env,config);
if(verified.echo!==undefined)return verified.echo;
const m=verified.message;
let candidates=(await db.collection('records').where({auditTraceIds:m.trace_id}).limit(2).get()).data;
if(!candidates.length){
 // 旧版单图记录：auditTrace 单字段，迁移为 auditImages 结构后再走同一套校验。
 candidates=(await db.collection('records').where({auditTrace:m.trace_id}).limit(2).get()).data;
}
if(!candidates.length){const us=(await db.collection('users').where({avatarTrace:m.trace_id}).limit(2).get()).data
if(us.length===1){await avatarCallback(us[0],m)
return 'success'}}
if(candidates.length!==1)throw Error('审核关联暂不可用');
const candidate=candidates[0];
await db.runTransaction(async tx=>{
 const r=await get('records',candidate._id,tx);
 if(!r||r._openid!==candidate._openid||r.auditVersion!==candidate.auditVersion)return;
 const images=V.imagesOf(r);
 let entries=Array.isArray(r.auditImages)&&r.auditImages.length?r.auditImages:(r.auditTrace?[{fileID:r.image,trace:r.auditTrace,status:r.auditResolvedTrace===r.auditTrace?'done':'pending'}]:[]);
 const entry=entries.find(x=>x&&x.trace===m.trace_id);
 if(!entry||entry.status!=='pending'||!entry.fileID||!images.includes(entry.fileID))return;
 const u=await get('users',uid(r._openid),tx);
 if(!u?.ageConfirmed||u.deleting||!images.every(f=>u.uploads.includes(f)))return;
 if(!r.isSolo||!V.callbackAllowed({...r,auditImages:entries},{version:candidate.auditVersion,trace:m.trace_id}))return;
 if(r.auditApiVersion!==m.version||!r.auditOwner||r.auditOwner!==r._openid)return;
 const pass=m.errcode===0&&m.result?.suggest==='pass';
 entries=entries.map(x=>x.trace===m.trace_id?{...x,status:pass?'pass':'reject'}:x);
 const all=images.every(f=>entries.some(x=>x.fileID===f&&x.status==='pass'));
 const status=!pass?'reject':all?'pass':'pending';
 await tx.collection('records').doc(r._id).update({data:{auditImages:entries,auditTraceIds:entries.map(x=>x.trace),auditStatus:status,auditReason:status==='reject'?'图片未通过安全审核':status==='pass'?'':'图片审核中',auditResolvedTrace:m.trace_id,updatedAt:db.serverDate()}});
});return 'success';}

// ---- 社交：点赞 / 评论（仅公开且审核通过的记录；客户端不直写集合，全部经云函数） ----
const COMMENT_MAX=200,COMMENT_GAP=10000,COMMENT_DAY=30,COMMENT_PAGE=20
const likeId=(o,r)=>'l'+hash(o+'\0'+r)
async function visibleRecord(id,source=db){const r=await get('records',String(id||''),source)
if(!r||!V.visible(r))fail('这条记录暂不可查看')
return r}
function handle(c,r,o,P){const p=P&&P.get(c._openid)
if(p&&p.nick)return p.nick
if(c._openid===o)return '我'
if(c._openid===r._openid)return '作者'
return stranger(c._openid,r._id)}
function commentView(c,r,o,P,parent){const mine=c._openid===o
return {id:c._id,text:c.text,threadId:c.threadId||c._id,threadAt:c.threadAt||c.createdAt,replyTo:c.replyTo||'',replyHandle:c.replyTo?(parent?handle(parent,r,o,P):'原评论已删除'):'',replyDeleted:!!c.replyTo&&!parent,handle:handle(c,r,o,P),avatar:(P&&P.get(c._openid)||{}).avatar||'',mine,byAuthor:c._openid===r._openid,pending:c.status!=='pass',canDelete:mine||r._openid===o,createdAt:c.createdAt}}
async function textPass(s,o,scene=2){if(C.keywords.some(k=>s.includes(k)))return 'reject'
try{const a=await deadline(cloud.openapi.security.msgSecCheck({content:s,version:2,scene,openid:o}))
return (a.errCode??a.errcode)===0&&a.result?.suggest==='pass'?'pass':'reject'}catch(err){return Number(err?.errCode??err?.errcode)===87014?'reject':'pending'}}
async function social(r,o){const liked=!!await get('likes',likeId(o,r._id))
return {likeCount:Math.max(0,r.likeCount||0),commentCount:Math.max(0,r.commentCount||0),liked}}
// 旧评论仅添加线程排序字段，不改变正文、审核、计数或归属；部署时预迁移，读取兜底。
async function threadAncestors(c,source=db){let cur=c,seen=new Set();while(cur.replyTo&&!cur.threadId){if(seen.has(cur._id))break;seen.add(cur._id);const p=await get('comments',cur.replyTo,source);if(!p||p.recordId!==c.recordId)return {threadId:cur.replyTo,threadAt:cur.createdAt};cur=p;if(seen.size>256)fail('评论层级异常')}return {threadId:cur.threadId||cur._id,threadAt:cur.threadAt||cur.createdAt}}
async function migrateThreads(r){if(r.commentThreadVersion===1)return;let all=[];for(let n=0;;n+=100){const batch=(await db.collection('comments').where({recordId:r._id}).orderBy('_id','asc').skip(n).limit(100).get()).data;all.push(...batch);if(batch.length<100)break}const M=Threads.metadata(all);for(let n=0;n<all.length;n+=10)await Promise.all(all.slice(n,n+10).filter(c=>!c.threadSort).map(c=>db.collection('comments').doc(c._id).update({data:M.get(c._id)})));await db.collection('records').doc(r._id).update({data:{commentThreadVersion:1}})}
async function threadedRows(r,o,e){await migrateThreads(r);const mine=await pendingComments(r,o),q={recordId:r._id,status:'pass'};if(e.afterThread!==undefined&&e.afterThread!==null){if(typeof e.afterThread!=='string'||!e.afterThread||e.afterThread.length>1024)fail('分页参数无效');q.threadSort=db.command.gt(e.afterThread)}const rows=(await db.collection('comments').where(q).orderBy('threadSort','asc').limit(COMMENT_PAGE).get()).data;return {rows:await commentViews([...rows,...(e.afterThread?[]:mine)],r,o),next:rows.length===COMMENT_PAGE?rows[rows.length-1].threadSort:null}}
// 同页作者与回复对象批量读取；不保存昵称快照，始终沿用最新审核/匿名规则。
async function commentViews(rows,r,o){const ids=[...new Set(rows.map(c=>c.replyTo).filter(Boolean))],parents=ids.length?(await db.collection('comments').where({_id:db.command.in(ids)}).limit(ids.length).get()).data:[]
const valid=parents.filter(p=>p.recordId===r._id&&p.status==='pass'),byId=new Map(valid.map(p=>[p._id,p])),P=await profiles([...rows,...valid].map(c=>c._openid),o)
return rows.map(c=>commentView(c,r,o,P,byId.get(c.replyTo)))}
function commentCursor(v){if(!v||typeof v!=='object'||!Number.isFinite(v.time)||v.time<=0||typeof v.id!=='string'||!v.id||v.id.length>128)fail('分页参数无效');return {time:v.time,id:v.id}}
async function pendingComments(r,o){let mine=(await db.collection('comments').where({recordId:r._id,_openid:o,status:'pending'}).limit(5).get()).data
// 重审先完成再取有序页面，避免把新通过的评论塞到错误页导致重复/漏项。
for(const c of mine){const s=await textPass(c.text,o);if(s==='pending')continue
await db.runTransaction(async tx=>{const cur=await get('comments',c._id,tx);if(!cur||cur.status!=='pending')return
if(s==='reject'){await tx.collection('comments').doc(c._id).remove();return}
const rec=await get('records',r._id,tx);await tx.collection('comments').doc(c._id).update({data:{status:'pass'}})
if(rec)await tx.collection('records').doc(r._id).update({data:{commentCount:(rec.commentCount||0)+1}})})
c.status=s==='reject'?'gone':'pass'}
mine=mine.filter(c=>c.status==='pending')
return mine}
async function commentRows(r,o,p=0,after=null){if(after!==null&&after!==undefined)after=commentCursor(after)
const mine=p||after?[]:await pendingComments(r,o)
const _=db.command,base={recordId:r._id,status:'pass'},query=after?_.and([base,_.or([{createdAt:_.gt(new Date(after.time))},{createdAt:new Date(after.time),_id:_.gt(after.id)}])]):base
const rows=(await db.collection('comments').where(query).orderBy('createdAt','asc').orderBy('_id','asc').skip(after?0:p*COMMENT_PAGE).limit(COMMENT_PAGE).get()).data,last=rows[rows.length-1]
return {rows:await commentViews([...rows,...mine],r,o),next:rows.length===COMMENT_PAGE?{time:+new Date(last.createdAt),id:last._id}:null}}
async function plazaRecord(e,o){const r=await visibleRecord(e.id)
const [[row],rows,P]=await Promise.all([imageUrls([r]),(e.threaded?threadedRows(r,o,e):commentRows(r,o)),profiles([r._openid],o)])
return {record:{...V.project({...row,image:row.imageURL||'',images:row.imageURLs.filter(Boolean)}),category:r.category||'',mine:r._openid===o,author:authorOf(r,P)},...await social(await get('records',r._id)||r,o),comments:rows.rows,nextComments:rows.next,threaded:!!e.threaded}}
async function comments(e,o){const r=await get('records',String(e.id||''))
if(!r||!V.visible(r))fail('这条记录暂不可查看')
const p=e.page??0
if(!Number.isInteger(p)||p<0||p>500)fail('分页参数无效')
const rows=await (e.threaded?threadedRows(r,o,e):commentRows(r,o,p,e.after));return {...await social(await get('records',r._id)||r,o),comments:rows.rows,nextComments:rows.next,threaded:!!e.threaded}}
async function like(e,o){if(typeof e.on!=='boolean')fail('操作无效')
return locked(o,async tx=>{const r=await visibleRecord(e.id,tx)
const id=likeId(o,r._id),had=!!await get('likes',id,tx)
let count=Math.max(0,r.likeCount||0)
if(e.on&&!had){await tx.collection('likes').doc(id).set({data:{_openid:o,recordId:r._id,createdAt:db.serverDate()}})
count++}if(!e.on&&had){await tx.collection('likes').doc(id).remove()
count=Math.max(0,count-1)}if(count!==(r.likeCount||0))await tx.collection('records').doc(r._id).update({data:{likeCount:count}})
return {liked:e.on,likeCount:count}})}
function recent(u,now){return (Array.isArray(u.commentTimes)?u.commentTimes:[]).filter(t=>typeof t==='number'&&t>now-86400000)}
async function replyTarget(id,recordId,source=db){const p=await get('comments',id,source);if(!p||p.recordId!==recordId||p.status!=='pass')fail('原评论不可回复，请刷新后重试');return p}
async function comment(e,o){const s=typeof e.text==='string'?e.text.trim():''
if(!s)fail('写点什么再发送吧')
if([...s].length>COMMENT_MAX)fail('评论最多200字')
const replyTo=e.replyTo===undefined||e.replyTo===null||e.replyTo===''?'':e.replyTo
if(typeof replyTo!=='string'||replyTo.length>128)fail('回复对象无效')
const u=await user(o),now=Date.now(),times=recent(u,now)
if(times.length&&now-Math.max(...times)<COMMENT_GAP)fail('发得有点快，稍等一下')
if(times.length>=COMMENT_DAY)fail('今天的评论有点多了，明天再聊')
await visibleRecord(e.id)
if(replyTo)await replyTarget(replyTo,e.id)
const status=await textPass(s,o)
if(status==='reject')return {status:'reject'}
return locked(o,async(tx,cur)=>{const at=Date.now(),list=recent(cur,at)
if(list.length&&at-Math.max(...list)<COMMENT_GAP)fail('发得有点快，稍等一下')
if(list.length>=COMMENT_DAY)fail('今天的评论有点多了，明天再聊')
const r=await visibleRecord(e.id,tx)
if(replyTo)await replyTarget(replyTo,r._id,tx)
const id=rid(),c={_openid:o,recordId:r._id,text:s,status,createdAt:new Date(at)};if(replyTo){c.replyTo=replyTo;const parent=await replyTarget(replyTo,r._id,tx);if(parent.threadId){c.threadId=parent.threadId;c.threadAt=parent.threadAt}else{const roots=await threadAncestors(parent,tx);c.threadId=roots.threadId;c.threadAt=roots.threadAt}}else{c.threadId=id;c.threadAt=c.createdAt}c.threadSort=Threads.key({...c,_id:id})
await tx.collection('comments').doc(id).set({data:c})
if(status==='pass')await tx.collection('records').doc(r._id).update({data:{commentCount:(r.commentCount||0)+1}})
await tx.collection('users').doc(cur._id).update({data:{commentTimes:[...list,at].slice(-COMMENT_DAY)}})
return {status,comment:{id,c,r}}})
.then(async x=>x.comment?{status:x.status,comment:(await commentViews([{...x.comment.c,_id:x.comment.id,createdAt:new Date()}],x.comment.r,o))[0]}:x)}
async function deleteComment(e,o){return locked(o,async tx=>{const c=await get('comments',String(e.commentId||''),tx)
if(!c)return {ok:true}
const r=await get('records',c.recordId,tx)
if(c._openid!==o&&(!r||r._openid!==o))fail('只能删除自己的评论')
await tx.collection('comments').doc(c._id).remove()
if(r&&c.status==='pass')await tx.collection('records').doc(r._id).update({data:{commentCount:Math.max(0,(r.commentCount||0)-1)}})
return {ok:true}})}
// ---- 个人资料：头像（云存储直传 + 图片审核回调）与昵称（文字审核）；他人只看到审核通过的资料 ----
const AVATAR_MAX=2*1024*1024
function stranger(x,r){return '陌生人 '+hash(x+'\0'+r).slice(0,4).toUpperCase()}
async function profiles(openids,o,opt={}){const ids=[...new Set(openids.filter(Boolean))]
const found=ids.length?(await db.collection('users').where({_id:db.command.in(ids.map(uid))}).limit(ids.length).get()).data:[],byId=new Map(found.map(u=>[u._id,u])),us=ids.map(x=>byId.get(uid(x))||null)
// 匿名对所有人生效（含本人），本人可提前看到自己待审核的头像/昵称。
const vis=ids.map((x,i)=>{const u=us[i],self=x===o
if(!u||u.anonymous||u.deleting)return null
return {nicknameState:u.nicknameStatus||'none',avatarState:u.avatarStatus||'none',nick:u.nickname&&(u.nicknameStatus==='pass'||self)?u.nickname:'',file:u.avatar&&(u.avatarStatus==='pass'||self&&u.avatarStatus==='pending')?u.avatar:''}})
const files=[...new Set(vis.filter(v=>v&&v.file).map(v=>v.file))]
let map=new Map()
if(files.length){try{const r=await tempLinks(files.map(fileID=>({fileID,maxAge:3600})),opt.fresh===true)
map=new Map((r.fileList||[]).filter(f=>f.tempFileURL).map(f=>[f.fileID,f.tempFileURL]))}catch(_){}}
return new Map(ids.map((x,i)=>[x,vis[i]?{nick:vis[i].nick,avatar:map.get(vis[i].file)||'',nicknameState:vis[i].nicknameState,avatarState:vis[i].file?(map.has(vis[i].file)?vis[i].avatarState:'unavailable'):vis[i].avatarState}:{nick:'',avatar:'',nicknameState:'none',avatarState:'anonymous'}]))}
function authorOf(r,P){const p=P.get(r._openid)||{}
return {name:p.nick||stranger(r._openid,r._id),avatar:p.avatar||'',avatarState:p.avatarState||'none'}}
async function profileOf(o,existing){const u=existing||await get('users',uid(o))
if(!u)return null
let avatarURL=''
if(u.avatar&&u.avatarStatus!=='reject'){try{const r=await tempLinks([{fileID:u.avatar,maxAge:3600}])
avatarURL=r.fileList?.[0]?.tempFileURL||''}catch(_){}}
return {nickname:u.nickname||'',nicknamePending:u.nicknameStatus==='pending',avatarURL,avatarStatus:u.avatar?u.avatarStatus||'pending':'none',anonymous:!!u.anonymous,prompted:!!u.profilePrompted,hasProfile:!!(u.nickname||u.avatar)}}
async function withProfile(res,o,existing){if(!res||!res.user||!res.user.ageConfirmed)return res
let u=existing||await get('users',uid(o))
if(u&&u.nicknameStatus==='pending'&&u.nickname&&!u.deleting){const s=await textPass(u.nickname,o,1)
if(s!=='pending'){const patch=s==='pass'?{nicknameStatus:'pass'}:{nickname:'',nicknameStatus:'none'};await db.collection('users').doc(u._id).update({data:patch});u={...u,...patch}}}
return {...res,user:{...res.user,profile:await profileOf(o,u)},avatarPath:'avatars/'+hash(o)+'/'}}
async function profile(e,o){const u=await user(o),patch={}
if(e.anonymous!==undefined){if(typeof e.anonymous!=='boolean')fail('设置无效')
patch.anonymous=e.anonymous}if(e.prompted===true)patch.profilePrompted=true
if(e.nickname!==undefined){const n=typeof e.nickname==='string'?e.nickname.trim():''
if([...n].length<1||[...n].length>16)fail('昵称需为1到16个字')
if(/[\u0000-\u001f\u007f]/.test(n))fail('昵称包含无效字符')
const s=await textPass(n,o,1)
if(s==='reject')fail('昵称未通过审核，换一个试试')
Object.assign(patch,{nickname:n,nicknameStatus:s,profilePrompted:true})}
if(e.avatar!==undefined){const fileID=typeof e.avatar==='string'?e.avatar:''
const m=/^cloud:\/\/([^/]+)\/(.+)$/.exec(fileID),prefix='avatars/'+hash(o)+'/'
if(fileID.length>1024||!m||(m[1]!==config.envId&&!m[1].startsWith(config.envId+'.'))||!m[2].startsWith(prefix)||!/^[A-Za-z0-9_-]{8,64}\.(jpg|png)$/.test(m[2].slice(prefix.length)))fail('头像路径无效，请重新选择')
const drop=async()=>{try{await cloud.deleteFile({fileList:[fileID]})}catch(_){}}
let buf
try{buf=(await cloud.downloadFile({fileID})).fileContent}catch(_){fail('头像上传未完成，请重新选择')}
const jpg=Buffer.isBuffer(buf)&&buf.length>3&&buf[0]===0xff&&buf[1]===0xd8&&buf[2]===0xff,png=Buffer.isBuffer(buf)&&buf.length>8&&buf[0]===0x89&&buf[1]===0x50&&buf[2]===0x4e&&buf[3]===0x47
if(!jpg&&!png||buf.length>AVATAR_MAX){await drop()
fail(Buffer.isBuffer(buf)&&buf.length>AVATAR_MAX?'头像必须小于2MB':'仅支持JPEG或PNG头像')}
let trace=''
try{const urls=await cloud.getTempFileURL({fileList:[{fileID,maxAge:3600}]})
const mediaUrl=urls.fileList?.[0]?.tempFileURL
const b=await deadline(cloud.openapi.security.mediaCheckAsync({mediaUrl,mediaType:2,version:2,scene:1,openid:o}))
trace=b.traceId||b.trace_id
if(!trace||(b.errCode??b.errcode)!==0)throw Error('x')}catch(_){await drop()
fail('头像审核暂不可用，请稍后再试')}
Object.assign(patch,{avatar:fileID,avatarStatus:'pending',avatarTrace:trace,profilePrompted:true})}
let old=''
await locked(o,async(tx,cur)=>{const p={...patch}
if(p.avatar){if(cur.uploads.length>=1000)fail('图片数量过多，请先清理')
old=cur.avatar&&cur.avatar!==p.avatar?cur.avatar:''
p.uploads=[...cur.uploads.filter(f=>f!==old&&f!==p.avatar),p.avatar]}
if(Object.keys(p).length)await tx.collection('users').doc(cur._id).update({data:p})})
if(old){try{await cloud.deleteFile({fileList:[old]})}catch(_){}}
return {profile:await profileOf(o)}}
async function avatarCallback(candidate,m){await db.runTransaction(async tx=>{const u=await get('users',candidate._id,tx)
if(!u||u.deleting||u.avatarTrace!==m.trace_id||u.avatarStatus!=='pending'||m.version!==2||!u.uploads?.includes(u.avatar))return
const pass=m.errcode===0&&m.result?.suggest==='pass'
await tx.collection('users').doc(u._id).update({data:{avatarStatus:pass?'pass':'reject'}})})}

const socialActions={record:plazaRecord,comments,like,comment,deleteComment}

const functions={roundtable:rt.handle,initUser,submitRecord,getPlaza,reportRecord,clearMyData,mediaCheckCallback};return async(name,event={})=>{try{if(config.envId!=='YOUR_CLOUDBASE_ENV_ID'||(cloud.getWXContext().ENV||process.env.TCB_ENV||process.env.SCF_NAMESPACE)!==config.envId)fail('拒绝非目标云环境执行');if(name==='mediaCheckCallback')return await mediaCheckCallback(event);return await functions[name](event,identity())}catch(e){return {error:e.message||'服务暂不可用'}}};}
function deadline(p,ms=8000){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('审核超时')),ms)})]).finally(()=>clearTimeout(timer))}
module.exports={create,hash,uid,wid,deadline};
