const {test}=require('node:test'),assert=require('node:assert/strict'),{mock}=require('./mock-cloud');
const pub=(more={})=>({wineName:'晚风清酒',isSolo:true,privacy:'public',text:'今晚很安静',...more});
async function setup(){const m=mock();for(const u of ['a','b','c'])await m.seed(u);const r=await m.call('a','submitRecord',{record:pub()});const p=await m.call('a','submitRecord',{record:{...pub(),privacy:'private'}});return {m,id:r.id,priv:p.id}}
const later=(m,u)=>{const x=m.store.users.get(require('../cloudfunctions/submitRecord/service').uid(u));x.commentTimes=(x.commentTimes||[]).map(t=>t-60000)};

test('点赞：每人每条一次，幂等切换，计数与广场 liked 一致',async()=>{const {m,id}=await setup();
assert.deepEqual(await m.call('b','getPlaza',{action:'like',id,on:true}),{liked:true,likeCount:1});
assert.deepEqual(await m.call('b','getPlaza',{action:'like',id,on:true}),{liked:true,likeCount:1});
assert.equal((await m.call('c','getPlaza',{action:'like',id,on:true})).likeCount,2);
const rows=(await m.call('b','getPlaza')).rows;assert.equal(rows[0].liked,true);assert.equal(rows[0].likeCount,2);
assert.equal((await m.call('a','getPlaza')).rows[0].liked,false);
assert.deepEqual(await m.call('b','getPlaza',{action:'like',id,on:false}),{liked:false,likeCount:1});
assert.deepEqual(await m.call('b','getPlaza',{action:'like',id,on:false}),{liked:false,likeCount:1});
assert.equal(m.store.likes.size,1);assert.match((await m.call('b','getPlaza',{action:'like',id,on:'x'})).error,/操作无效/)});

test('私密/未通过记录：不能赞、评、看，分享落地显示不可查看',async()=>{const {m,id,priv}=await setup();
for(const action of ['record','comments'])assert.match((await m.call('b','getPlaza',{action,id:priv})).error,/暂不可查看/);
assert.match((await m.call('b','getPlaza',{action:'like',id:priv,on:true})).error,/暂不可查看/);
assert.match((await m.call('b','getPlaza',{action:'comment',id:priv,text:'你好'})).error,/暂不可查看/);
m.flags.text='risky';const rej=await m.call('a','submitRecord',{record:pub({text:'别的'})});assert.match((await m.call('b','getPlaza',{action:'record',id:rej.id})).error,/暂不可查看/);
const ok=await m.call('b','getPlaza',{action:'record',id});assert.equal(ok.record._id,id);assert.equal(ok.record.mine,false);assert.ok(!JSON.stringify(ok).includes('openid'));assert.equal((await m.call('a','getPlaza',{action:'record',id})).record.mine,true)});

test('评论：审核通过才对他人可见，拒绝不落库，待审仅作者可见并在重开时补审',async()=>{const {m,id}=await setup();
const c1=await m.call('b','getPlaza',{action:'comment',id,text:'  干净的夜晚  '});assert.equal(c1.status,'pass');assert.equal(c1.comment.text,'干净的夜晚');assert.equal(c1.comment.handle,'我');
let v=await m.call('c','getPlaza',{action:'comments',id});assert.equal(v.commentCount,1);assert.match(v.comments[0].handle,/^陌生人 [0-9A-F]{4}$/);assert.equal(v.comments[0].canDelete,false);assert.ok(!JSON.stringify(v).includes('openid'));
assert.equal((await m.call('a','getPlaza',{action:'comments',id})).comments[0].canDelete,true);
later(m,'b');m.flags.text='risky';assert.deepEqual(await m.call('b','getPlaza',{action:'comment',id,text:'不好的话'}),{status:'reject'});assert.equal(m.store.comments.size,1);
later(m,'b');m.flags.text='throw';const pend=await m.call('b','getPlaza',{action:'comment',id,text:'稍后再审'});assert.equal(pend.status,'pending');assert.equal(pend.comment.pending,true);
assert.equal((await m.call('c','getPlaza',{action:'comments',id})).comments.length,1);
v=await m.call('b','getPlaza',{action:'comments',id});assert.equal(v.comments.length,2);assert.equal(v.comments[1].pending,true);
m.flags.text='pass';v=await m.call('b','getPlaza',{action:'comments',id});assert.equal(v.comments.filter(c=>!c.pending).length,2);assert.equal(v.commentCount,2);
assert.equal((await m.call('c','getPlaza',{action:'comments',id})).commentCount,2);
const self=await m.call('a','getPlaza',{action:'comment',id,text:'谢谢'});assert.equal((await m.call('c','getPlaza',{action:'comments',id})).comments[2].handle,'作者');assert.equal(self.comment.byAuthor,true)});

test('评论：长度、频率与删除权限',async()=>{const {m,id}=await setup();
assert.match((await m.call('b','getPlaza',{action:'comment',id,text:'   '})).error,/写点什么/);
assert.match((await m.call('b','getPlaza',{action:'comment',id,text:'夜'.repeat(201)})).error,/200字/);
assert.equal((await m.call('b','getPlaza',{action:'comment',id,text:'夜'.repeat(200)})).status,'pass');
assert.match((await m.call('b','getPlaza',{action:'comment',id,text:'再一条'})).error,/稍等/);
const u=m.store.users.get(require('../cloudfunctions/submitRecord/service').uid('b'));u.commentTimes=Array.from({length:30},(_,i)=>Date.now()-3600000-i);assert.match((await m.call('b','getPlaza',{action:'comment',id,text:'第31条'})).error,/明天/);
const bc=[...m.store.comments.values()][0];
assert.match((await m.call('c','getPlaza',{action:'deleteComment',commentId:bc._id})).error,/只能删除/);
assert.deepEqual(await m.call('a','getPlaza',{action:'deleteComment',commentId:bc._id}),{ok:true});assert.equal(m.store.comments.size,0);
assert.equal((await m.call('c','getPlaza',{action:'comments',id})).commentCount,0);
const c2=await m.call('c','getPlaza',{action:'comment',id,text:'我自己的'});assert.deepEqual(await m.call('c','getPlaza',{action:'deleteComment',commentId:c2.comment.id}),{ok:true});
assert.match((await m.call('c','getPlaza',{action:'nope'})).error,/操作无效/)});

test('编辑记录保留赞评计数；清除数据删除本人的赞与评论',async()=>{const {m,id}=await setup();
await m.call('b','getPlaza',{action:'like',id,on:true});await m.call('b','getPlaza',{action:'comment',id,text:'路过'});
const got=(await m.call('a','submitRecord',{action:'get',id})).record;await m.call('a','submitRecord',{id,record:{...got,text:'改一下'}});
const r=m.store.records.get(id);assert.equal(r.likeCount,1);assert.equal(r.commentCount,1);
for(let i=0;i<10;i++){const x=await m.call('b','clearMyData');if(x.done)break}
assert.equal([...m.store.likes.values()].filter(x=>x._openid==='b').length,0);assert.equal([...m.store.comments.values()].filter(x=>x._openid==='b').length,0)});
