'use strict';
(function(root){
  const core={
    intervalDelay(dt,speed){
      if (!Number.isFinite(dt)||!Number.isFinite(speed)||dt<=0||speed<=0) throw new Error('Invalid replay timing');
      return dt*1000/speed;
    },
    replayIndex(index,length){return Math.min(length-1,Math.max(0,Math.round(index)));},
    sceneState(row,cfg){return {eclipse:!row.sunlit,hot:row.temperature_k>cfg.high_temperature_k,
      lowBattery:row.battery_pct<25,link:row.comms_up,solar:row.solar_w>0,
      safe:row.mode==='safe'||row.operating_mode==='SAFE_MODE',yaw:row.pointing_error_deg*Math.PI/180};}
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  else root.LabUI=core;
})(typeof window==='undefined'?globalThis:window);
