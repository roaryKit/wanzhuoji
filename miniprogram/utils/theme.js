// Theme preference: 'system' (default, follows the WeChat/phone dark mode), 'light' or 'dark'.
// The local preference is the paint authority; cloud initialization must never delay it.
const MODES=['system','light','dark'];
const BG={light:'#F3EBE0',dark:'#110E0F'};
function normalize(value){return value==='light'?'light':'dark'}
function mode(){try{const saved=wx.getStorageSync&&wx.getStorageSync('themeMode');if(MODES.indexOf(saved)>=0)return saved}catch(e){}return 'system'}
function system(){
 try{if(wx.getAppBaseInfo){const t=wx.getAppBaseInfo().theme;if(t==='light'||t==='dark')return t}}catch(e){}
 try{if(wx.getSystemInfoSync){const t=wx.getSystemInfoSync().theme;if(t==='light'||t==='dark')return t}}catch(e){}
 try{const g=getApp().globalData;if(g.systemTheme==='light'||g.systemTheme==='dark')return g.systemTheme;return normalize(g.theme)}catch(e){return 'dark'}
}
function resolve(m){return m==='light'||m==='dark'?m:system()}
function current(){return resolve(mode())}
function data(theme=current()){theme=normalize(theme);return {theme,pageBackground:BG[theme]}}
let lastTheme,lastWx,painted=new WeakMap(),launchTheme;
function reset(){lastTheme=undefined;launchTheme=undefined;painted=new WeakMap()}
function native(theme=current(),target){
 if(lastWx!==wx){lastWx=wx;reset()}
 const light=theme==='light',backgroundColor=light?BG.light:BG.dark;
 const pageChanged=target?painted.get(target)!==theme:launchTheme!==theme;
 if(pageChanged){
  if(wx.setBackgroundColor)wx.setBackgroundColor({backgroundColor,backgroundColorTop:backgroundColor,backgroundColorBottom:backgroundColor});
  if(wx.setBackgroundTextStyle)wx.setBackgroundTextStyle({textStyle:light?'dark':'light'});
  if(target)painted.set(target,theme);else launchTheme=theme;
 }
 if(lastTheme!==theme){
  if(wx.setNavigationBarColor)wx.setNavigationBarColor({frontColor:light?'#000000':'#ffffff',backgroundColor});
  lastTheme=theme;
 }
}
function sync(page){const state=data();if(!page.data||page.data.theme!==state.theme||page.data.pageBackground!==state.pageBackground)page.setData(state);native(state.theme,page);return state.theme}
const specs=[];function track(d){specs.push(d);return d}
function paint(theme){
 const next=data(theme);specs.forEach(d=>Object.assign(d,next));
 try{getApp().globalData.theme=next.theme}catch(e){}
 const pages=typeof getCurrentPages==='function'?getCurrentPages():[];
 pages.forEach(p=>p.setData(data(next.theme)));native(next.theme,pages.slice(-1)[0]);
 return next.theme;
}
// Save a preference ('system' | 'light' | 'dark'; a bare theme name is accepted as before) and repaint immediately.
function apply(value){
 const m=MODES.indexOf(value)>=0?value:normalize(value);
 if(wx.setStorageSync)wx.setStorageSync('themeMode',m);
 try{getApp().globalData.themeMode=m}catch(e){}
 return paint(resolve(m));
}
// Phone/WeChat dark mode changed (wx.onThemeChange). WeChat repaints native bars from theme.json,
// so drop the native de-duplication and repaint with the effective theme.
function onSystemChange(theme){
 try{if(theme==='light'||theme==='dark')getApp().globalData.systemTheme=theme}catch(e){}
 reset();
 return paint(current());
}
module.exports={MODES,apply,native,current,data,sync,track,mode,system,resolve,onSystemChange};
