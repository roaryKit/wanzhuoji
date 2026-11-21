// 个人资料（头像 + 昵称）的本地状态与首次互动提示。资料只经云函数 initUser(profile) 读写。
function current(){const app=getApp();const u=app&&app.globalData&&app.globalData.user;return (u&&u.profile)||null}
function set(p){const app=getApp();if(p&&app&&app.globalData&&app.globalData.user)app.globalData.user=Object.assign({},app.globalData.user,{profile:p});return p}
function needsPrompt(){const p=current();return !!p&&!p.prompted&&!p.hasProfile}
// 首次点赞/评论/公开发布前弹出一次资料设置（可跳过）；ctx 为包含 <profile-sheet id="profile-sheet"/> 的页面或组件。
async function ensure(ctx){if(!needsPrompt())return;const s=ctx&&ctx.selectComponent&&ctx.selectComponent('#profile-sheet');if(s&&s.ask)await s.ask()}
module.exports={current,set,needsPrompt,ensure};
