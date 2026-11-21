// 照片叠放（类似聊天里的多图消息）：收起时一摞（露出旋转的层叠边缘 + 张数），展开时一排铺开。
// 纯函数，组件与浏览器校验共用。尺寸单位 rpx。
const M={card:{s:144,gap:12,big:150},detail:{s:180,gap:16,big:180}};
const LAYERS=[{r:0,x:0,y:0},{r:-7,x:-10,y:6},{r:6,x:12,y:-4}];
function st(o){return `left:${o.l}rpx;top:${o.t}rpx;width:${o.w}rpx;height:${o.w}rpx;z-index:${o.z};transform:translate(${o.x||0}rpx,${o.y||0}rpx) rotate(${o.r||0}deg)`}
function layout(n,mode,open){const m=M[mode]||M.card;n=Math.max(0,Math.min(3,n|0));
 if(open){const w=n*m.s+(n-1)*m.gap;return {box:`width:${w}rpx;height:${m.s}rpx`,items:Array.from({length:n},(_,i)=>st({l:i*(m.s+m.gap),t:0,w:m.s,z:10-i}))}}
 const pad=Math.round(m.big*0.12);// 照片靠右：负右外边距让最上面一张与右缘对齐；上下留出旋转边缘的空间，不压到相邻元素。
 return {box:`width:${m.big+pad*2}rpx;height:${m.big+pad*2}rpx;margin:-${Math.round(pad/2)}rpx -${pad}rpx 0 0`,items:Array.from({length:n},(_,i)=>st({l:pad,t:pad,w:m.big,z:10-i,...LAYERS[i]}))}}
module.exports={layout,M};
