const {tab}=require('../../utils/tab'),api=require('../../utils/cloud');
const view=require('../../utils/view');
Component(tab({cacheScope:'home',data:{rows:[],stats:{},next:null,more:true,me:{},loading:false},
// 首屏返回本月统计；历史记录只在下滑时逐页取，不再后台全量下载全部照片 URL。
refresh(){return this.load(true)},
methods:{
load(refresh=false){return require('../../utils/feed').load(this,{area:'home',home:true,name:'submitRecord',query:()=>({action:'list'})},refresh)},
async onReachBottom(){return this.load()},
open(e){wx.navigateTo({url:'/pages/record-detail/index?id='+e.detail.id})},
export(e){wx.navigateTo({url:'/pages/export/index?id='+e.detail.id})}
}}));
