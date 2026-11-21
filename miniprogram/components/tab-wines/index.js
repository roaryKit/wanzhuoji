const {tab}=require('../../utils/tab'),api=require('../../utils/cloud');
// List-row display fields only (category initial for the tile, 5 star flags); data logic unchanged.
function decorate(w){const rating=Math.max(0,Math.min(5,Number(w.rating)||0));return Object.assign({},w,{initial:String(w.category||'其他').charAt(0),stars:[1,2,3,4,5].map(n=>n<=rating)})}
Component(tab({cacheScope:'wines',data:{rows:[],total:0,filter:'全部',filters:['全部','果酒','清酒','啤酒','威士忌','葡萄酒','其他']},
async refresh(){await this.run(async()=>{const owner=api.sessionKey(),all=[];let counts=new Map();for(let page=0;;page++){const r=await api.call('submitRecord',{action:'wines',page,summary:page===0});if(owner!==api.sessionKey()||!this.data.authorized)return;if(page===0){if(!Array.isArray(r.counts))throw Error('COUNTS_MISSING');counts=new Map(r.counts.map(x=>[x.name,x.count]))}all.push(...r.rows);if(r.rows.length<15)break}this.all=all.map(w=>({...w,count:counts.get(w.name)||0}));this.filter()})},
methods:{
filter(e){const f=e?e.currentTarget.dataset.value:this.data.filter;const all=this.all||[];this.setData({filter:f,total:all.length,rows:all.filter(w=>f==='全部'||w.category===f).map(decorate)})},
open(e){wx.navigateTo({url:'/pages/wine-detail/index?id='+e.detail.id})}
}}));
