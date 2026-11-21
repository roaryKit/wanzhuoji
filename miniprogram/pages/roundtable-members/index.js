const {page}=require('../../utils/page'),api=require('../../utils/cloud'),C=require('../../utils/constants');
Page(page({
 data:{table:null,members:[],requests:[],requestNext:null,requestTotal:0,requestLoading:false},
 onLoad(q){if(wx.hideShareMenu)wx.hideShareMenu();this.tableId=q.id||'';this._generation=0;this._visible=false;this._requestPages=1},
 async onShow(){this._visible=true;return this.run(async()=>{await this.load();this.schedule()})},
 onHide(){this.stop()},onUnload(){this.stop()},
 stop(){this._visible=false;this._generation++;this._loadTask=null;this._loadAgain=false;clearTimeout(this._timer);this.setData({table:null,members:[],requests:[],requestNext:null,requestTotal:0,requestLoading:false})},
 schedule(){clearTimeout(this._timer);if(this._visible&&this.data.authorized&&this.data.table)this._timer=setTimeout(async()=>{try{await this.load()}catch(_){}finally{this.schedule()}},this.data.table.owner?5000:10000)},
 load(append=false){
  if(this._loadTask){if(!append)this._loadAgain=true;return this._loadTask}
  const g=this._generation,session=api.sessionKey(),version=api.version('roundtable');
  const live=()=>this._visible&&g===this._generation&&this.data.authorized&&session===api.sessionKey();
  const task=(async()=>{this.setData({requestLoading:true});try{
   const r=await this.rpc('detail');if(!live())return;
   if(!r.table.joined){this.stop();wx.redirectTo({url:'/pages/roundtable-chat/index?id='+encodeURIComponent(this.tableId)});return}
   let requests=[],next=null,total=0,pages=0;
   if(r.table.owner){let before=append?this.data.requestNext:null,target=append?1:this._requestPages||1;do{const q=await this.rpc('requests',{before});if(!live())return;requests.push(...q.rows);total=q.total||0;next=q.next;before=q.next;pages++}while(before&&pages<target)}
   if(!live())return;if(version!==api.version('roundtable')){this._loadAgain=true;return}
   const base=append?this.data.requests:[],byId=new Map(base.map(x=>[x.id,x]));for(const x of requests)byId.set(x.id,x);
   this._requestPages=append?(this._requestPages||1)+pages:Math.max(1,pages);
   this.setData({table:r.table,members:r.members,requests:[...byId.values()],requestNext:next,requestTotal:total,error:''});
  }catch(e){if(live()){clearTimeout(this._timer);this.setData({table:null,members:[],requests:[],requestTotal:0,error:e.message});api.error(e)}}finally{if(live())this.setData({requestLoading:false})}})();
  this._loadTask=task;task.finally(()=>{if(this._loadTask!==task)return;this._loadTask=null;if(this._loadAgain&&this._visible){this._loadAgain=false;this.load()}});return task;
 },
 moreRequests(){if(this.data.requestNext)return this.load(true)},
 rpc(action,e={}){return api.call('roundtable',{action,tableId:this.tableId,...e})},
 async approve(e){return this.run(async()=>{await this.rpc('approve',{id:e.currentTarget.dataset.id,accept:e.currentTarget.dataset.accept===true||e.currentTarget.dataset.accept==='true'});wx.showToast({title:e.currentTarget.dataset.accept===true||e.currentTarget.dataset.accept==='true'?C.copy.rtApproved:C.copy.rtRejected,icon:'none'});await this.load()})},
 async memberAction(e){const row=this.data.members.find(x=>x.id===e.currentTarget.dataset.id);if(!row||row.self||!this.data.table.owner)return;let s;try{s=await wx.showActionSheet({itemList:[C.copy.rtTransfer,C.copy.rtRemove]})}catch(_){return}const transfer=s.tapIndex===0,r=await wx.showModal({title:row.name,content:transfer?C.copy.rtConfirmTransfer:C.copy.rtConfirmRemove});if(r.confirm)return this.run(async()=>{await this.rpc(transfer?'transfer':'remove',{memberId:row.id});await this.load()})},
 edit(){wx.navigateTo({url:'/pages/roundtable-form/index?id='+encodeURIComponent(this.tableId)})},
 async dissolve(){if(!(this.data.table||{}).owner){wx.showToast({title:'仅桌主可解散圆桌',icon:'none'});return}const r=await wx.showModal({title:'解散圆桌',content:'解散后所有成员立即失去访问权限，待审申请失效。历史保留用于安全审计。确定解散？',confirmText:'确认解散',confirmColor:'#B85B45'});if(!r.confirm)return;return this.run(async()=>{await this.rpc('dissolve',{confirm:true});wx.showToast({title:'圆桌已解散',icon:'none'});this.stop();wx.navigateBack()})},
 async leave(){if(!this.data.table)return;if(this.data.table.owner){wx.showToast({title:'桌主可转让桌主或选择解散圆桌',icon:'none'});return}const r=await wx.showModal({title:C.copy.rtLeave,content:C.copy.rtConfirmLeave});if(r.confirm)return this.run(async()=>{await this.rpc('leave');this.stop();wx.navigateBack()})},
 avatarError(e){const id=e.currentTarget.dataset.id;this.setData({members:this.data.members.map(x=>x.id===id?{...x,avatar:'',avatarState:'unavailable'}:x)});if(!this._avatarRetry||Date.now()-this._avatarRetry>30000){this._avatarRetry=Date.now();this.rpc('detail',{refreshProfiles:true}).then(r=>{if(this._visible&&this.data.authorized)this.setData({members:r.members})}).catch(()=>{})}}
}));
