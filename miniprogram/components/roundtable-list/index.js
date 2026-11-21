const api=require('../../utils/cloud'),R=require('../../utils/roundtable'),C=require('../../utils/constants'),A=require('../../utils/roundtable-apply');
const decorate=x=>({...x,seats:R.seats(x.previewMembers||[],x.count,x.capacity)});
Component({options:{styleIsolation:'apply-shared'},properties:{theme:String,authorized:Boolean,active:Boolean},data:{copy:C.copy,rows:[],mine:[],search:'',interest:'全部',filters:C.copy.rtInterests,next:null,more:true,loading:false,error:'',applyingId:'',applyFeedback:'',applyFeedbackId:''},observers:{'authorized,active'(){this.syncVisibility()}},pageLifetimes:{show(){this._pageVisible=true;this.syncVisibility()},hide(){this._pageVisible=false;this.syncVisibility()}},lifetimes:{detached(){this.stop()}},methods:{
 running(){return this.data.authorized&&this.data.active&&this._pageVisible!==false},
 stop(){this._refreshTask=null;this._refreshAgain=false;this._token=(this._token||0)+1;clearTimeout(this._timer);this._timer=null;const rows=this.data.authorized&&Date.now()-(this._publicAt||0)<60000?this.data.rows.map(x=>decorate({id:x.id,name:x.name,intro:x.intro,interest:x.interest,rules:x.rules,count:x.count,capacity:x.capacity,formed:x.formed,full:x.full,joined:false,owner:false})):[];this.setData({rows,mine:[],loading:false,applyFeedback:'',applyFeedbackId:''});if(this.triggerEvent)this.triggerEvent('status',{pendingTotal:0,quota:0})},
 syncVisibility(){if(!this.running()){this.stop();return}this.refresh()},
 schedule(delay=10000){clearTimeout(this._timer);if(this.running())this._timer=setTimeout(()=>this.updatePreview(),delay)},
 async updatePreview(){return this.refresh()},

 draft(e){this.setData({search:e.detail.value})},filter(e){this.setData({interest:e.currentTarget.dataset.tag});this.refresh(true)},search(){this.refresh(true)},
 // A visible refresh preserves validated content; hide still strips all private identities.
 refresh(hard=false){
  if(!this.running())return Promise.resolve(false);
  const version=api.version('roundtable'),session=api.sessionKey();
  if(this._refreshTask){if(hard||this._refreshVersion!==version||this._refreshSession!==session)this._refreshAgain=true;return this._refreshTask}
  clearTimeout(this._timer);this._token=(this._token||0)+1;this._targetPages=hard?1:Math.max(1,this._visitedPages||1);if(hard)this._visitedPages=0;this._replace=true;this._refreshVersion=version;this._refreshSession=session;
  this.setData({next:null,more:true,...(hard?{rows:[]}:{}),loading:false});
  const task=this.load();this._refreshTask=task;
  task.finally(()=>{if(this._refreshTask!==task)return;this._refreshTask=null;if(this.running()&&(this._refreshAgain||version!==api.version('roundtable')||session!==api.sessionKey())){this._refreshAgain=false;this.refresh()}});
  return task;
 },
 async load(){
  if(!this.running()||this.data.loading||!this.data.more)return;
  const token=this._token||0,version=api.version('roundtable'),session=api.sessionKey(),replacing=this._replace,target=replacing?(this._targetPages||1):1;
  this.setData({loading:true,error:''});
  try{let before=this.data.next,pages=0,rows=[],r;
   do{r=await api.call('roundtable',{action:'search',search:this.data.search,interest:this.data.interest==='全部'?'':this.data.interest,before});
    if(token!==(this._token||0)||!this.running())return;
    if(version!==api.version('roundtable')||session!==api.sessionKey()){this._refreshAgain=true;return}
    rows.push(...r.rows);before=r.next;pages++;
   }while(before&&pages<target);
   this._publicAt=Date.now();const base=replacing?[]:this.data.rows;this._replace=false;this._visitedPages=replacing?pages:(this._visitedPages||0)+pages;
   const seen=new Set(base.map(x=>x.id)),fresh=[];for(const row of rows)if(!seen.has(row.id)){seen.add(row.id);fresh.push(decorate(row))}
   this.setData({rows:[...base,...fresh],mine:r.mine.map(decorate),next:r.next,more:!!r.next});if(this.triggerEvent)this.triggerEvent('status',{pendingTotal:r.mine.filter(t=>t.owner).reduce((n,t)=>n+(t.pendingCount||0),0),quota:r.mine.length});
  }catch(e){if(token===(this._token||0))this.setData({error:e.message,rows:[],mine:[]})}
  finally{if(token===(this._token||0)){this.setData({loading:false});this.schedule()}}
 },
 async apply(e){
  const id=e&&e.currentTarget&&e.currentTarget.dataset&&e.currentTarget.dataset.id;
  const row=this.data.rows.find(x=>x.id===id);
  if(!this.running()){A.toast('页面状态已变化，请返回圆桌重试');return}
  if(!row){A.toast('列表已更新，请重新选择圆桌');return}
  if(row.joined)return this.open(e);
  if(row.requestStatus==='pending'){this.setData({applyFeedbackId:id,applyFeedback:C.copy.rtApplied});A.toast(C.copy.rtApplied);return}
  if(row.full){this.setData({applyFeedbackId:id,applyFeedback:C.copy.rtFull});A.toast(C.copy.rtFull);return}
  if(this._applying){A.toast('申请正在提交，请稍候');return}
  const attempt=A.trace(),session=api.sessionKey();this._applying=attempt;
  this.setData({applyingId:id,error:'',applyFeedbackId:id,applyFeedback:'正在提交申请，请稍候…'});
  try{
   const r=await A.submit({tableId:id});
   if(!this.running()||session!==api.sessionKey()||this._applying!==attempt)return;
   if(r.joined){this.setData({applyFeedback:'已是本桌成员，正在进入'});this.refresh();return this.open(e)}
   if(!r.pending)throw Error(C.copy.failed);
   const i=this.data.rows.findIndex(x=>x.id===id);if(i>=0)this.setData({['rows['+i+'].requestStatus']:'pending'});
   this.setData({applyFeedback:C.copy.rtApplied});A.toast(C.copy.rtApplied);
   // Confirmation is already durable. Background refresh must not hold the write button lock.
   this.refresh();
  }catch(err){if(this.running()&&session===api.sessionKey()&&this._applying===attempt){this.setData({error:A.problem(err,attempt),applyFeedback:A.problem(err,attempt)});A.toast(err.code==='APPLY_TIMEOUT'?'申请确认超时，请重试核实':'申请未确认，请查看按钮下方提示')}}
  finally{if(this._applying===attempt){this._applying=null;this.setData({applyingId:''})}}
 },
 open(e){wx.navigateTo({url:'/pages/roundtable-chat/index?id='+encodeURIComponent(e.currentTarget.dataset.id)})},manage(e){wx.navigateTo({url:'/pages/roundtable-members/index?id='+encodeURIComponent(e.currentTarget.dataset.id)+'&review=1'})},reviewFirst(){const t=this.data.mine.find(t=>t.owner&&t.pendingCount>0);if(t)return this.manage({currentTarget:{dataset:{id:t.id}}});A.toast('暂无待审核申请');this.refresh()},create(){if(!this.running()){A.toast('请先打开圆桌并完成年龄确认');return}if(this.data.mine.length>=3){A.toast('每人最多加入三桌，请先退出或解散一桌');return}wx.navigateTo({url:'/pages/roundtable-form/index'})}
}});
