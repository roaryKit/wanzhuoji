const api=require('../../utils/cloud'),C=require('../../utils/constants'),nav=require('../../utils/nav');
Page({data:{copy:C.copy,...require('../../utils/theme').data(),denied:false,busy:false,ready:false,error:''},
onReady(){require('../../utils/theme').sync(this)},onLoad(){require('../../utils/theme').sync(this)},
async onShow(){require('../../utils/theme').sync(this);this.setData({denied:getApp().globalData.denied});if(!this.data.denied)await this.initialize()},
async initialize(){if(this.data.busy)return;this.setData({busy:true,ready:false,error:''});getApp().globalData.user=null;try{const r=await api.call('initUser');if(getApp().globalData.denied||r.user.ageDenied){this.markDenied();return}this.setData({ready:true});if(r.user.ageConfirmed){getApp().globalData.user=r.user;wx.reLaunch({url:nav.url('home')})}}catch(e){this.setData({error:api.initError(e)})}finally{this.setData({busy:false})}},
markDenied(){getApp().globalData.denied=true;getApp().globalData.user=null;wx.setStorageSync('ageDenied',true);this.setData({denied:true,ready:false,error:''})},
async confirm(){if(this.data.denied||this.data.busy||!this.data.ready)return;this.setData({busy:true,error:''});try{const r=await api.call('initUser',{action:'confirmAge',confirm:true});if(getApp().globalData.denied||r.user.ageDenied||r.user.ageConfirmed!==true)throw Error('unconfirmed');getApp().globalData.user=r.user;wx.reLaunch({url:nav.url('home')})}catch(e){this.setData({error:api.initError(e),ready:false})}finally{this.setData({busy:false})}},
async deny(){this.markDenied();try{await api.call('initUser',{action:'denyAge'})}catch(e){/* 本地拒绝立即生效，云失败也不开放入口。 */}}
});
