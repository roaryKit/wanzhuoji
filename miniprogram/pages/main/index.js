// Shell page: hosts the four tab views as components with a custom bottom bar.
// Switching only toggles `hidden`, so no native page transition (and no iOS container flash) happens.
const {page}=require('../../utils/page');
const C=require('../../utils/constants');
const TABS=[{key:'home',text:C.copy.tabHome,icon:'journal'},{key:'plaza',text:C.copy.tabPlaza,icon:'wind'},{key:'wines',text:C.copy.tabWines,icon:'glass'},{key:'settings',text:C.copy.tabSettings,icon:'gear'}];
const KEYS=TABS.map(t=>t.key);
function pick(t){return KEYS.indexOf(t)>=0?t:'home'}
Page(page({
 data:{tabs:TABS,tab:'home',visited:{},navHeight:68,brandTop:30,brandHeight:32,brandSide:96},
 onLoad(options){
  this._scroll={};this._scrollTop=0;this.setData(require('../../utils/main-top').metrics());
  const t=pick(options&&options.tab);
  const visited={};visited[t]=true;
  this.setData({tab:t,visited});
 },
 async onShow(){await this.activateTab()},
 onHide(){this.deactivateTab()},
 onUnload(){this.deactivateTab()},
 tabComponent(t){return this.selectComponent?this.selectComponent('#tab-'+(t||this.data.tab)):null},
 activateTab(attempt){
  const t=this.data.tab,c=this.tabComponent(t);
  if(c&&c.activate)return c.activate();
  attempt=attempt||0;
  if(attempt>=10)return;
  // The tab component may not be attached yet (first render / lazy mount); retry shortly.
  return new Promise(resolve=>setTimeout(resolve,16)).then(()=>{if(this.data.tab===t&&this.data.authorized)return this.activateTab(attempt+1)});
 },
 deactivateTab(t){const c=this.tabComponent(t);if(c&&c.deactivate)c.deactivate()},
 selectTab(e){this.showTab(e.currentTarget.dataset.tab)},
 showTab(t){
  t=pick(t);const prev=this.data.tab;
  if(t===prev)return;
  this.deactivateTab(prev);
  if(!this._scroll)this._scroll={};
  this._scroll[prev]=this._scrollTop||0;
  const target=this._scroll[t]||0;
  const patch={tab:t};patch['visited.'+t]=true;
  this.setData(patch,()=>{
   if(this.data.tab!==t)return;
   if(target!==(this._scrollTop||0)&&wx.pageScrollTo)wx.pageScrollTo({scrollTop:target,duration:0});
   this._scrollTop=target;
   if(this.data.authorized)this.activateTab();
  });
 },
 onResize(){this.setData(require('../../utils/main-top').metrics())},
 onPageScroll(e){this._scrollTop=e.scrollTop;const c=this.tabComponent();if(c&&c.onPageScroll)c.onPageScroll(e)},
 onReachBottom(){const c=this.tabComponent();if(c&&c.onReachBottom)return c.onReachBottom()},
 onRetry(){return this.onShow()},
 // 广场卡片的“转发”按钮（open-type=share）：分享落地到公开记录详情页；页面菜单分享回到首页。
 onShareAppMessage(res){const d=res&&res.from==='button'&&res.target&&res.target.dataset||{};if(d.id){const s={title:d.title||C.copy.shareTitle,path:'/pages/record-detail/index?from=plaza&id='+encodeURIComponent(d.id)};if(d.image)s.imageUrl=d.image;return s}return {title:C.copy.shareTitle,path:'/pages/main/index'}},
 onUser(e){if(e&&e.detail)this.setData({user:e.detail.user})}
}));
