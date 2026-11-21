// Geometry only: never reads identity or performs a network request.
function metrics(){
 let info={},capsule=null;try{info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync?wx.getSystemInfoSync():{}}catch(e){}
 const width=Number(info.windowWidth)||375,status=Math.max(0,Number(info.statusBarHeight)||24);
 try{capsule=wx.getMenuButtonBoundingClientRect&&wx.getMenuButtonBoundingClientRect()}catch(e){}
 const valid=capsule&&capsule.left>width/2&&capsule.top>=status&&capsule.height>=24&&capsule.height<=48&&capsule.bottom<=status+80;
 const top=valid?capsule.top:status+6,height=valid?capsule.height:32,navHeight=Math.max(status+44,top+height+8),side=valid?Math.max(80,width-capsule.left+8):96;
 return {navHeight,brandTop:top,brandHeight:height,brandSide:Math.min(side,(width-90)/2)};
}
module.exports={metrics};
