// Tab view factory: the four former tabBar pages now live as components inside pages/main.
// The shell page owns the age/auth guard; a tab only loads when the shell activates it.
const C=require('./constants'),api=require('./cloud');
function tab(spec){
 const refresh=spec.refresh,area=spec.cacheScope;
 const owner=()=>api.sessionKey()+':'+((getApp().globalData||{}).authRevision||0);
 function syncOwner(){const key=owner();if(!this.data.authorized||this._ownerKey!==undefined&&this._ownerKey!==key){this._showGeneration=(this._showGeneration||0)+1;this._token=(this._token||0)+1;this._loadedOnce=false;this._showTask=null;this._fetching=null;this._running=false;this.all=[];this.setData(Object.assign({error:'',busy:false},JSON.parse(JSON.stringify(spec.data||{}))))}this._ownerKey=key}

 const methods=Object.assign({},spec.methods,{
  activate(){
   this._foreground=true;syncOwner.call(this);
   if(!this.data.authorized||getApp().globalData.denied)return Promise.resolve(false);
   if(this._showTask)return this._showTask;
   // 已挂载视图短期复用；服务端写操作会提升 epoch，返回后立即重新核对。权限 guard 仍逐次执行。
   if(this._loadedOnce&&!this.data.error&&this._readVersion===api.version(area)&&Date.now()-(this._refreshedAt||0)<10000)return Promise.resolve();
   const generation=this._showGeneration||0,identity=this._ownerKey;
   const task=(async()=>{
    if(generation!==(this._showGeneration||0))return;
    if(this.data.error)this.setData({error:''});
    this._inShow=true;
    const v=api.version(area);try{const result=refresh?await refresh.call(this):undefined;if(result!==false&&identity===this._ownerKey&&this.data.authorized&&!this.data.error){this._loadedOnce=true;this._refreshedAt=Date.now();this._readVersion=v}}
    finally{if(identity===this._ownerKey)this._inShow=false}
   })();
   this._showTask=task;
   task.then(()=>{if(this._showTask===task)this._showTask=null},()=>{if(this._showTask===task)this._showTask=null});
   return task;
  },
  deactivate(){this._foreground=false},
  refresh(){return refresh?refresh.call(this):undefined},
  async run(fn){
   if(this.data.busy||this._running)return;
   const identity=owner();const quiet=!!(this._inShow&&this._loadedOnce);
   this._running=true;
   if(!quiet){this.setData({busy:true,error:''});wx.showLoading({title:'请稍候'})}
   try{return await fn()}
   catch(e){if(identity===owner()&&this.data.authorized){this.setData({error:C.copy.failed});api.error(e)}}
   finally{this._running=false;if(!quiet){wx.hideLoading();this.setData({busy:false})}}
  },
  retry(){this.triggerEvent('retry')},
  setUser(user){getApp().globalData.user=user;this.setData({user});this.triggerEvent('user',{user})},
  go(e){wx.navigateTo({url:e.currentTarget.dataset.url})}
 });
 return {
  options:{styleIsolation:'apply-shared'},
  observers:{'authorized,user'(){syncOwner.call(this)}},
  properties:{
   theme:{type:String,value:'dark'},
   active:{type:Boolean,value:false},
   authorized:{type:Boolean,value:false},
   user:{type:Object,value:null}
  },
  data:Object.assign({copy:C.copy,C,error:'',busy:false},spec.data),
  methods
 };
}
module.exports={tab};
