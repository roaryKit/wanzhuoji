// Navigation to one of the four tab views hosted by the shell page (no native tabBar).
const MAIN='pages/main/index',TABS=['home','plaza','wines','settings'];
function url(tab){return '/'+MAIN+'?tab='+(TABS.indexOf(tab)>=0?tab:'home')}
function toTab(tab){
 const pages=typeof getCurrentPages==='function'?getCurrentPages():[];
 let index=-1;
 for(let i=pages.length-1;i>=0;i--)if(pages[i]&&pages[i].route===MAIN){index=i;break}
 if(index<0)return wx.reLaunch({url:url(tab)});
 const shell=pages[index];
 if(shell.showTab)shell.showTab(tab);
 const delta=pages.length-1-index;
 if(delta>0)wx.navigateBack({delta});
}
module.exports={MAIN,TABS,url,toTab};
