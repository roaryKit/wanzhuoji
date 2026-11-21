const config=require('./config'),C=require('./constants');
let pendingInit=null,epoch=0,scope='',session=0,reads=new Map(),revisions={};
// 只合并同一会话的并发只读请求，不持久化用户数据、不缓存审核/权限结果。
function version(area){return area?(revisions[area]||0):epoch}
function sessionKey(){return session+':'+scope}
function areas(name,d){if(name==='getPlaza')return ['plaza'];if(name==='roundtable')return ['roundtable'];if(name==='reportRecord')return ['home','plaza'];if(name==='submitRecord')return d.action==='wineUpdate'?['wines']:['home','plaza','wines'];if(name==='initUser')return d.action==='settings'?['settings']:['home','plaza','settings','roundtable'];return ['home','plaza','wines','settings','roundtable']}
function invalidate(changed=['home','plaza','wines','settings','roundtable']){epoch++;for(const a of changed)revisions[a]=(revisions[a]||0)+1;reads.clear()}
function reset(){session++;scope='';pendingInit=null;invalidate()}
function isRead(name,d){return name==='roundtable'&&['search','detail','requests','history','poll'].includes(d.action)||name==='getPlaza'&&(!d.action||['list','record','comments'].includes(d.action))||name==='submitRecord'&&['list','get','wines'].includes(d.action)}
function validUser(user){return !!user&&typeof user==='object'&&typeof user.ageConfirmed==='boolean'&&(user.ageDenied===undefined||typeof user.ageDenied==='boolean')}
const messages={DEPLOYMENT:'初始化服务尚未部署或函数名称不匹配，请联系管理员后重试。',CONFIG:'云环境配置或关联异常，请联系管理员后重试。',PERMISSION:'云服务访问被拒绝，请联系管理员检查权限后重试。',IDENTITY:'无法确认微信登录身份，请重新进入小程序后重试。',DATABASE:'初始化数据配置未完成，请联系管理员后重试。',RESPONSE:'初始化服务响应异常，请联系管理员后重试。',RUNTIME:'初始化服务运行异常，请稍后重试或联系管理员。',NETWORK:'连接超时或网络暂不可用，请稍后重试。',UNKNOWN:'暂时无法确认使用状态，请稍后重试或联系管理员。',TOO_LARGE:'提交的数据过大，请换一张图片或精简内容后重试。',UPLOAD:'图片上传失败，请检查网络后重新选择图片。',CALL:'云服务请求失败，请稍后重试。'};
// 业务云函数返回的纯中文提示（如“仅支持压缩后的JPEG图片”）可直接展示；含英文/标识符的内部错误仍归为通用文案，避免泄露。
function serverText(t){return typeof t==='string'&&/^[\u4e00-\u9fa5\d，。、；：！？（）]{2,40}$/.test(t)}
function failure(code){const e=Error(messages[code]||messages.UNKNOWN);e.code=code;return e}
function classify(e){const s=String(e&&(e.errMsg||e.message||e.error)||'').toLowerCase();
if(/exceed|too large|max.?size|payload|entity|超过|过大|超出/.test(s))return 'TOO_LARGE';
if(/collection.*(not exist|not found)|database_collection_not_exist/.test(s))return 'DATABASE';
if(/无法确认微信身份/.test(s))return 'IDENTITY';
if(/拒绝非目标云环境|environment.*(not found|not exist)|invalid.*env|env.*invalid/.test(s))return 'CONFIG';
if(/permission|access.?denied|unauthorized|not authorized/.test(s))return 'PERMISSION';
if(/function.*(not found|not exist)|functionname.*(could not|not found)/.test(s))return 'DEPLOYMENT';
if(/timeout|timed out|network|网络|超时|fail to connect/.test(s)||Number(e&&e.errCode)===-504003)return 'NETWORK';
if(/function.*(execution|运行)|execution.*fail/.test(s))return 'RUNTIME';return 'UNKNOWN'}
async function request(name,data){if(config.envId!=='YOUR_CLOUDBASE_ENV_ID')throw failure('CONFIG');if(typeof wx==='undefined'||!wx.cloud||typeof wx.cloud.callFunction!=='function')throw failure('CONFIG');let r;
try{r=await wx.cloud.callFunction({name,data,config:{env:config.envId}})}catch(e){const c=classify(e);throw failure(c==='UNKNOWN'&&name!=='initUser'?'CALL':c)}
if(r&&r.errCode&&r.errCode!==0)throw failure(classify(r));
if(!r||!r.result||typeof r.result!=='object')throw failure('RESPONSE');
if(r.result.error){const code=classify({error:r.result.error});if(code==='UNKNOWN'&&(name!=='initUser'||data.action==='profile')&&serverText(r.result.error)){const e=Error(r.result.error);e.code='SERVER';throw e}throw failure(code==='UNKNOWN'?'RUNTIME':code)}
if(name==='initUser'&&data.action!=='profile'&&!validUser(r.result.user))throw failure('RESPONSE');return r.result}
function initError(e){return messages[e&&e.code]||messages.UNKNOWN}

function call(name,data={}){
if(name==='initUser'&&!data.action){if(pendingInit)return pendingInit;const sid=session;const p=request(name,data).then(r=>{if(sid!==session)throw failure('IDENTITY');const next=r.uploadPath||'';if(next&&next!==scope){scope=next;invalidate()}return r});const task=p.finally(()=>{if(pendingInit===task)pendingInit=null});pendingInit=task;return task}
if(isRead(name,data)){const sid=session,owner=scope,key=epoch+':'+owner+':'+name+':'+JSON.stringify(data);if(reads.has(key))return reads.get(key);const p=request(name,data).then(r=>{if(sid!==session||owner!==scope)throw failure('IDENTITY');return r});const task=p.finally(()=>{if(reads.get(key)===task)reads.delete(key)});reads.set(key,task);return task}
// 写操作前后都使短期 UI 状态失效，失败同样触发重新核对；写操作绝不合并或自动重试。
const changed=areas(name,data);invalidate(changed);return request(name,data).finally(()=>invalidate(changed))}
function error(e){const message=e&&(e.code==='SERVER'&&serverText(e.message)||[...Object.values(C.copy),...Object.values(messages)].includes(e.message))?e.message:C.copy.failed;wx.showToast({title:message,icon:'none',duration:3500})}
async function allRecords(){let out=[],page=0;while(true){const r=await call('submitRecord',{action:'list',page});out.push(...r.rows);if(r.rows.length<15)return out;page++}}
// 图片走云存储直传：先上传到 initUser 返回的本人目录，再由 submitRecord 校验归属/大小/JPEG 后登记。不再经 callFunction 传 base64（超出请求体上限）。
async function uploadImage(filePath,onProgress){const init=await call('initUser');const dir=init&&init.uploadPath;if(typeof dir!=='string'||!/^images\/[0-9a-f]{64}\/$/.test(dir))throw failure('RESPONSE');if(typeof wx==='undefined'||!wx.cloud||typeof wx.cloud.uploadFile!=='function')throw failure('CONFIG');const name=Date.now().toString(36)+Math.random().toString(36).slice(2,12)+'.jpg';let up;try{up=await new Promise((resolve,reject)=>{const task=wx.cloud.uploadFile({cloudPath:dir+name,filePath,config:{env:config.envId},success:resolve,fail:reject});if(task&&typeof task.then==='function')task.then(resolve,reject);if(onProgress&&task&&typeof task.onProgressUpdate==='function')task.onProgressUpdate(p=>onProgress(Math.min(99,Number(p&&p.progress)||0)))})}catch(e){const c=classify(e);throw failure(['NETWORK','PERMISSION','CONFIG','TOO_LARGE'].includes(c)?c:'UPLOAD')}if(!up||typeof up.fileID!=='string'||!up.fileID)throw failure('UPLOAD');return call('submitRecord',{action:'upload',fileID:up.fileID})}
// 头像：直传到 initUser 返回的 avatars/<本人>/ 目录，再由 initUser(profile) 校验格式/大小并送图片审核。
async function uploadAvatar(filePath){const init=await call('initUser');const dir=init&&init.avatarPath;if(typeof dir!=='string'||!/^avatars\/[0-9a-f]{64}\/$/.test(dir))throw failure('RESPONSE');if(typeof wx==='undefined'||!wx.cloud||typeof wx.cloud.uploadFile!=='function')throw failure('CONFIG');const ext=/\.png$/i.test(filePath)?'png':'jpg';const name=Date.now().toString(36)+Math.random().toString(36).slice(2,12)+'.'+ext;let up;try{up=await wx.cloud.uploadFile({cloudPath:dir+name,filePath,config:{env:config.envId}})}catch(e){const c=classify(e);throw failure(['NETWORK','PERMISSION','CONFIG','TOO_LARGE'].includes(c)?c:'UPLOAD')}if(!up||typeof up.fileID!=='string'||!up.fileID)throw failure('UPLOAD');return call('initUser',{action:'profile',avatar:up.fileID})}
module.exports={call,version,sessionKey,reset,error,allRecords,validUser,initError,uploadImage,uploadAvatar};
