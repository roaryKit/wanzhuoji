// 个人资料：头像（chooseAvatar → 云存储直传 → 审核）、昵称（type=nickname → 文字审核）、广场匿名显示。
const {page}=require('../../utils/page'),api=require('../../utils/cloud'),P=require('../../utils/profile'),C=require('../../utils/constants');
function dirty(n,p){const t=(n||'').trim();return !!t&&t!==((p&&p.nickname)||'')}
Page(page({data:{profile:{},nickname:'',nickDirty:false},
async onShow(){await this.run(async()=>{const r=await api.call('initUser');const p=(r.user&&r.user.profile)||{};P.set(p);this.setData({profile:p,nickname:p.nickname||'',nickDirty:false})})},
apply(p){P.set(p);this.setData({profile:p,nickname:p.nickname||'',nickDirty:false})},
async chooseAvatar(e){const path=e&&e.detail&&e.detail.avatarUrl;if(!path)return;await this.run(async()=>{const r=await api.uploadAvatar(path);this.apply(r.profile);wx.showToast({title:C.copy.saved,icon:'none'})})},
onNick(e){const v=(e&&e.detail&&e.detail.value)||'';this.setData({nickname:v,nickDirty:dirty(v,this.data.profile)})},
async saveNick(){if(!this.data.nickDirty)return;await this.run(async()=>{const r=await api.call('initUser',{action:'profile',nickname:this.data.nickname.trim()});this.apply(r.profile);wx.showToast({title:C.copy.saved,icon:'none'})})},
async setAnon(e){const v=!!e.detail.value;await this.run(async()=>{const r=await api.call('initUser',{action:'profile',anonymous:v});this.apply(r.profile)})}}));
