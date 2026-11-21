const C=require('../../utils/constants'),S=require('../../utils/stack');
Component({options:{styleIsolation:'apply-shared'},properties:{urls:Array,mode:{type:String,value:'card'}},data:{open:false,items:[],box:'',count:0,copy:C.copy},
observers:{'urls,mode':function(){this.build()}},lifetimes:{attached(){this.build()}},
methods:{state(open){const urls=(this.data.urls||[]).filter(Boolean).slice(0,3),n=urls.length;if(n<=1)return {open:false,count:n,items:urls.map(url=>({url,style:''})),box:''};const l=S.layout(n,this.data.mode,open);return {open,count:n,box:l.box,items:urls.map((url,i)=>({url,style:l.items[i]}))}},
build(){this.setData(this.state(false))},
// 展开/收起一次 setData 完成，并先通知父级同步切换正文布局，避免文字分两拍重排。
toggle(){if(this.data.count<2)return;const open=!this.data.open;this.triggerEvent('toggle',{open});this.setData(this.state(open))},
tapItem(e){const i=+e.currentTarget.dataset.index||0;if(this.data.count>1&&!this.data.open)return this.toggle();const urls=this.data.items.map(x=>x.url);if(urls[i])wx.previewImage({urls,current:urls[i]})}}});
