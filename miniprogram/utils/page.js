const C=require('./constants'),api=require('./cloud');
function revoke(app){api.reset();app.globalData.authRevision=(app.globalData.authRevision||0)+1;app.globalData.user=null;(typeof getCurrentPages==='function'?getCurrentPages():[]).forEach(p=>p.setData({authorized:false,user:null}));}
function guard(page){
 require('./theme').sync(page);
 if(page._guard)return page._guard;
 const app=getApp();if(!page.data)page.data={};
 const revision=app.globalData.authRevision||0;
 if(!api.validUser(app.globalData.user)||!app.globalData.user.ageConfirmed||app.globalData.user.ageDenied)page.setData({authorized:false});
 const pending=(async()=>{try{
 if(app.globalData.denied)throw Error(C.copy.initFailed);
 const r=await api.call('initUser');
 if(revision!==(app.globalData.authRevision||0))return false;
 if(!api.validUser(r.user)||app.globalData.denied||r.user.ageDenied||!r.user.ageConfirmed)throw Error(C.copy.initFailed);
 app.globalData.user=r.user;page.setData({user:r.user,authorized:true});return true;
 }catch(e){revoke(app);page.setData({error:C.copy.initFailed,authorized:false});wx.reLaunch({url:'/pages/age-gate/index'});return false}})();
 page._guard=pending;pending.finally(()=>{if(page._guard===pending)page._guard=null});return pending;
}
function page(spec){const show=spec.onShow,load=spec.onLoad,ready=spec.onReady,hide=spec.onHide,unload=spec.onUnload;return Object.assign({},spec,{data:require('./theme').track(Object.assign({copy:C.copy,C,...require('./theme').data(),error:'',busy:false,authorized:false},spec.data)),onReady(){require('./theme').sync(this);if(ready)return ready.call(this)},onLoad(options){require('./theme').sync(this);const app=getApp(),u=app.globalData.user;if(!app.globalData.denied&&api.validUser(u)&&u.ageConfirmed&&!u.ageDenied)this.setData({authorized:true,user:u});if(load)return load.call(this,options)},onHide(){this._showTask=null;this._showGeneration=(this._showGeneration||0)+1;if(hide)return hide.call(this)},onUnload(){this._showGeneration=(this._showGeneration||0)+1;if(unload)return unload.call(this)},onShow(){if(this._showTask)return this._showTask;const generation=this._showGeneration||0;const task=(async()=>{if(await guard(this)){if(generation!==(this._showGeneration||0))return;if(this.data.error)this.setData({error:''});this._inShow=true;try{if(show)await show.call(this);this._loadedOnce=true}finally{this._inShow=false}}})();this._showTask=task;task.finally(()=>{if(this._showTask===task)this._showTask=null});return task;},async run(fn){if(this.data.busy||this._running)return;const quiet=!!(this._inShow&&this._loadedOnce);this._running=true;if(!quiet){this.setData({busy:true,error:''});wx.showLoading({title:'请稍候'})}try{return await fn()}catch(e){this.setData({error:C.copy.failed});api.error(e)}finally{this._running=false;if(!quiet){wx.hideLoading();this.setData({busy:false})}}},go(e){wx.navigateTo({url:e.currentTarget.dataset.url})}})}
module.exports={page,guard};
