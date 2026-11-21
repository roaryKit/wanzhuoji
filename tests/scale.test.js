const test=require('node:test'),assert=require('node:assert/strict'),{mock}=require('./mock-cloud');
// 大数据量下的广场游标分页：翻页途中有新记录发布，也不重复、不漏条；点赞状态批量读取正确。
test('广场游标分页：插入新记录不重复不漏条，点赞状态与作者批量返回',async()=>{const m=mock();await m.seed('a');await m.seed('b');const pub=(i,t)=>({_id:'r'+i,_openid:i%2?'a':'b',wineName:'酒'+i,privacy:'public',auditStatus:'pass',isSolo:true,reportHold:false,moodTags:['雨天独饮'],likeCount:0,commentCount:0,createdAt:new Date(t)});
for(let i=0;i<57;i++)m.store.records.set('r'+i,pub(i,Date.UTC(2026,5,1)+i*3600e3));
m.store.records.set('x',{...pub(99,Date.UTC(2026,5,3)),_id:'x',privacy:'private'});
await m.call('b','getPlaza',{action:'like',id:'r56',on:true});await m.call('b','getPlaza',{action:'like',id:'r40',on:true});
await m.call('a','initUser',{action:'profile',nickname:'晚风'});
const seen=[];let before,r,pages=0,likedIds=[];do{r=await m.call('b','getPlaza',before?{before}:{});assert.ok(!r.error,r.error);pages++;seen.push(...r.rows.map(x=>x._id));likedIds.push(...r.rows.filter(x=>x.liked).map(x=>x._id));for(const x of r.rows)assert.equal(x.author.name,Number(x._id.slice(1))%2?'晚风':x.author.name);
if(pages===1)m.store.records.set('new',pub(100,Date.UTC(2026,6,1)));before=r.next}while(before);
assert.equal(pages,6);assert.equal(seen.length,57);assert.equal(new Set(seen).size,57);assert.ok(!seen.includes('x')&&!seen.includes('new'));assert.deepEqual(likedIds.sort(),['r40','r56']);
assert.ok((await m.call('b','getPlaza',{before:-1})).error);assert.ok((await m.call('b','getPlaza',{before:'abc'})).error)});
