const {tab}=require('../../utils/tab'),api=require('../../utils/cloud');
const theme=require('../../utils/theme'),C=require('../../utils/constants');
function label(m){return C.copy.themeModes[theme.MODES.indexOf(m)]||C.copy.themeModes[0]}
Component(tab({
data:{themeMode:'system',themeLabel:C.copy.themeModes[0],profile:{}},
refresh(){const p=require('../../utils/profile').current()||{};if(p!==this.data.profile)this.setData({profile:p});const m=theme.mode();if(m!==this.data.themeMode||label(m)!==this.data.themeLabel)this.setData({themeMode:m,themeLabel:label(m)})},
methods:{
// Theme preference: 跟随系统 / 浅色 / 深色. Paints immediately and persists locally; the cloud copy is best effort with rollback.
async setThemeMode(value){const previous=theme.mode();if(theme.MODES.indexOf(value)<0||value===previous)return;theme.apply(value);this.setData({themeMode:value,themeLabel:label(value)});try{const r=await api.call('initUser',{action:'settings',theme:value});this.setUser(r.user)}catch(err){theme.apply(previous);this.setData({themeMode:previous,themeLabel:label(previous)});api.error(err)}},
async chooseTheme(){if(this.data.busy)return;let r;try{r=await wx.showActionSheet({itemList:C.copy.themeModes})}catch(e){return}await this.setThemeMode(theme.MODES[r.tapIndex])},
async setting(e){const key=e.currentTarget.dataset.key;if(key==='theme')return this.setThemeMode(e.detail.value);const value=key==='reminderOn'?e.detail.value:(e.detail.value?'public':'private');await this.run(async()=>{const r=await api.call('initUser',{action:'settings',[key]:value});this.setUser(r.user)})},
async clear(){if(this.data.busy)return;const r=await wx.showModal({title:C.copy.clearRow,content:C.copy.clearConfirm,confirmText:C.copy.clearConfirmText});if(!r.confirm)return;await this.run(async()=>{let n=0;while(true){const result=await api.call('clearMyData');if(result.done)break;if(++n>10000)throw Error('清理未完成，请重试')}getApp().globalData.user=null;wx.reLaunch({url:'/pages/age-gate/index'})})}
}}));
