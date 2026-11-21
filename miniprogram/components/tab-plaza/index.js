const {tab}=require('../../utils/tab'),api=require('../../utils/cloud');
const C=require('../../utils/constants'),view=require('../../utils/view');
Component(tab({cacheScope:'plaza',data:{ownedPending:0,tableQuota:0,section:'plaza',roundtableVisited:false,rows:[],filters:['全部',...C.tags],filter:'全部',page:0,next:null,more:true,loading:false},
refresh(){return this.data.section==='plaza'?this.load(true):false},
methods:{
roundtableStatus(e){this.setData({ownedPending:Math.max(0,Number(e.detail.pendingTotal)||0),tableQuota:Math.max(0,Number(e.detail.quota)||0)})},
createRoundtable(){const c=this.selectComponent('#roundtable-list');if(c)return c.create()},
reviewRoundtable(){const c=this.selectComponent('#roundtable-list');if(c)return c.reviewFirst()},

onPageScroll(e){this._scrollTop=Math.max(0,Number(e.scrollTop)||0)},
switchSection(e){const section=e.currentTarget.dataset.section;if(!['plaza','roundtable'].includes(section)||section===this.data.section)return;this._sectionScroll=this._sectionScroll||{};this._sectionScroll[this.data.section]=this._scrollTop||0;const target=this._sectionScroll[section]||0;this.setData({section,roundtableVisited:this.data.roundtableVisited||section==='roundtable'},()=>{if(this.data.section!==section)return;this._scrollTop=target;if(wx.pageScrollTo)wx.pageScrollTo({scrollTop:target,duration:0});if(section==='plaza'&&(!this._feedAt||Date.now()-this._feedAt>=10000||this._feedVersion!==api.version('plaza')))this.load(true)})},
async select(e){if(this.data.loading)return;this.setData({filter:e.currentTarget.dataset.tag,rows:[],page:0,next:null,more:true});await this.load()},
load(refresh=false){return require('../../utils/feed').load(this,{area:'plaza',name:'getPlaza',query:c=>({tag:c.data.filter==='全部'?undefined:c.data.filter})},refresh)},
async onReachBottom(){if(this.data.section==='roundtable'){const c=this.selectComponent('#roundtable-list');if(c)return c.load();return}await this.load()},
// 点赞乐观更新：先改界面，失败再回滚。
async like(e){const {id,on}=e.detail;if((this._likes||{})[id])return;if(on)await require('../../utils/profile').ensure(this);if((this._likes||{})[id])return;const row=this.data.rows.find(r=>r._id===id);if(!row)return;this._likes=this._likes||{};this._likes[id]=true;const prev={liked:!!row.liked,likeCount:row.likeCount||0};
const paint=p=>{this._editClock=(this._editClock||0)+1;this._edited=this._edited||{};this._edited[id]=this._editClock;const i=this.data.rows.findIndex(r=>r._id===id);if(i>=0)this.setData({['rows['+i+'].liked']:p.liked,['rows['+i+'].likeCount']:p.likeCount})};
paint({liked:on,likeCount:Math.max(0,prev.likeCount+(on?1:-1))});try{const r=await api.call('getPlaza',{action:'like',id,on});paint(r)}catch(err){paint(prev);api.error(err)}finally{delete this._likes[id]}},
async report(e){const reasons=['内容不适宜','劝酒或酗酒','其他'];try{const r=await wx.showActionSheet({itemList:reasons});await this.run(async()=>{await api.call('reportRecord',{recordId:e.detail.id,reason:reasons[r.tapIndex]});wx.showToast({title:C.copy.reported,icon:'none'})})}catch(e){if(!String(e.errMsg||'').includes('cancel'))api.error(e)}}
}}));
