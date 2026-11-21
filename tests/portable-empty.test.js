// Only in-memory test data. No wx-server-sdk import, network, credentials or cloud writes.
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {mock}=require('./mock-cloud'),api=require('../miniprogram/utils/cloud');
test('portable: new independent environment has no imported business records',async()=>{
 const m=mock();a.equal(Object.values(m.store).reduce((n,v)=>n+v.size,0),0);
 await m.call('memory-only-new-user','initUser',{action:'confirmAge',confirm:true});
 const requests=[['submitRecord',{action:'list',summary:true}],['submitRecord',{action:'wines',summary:true}],['getPlaza',{action:'list'}],['roundtable',{action:'search'}]];
 for(const [name,event]of requests){const r=await m.call('memory-only-new-user',name,event);a.equal(r.error,undefined);a.deepEqual(r.rows,[]);if(r.mine)a.deepEqual(r.mine,[])}
 a.equal(m.store.users.size,1);for(const [name,rows]of Object.entries(m.store))if(name!=='users')a.equal(rows.size,0,name+' must remain empty');
});
test('portable: all four actual list components render empty responses without fallback records',async()=>{
 global.getApp=()=>({globalData:{user:{ageConfirmed:true},authRevision:0}});global.wx={showToast(){},showLoading(){},hideLoading(){}};api.reset();const call=api.call;
 api.call=async()=>({rows:[],mine:[],next:null,counts:[],stats:{}});
 try{for(const name of ['tab-home','tab-plaza','tab-wines','roundtable-list']){let d;global.Component=x=>d=x;const f='../miniprogram/components/'+name+'/index';delete require.cache[require.resolve(f)];require(f);const c={...d.methods,data:{...structuredClone(d.data),authorized:true,active:true},setData(p,cb){Object.assign(this.data,p);cb?.()},triggerEvent(){}};
 a.deepEqual(c.data.rows,[]);if(name==='roundtable-list')await c.refresh();else await c.activate();a.deepEqual(c.data.rows,[]);if(c.data.mine)a.deepEqual(c.data.mine,[]);if(c.stop)c.stop();if(c.deactivate)c.deactivate();}}
 finally{api.call=call;api.reset()}
});
test('portable: runtime imports cannot load isolated test fixtures or demonstration renderer',()=>{
 const root=path.join(__dirname,'..');function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()&&e.name!=='node_modules')walk(p);else if(e.isFile()&&p.endsWith('.js')){const s=fs.readFileSync(p,'utf8');a.doesNotMatch(s,/require\(['"][^'"]*(?:tests\/|mock-cloud|render-premium)/,p)}}}walk(path.join(root,'miniprogram'));walk(path.join(root,'cloudfunctions'));
 a.equal(fs.existsSync(path.join(root,'scripts/render-premium-ui.js')),false);a.equal(fs.existsSync(path.join(root,'docs/screenshots')),false);
});
test('portable: sample table UI is removed while server legacy refusal remains',()=>{
 const root=path.join(__dirname,'..');for(const n of ['components/roundtable-list/index.js','components/roundtable-list/index.wxml','pages/roundtable-chat/index.js','pages/roundtable-chat/index.wxml','utils/roundtable-apply.js'])a.doesNotMatch(fs.readFileSync(path.join(root,'miniprogram',n),'utf8'),/A\.demo|示例桌说明|function demo/);
 const s=fs.readFileSync(path.join(root,'cloudfunctions/roundtable/roundtable.js'),'utf8');a.match(s,/if \(demoOnly\(t\)\) fail/);
});
