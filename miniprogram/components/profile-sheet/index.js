// 首次点赞/评论/公开发布时的资料设置面板（微信头像昵称填写能力：chooseAvatar + type=nickname），可跳过。
const api=require('../../utils/cloud'),P=require('../../utils/profile'),C=require('../../utils/constants');
Component({options:{styleIsolation:'apply-shared'},data:{show:false,avatar:'',avatarPath:'',nickname:'',busy:false,copy:C.copy},
methods:{
ask(){const p=P.current()||{};this.setData({show:true,busy:false,avatar:p.avatarURL||'',avatarPath:'',nickname:p.nickname||''});return new Promise(resolve=>{this._done=resolve})},
close(){this.setData({show:false,busy:false});const d=this._done;this._done=null;if(d)d()},
chooseAvatar(e){const u=e&&e.detail&&e.detail.avatarUrl;if(u)this.setData({avatar:u,avatarPath:u})},
onNick(e){this.setData({nickname:(e&&e.detail&&e.detail.value)||''})},
async save(){if(this.data.busy)return;const nick=(this.data.nickname||'').trim();this.setData({busy:true});try{let p=null;if(this.data.avatarPath)p=(await api.uploadAvatar(this.data.avatarPath)).profile;if(nick&&(!p||p.nickname!==nick))p=(await api.call('initUser',{action:'profile',nickname:nick})).profile;if(!p)p=(await api.call('initUser',{action:'profile',prompted:true})).profile;P.set(p);this.close()}catch(err){this.setData({busy:false});api.error(err)}},
async skip(){if(this.data.busy)return;try{const r=await api.call('initUser',{action:'profile',prompted:true});P.set(r.profile)}catch(_){const p=P.current();if(p)P.set(Object.assign({},p,{prompted:true}))}this.close()},
noop(){}
}});
