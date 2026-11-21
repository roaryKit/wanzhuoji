const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{mock}=require('./mock-cloud'),{uid}=require('../cloudfunctions/submitRecord/service');
const config=require('../miniprogram/utils/config');
const env={WZJ_CALLBACK_MODE:'wechat-aes-json',WZJ_CALLBACK_TOKEN:'localTestOnlyToken',WZJ_CALLBACK_AES_KEY:Buffer.alloc(32,7).toString('base64').slice(0,-1)};
const sha=(...a)=>crypto.createHash('sha1').update(a.sort().join('')).digest('hex');
function request(trace,suggest='pass'){const m={appid:config.appid,MsgType:'event',Event:'wxa_media_check',trace_id:trace,version:2,errcode:0,result:{suggest}};const key=Buffer.from(env.WZJ_CALLBACK_AES_KEY+'=','base64'),body=Buffer.from(JSON.stringify(m)),len=Buffer.alloc(4);len.writeUInt32BE(body.length);const plain=Buffer.concat([Buffer.alloc(16),len,body,Buffer.from(config.appid)]),pad=32-plain.length%32,c=crypto.createCipheriv('aes-256-cbc',key,key.subarray(0,16));c.setAutoPadding(false);const Encrypt=Buffer.concat([c.update(Buffer.concat([plain,Buffer.alloc(pad,pad)])),c.final()]).toString('base64'),timestamp=String(Math.floor(Date.now()/1000)),nonce='n';return {httpMethod:'POST',queryStringParameters:{timestamp,nonce,encrypt_type:'aes',msg_signature:sha(env.WZJ_CALLBACK_TOKEN,timestamp,nonce,Encrypt)},body:JSON.stringify({Encrypt})}}
function withEnv(fn){return async()=>{Object.assign(process.env,env);try{await fn()}finally{for(const k of Object.keys(env))delete process.env[k]}}}
const dir=o=>'avatars/'+crypto.createHash('sha256').update(o).digest('hex')+'/';
const png=Buffer.from([0x89,0x50,0x4e,0x47,13,10,26,10,0]);
async function setup(){const m=mock();for(const u of ['a','b'])await m.seed(u);const r=await m.call('a','submitRecord',{record:{wineName:'晚风清酒',isSolo:true,privacy:'public',text:'安静'}});return {m,id:r.id}}
const avatarFile=(m,o,bytes=png,name)=>{const f=m.bucket+dir(o)+(name||'av'+Math.random().toString(36).slice(2,12)+'.png');m.files.set(f,Buffer.from(bytes));return f};

test('资料：昵称 1-16 字并经文字审核；初始化返回本人资料与头像目录',async()=>{const {m}=await setup();
let r=await m.call('a','initUser');assert.equal(r.user.profile.hasProfile,false);assert.equal(r.avatarPath,dir('a'));
assert.match((await m.call('a','initUser',{action:'profile',nickname:'  '})).error,/1到16/);
assert.match((await m.call('a','initUser',{action:'profile',nickname:'夜'.repeat(17)})).error,/1到16/);
m.flags.text='risky';assert.match((await m.call('a','initUser',{action:'profile',nickname:'坏名字'})).error,/未通过/);
m.flags.text='pass';r=await m.call('a','initUser',{action:'profile',nickname:' 晚风 '});assert.equal(r.profile.nickname,'晚风');assert.equal(r.profile.prompted,true);
m.flags.text='throw';await m.call('a','initUser',{action:'profile',nickname:'待审'});assert.equal((await m.call('b','getPlaza')).rows[0].author.name.startsWith('陌生人'),true);
assert.equal((await m.call('a','getPlaza')).rows[0].author.name,'待审');
m.flags.text='pass';assert.equal((await m.call('a','initUser')).user.profile.nicknamePending,false);assert.equal((await m.call('b','getPlaza')).rows[0].author.name,'待审')});

test('资料：头像校验目录/格式/大小，经图片审核回调通过后他人可见；旧头像删除',withEnv(async()=>{const {m}=await setup();let n=0;m.flags.media=()=>'avatar-trace-'+(++n);
assert.match((await m.call('a','initUser',{action:'profile',avatar:avatarFile(m,'b')})).error,/路径无效/);
const bad=avatarFile(m,'a',Buffer.from('GIF89a'));assert.match((await m.call('a','initUser',{action:'profile',avatar:bad})).error,/JPEG或PNG/);assert.ok(m.flags.removed.includes(bad));
const f1=avatarFile(m,'a');let r=await m.call('a','initUser',{action:'profile',avatar:f1,nickname:'晚风'});assert.equal(r.profile.avatarStatus,'pending');assert.ok(r.profile.avatarURL);
assert.equal((await m.call('a','getPlaza')).rows[0].author.avatar,'https://test.invalid/image');
let other=(await m.call('b','getPlaza')).rows[0].author;assert.equal(other.name,'晚风');assert.equal(other.avatar,'');
assert.equal(await m.call('','mediaCheckCallback',request('avatar-trace-1')),'success');assert.equal(m.store.users.get(uid('a')).avatarStatus,'pass');
other=(await m.call('b','getPlaza')).rows[0].author;assert.equal(other.avatar,'https://test.invalid/image');assert.ok(!JSON.stringify(other).includes('cloud://'));
const f2=avatarFile(m,'a');await m.call('a','initUser',{action:'profile',avatar:f2});assert.ok(m.flags.removed.includes(f1));assert.ok(!m.store.users.get(uid('a')).uploads.includes(f1));
assert.equal((await m.call('b','getPlaza')).rows[0].author.avatar,'');
await m.call('','mediaCheckCallback',request('avatar-trace-2','risky'));assert.equal(m.store.users.get(uid('a')).avatarStatus,'reject');assert.equal((await m.call('a','initUser')).user.profile.avatarURL,'');
await m.call('','mediaCheckCallback',request('avatar-trace-2','pass'));assert.equal(m.store.users.get(uid('a')).avatarStatus,'reject')}));

test('资料：匿名显示对广场与评论生效，评论带头像昵称且不含openid；清除数据删除头像',withEnv(async()=>{const {m,id}=await setup();m.flags.media='av-t';
const f=avatarFile(m,'b');await m.call('b','initUser',{action:'profile',avatar:f,nickname:'路人乙'});await m.call('','mediaCheckCallback',request('av-t'));
const c=await m.call('b','getPlaza',{action:'comment',id,text:'你好'});assert.equal(c.comment.handle,'路人乙');assert.ok(c.comment.avatar);
let v=await m.call('a','getPlaza',{action:'comments',id});assert.equal(v.comments[0].handle,'路人乙');assert.ok(!JSON.stringify(v).includes('openid'));
await m.call('a','initUser',{action:'profile',nickname:'作者甲'});assert.equal((await m.call('b','getPlaza',{action:'record',id})).record.author.name,'作者甲');
await m.call('a','initUser',{action:'profile',anonymous:true});assert.match((await m.call('b','getPlaza')).rows[0].author.name,/^陌生人 /);assert.match((await m.call('a','getPlaza')).rows[0].author.name,/^陌生人 /);
await m.call('b','initUser',{action:'profile',anonymous:true});v=await m.call('a','getPlaza',{action:'comments',id});assert.match(v.comments[0].handle,/^陌生人 /);assert.equal(v.comments[0].avatar,'');
assert.match((await m.call('a','initUser',{action:'profile',anonymous:'yes'})).error,/无效/);
for(let i=0;i<20;i++){const x=await m.call('b','clearMyData');if(x.done)break}assert.ok(m.flags.removed.includes(f));assert.equal(m.store.users.has(uid('b')),false)}));
