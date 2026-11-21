const C=require('../../utils/constants');
Component({options:{styleIsolation:'apply-shared'},properties:{wine:Object,first:{type:Boolean,value:false}},data:{copy:C.copy},methods:{open(){this.triggerEvent('open',{id:this.data.wine._id})}}});
