'use strict';
(function(root){
  const core={
    intervalDelay(dt,speed){
      if (!Number.isFinite(dt)||!Number.isFinite(speed)||dt<=0||speed<=0) throw new Error('Invalid replay timing');
      return dt*1000/speed;
    },
    replayIndex(index,length){return Math.min(length-1,Math.max(0,Math.round(index)));},
    inspectionState(row={},cfg={}){
      const finite=value=>Number.isFinite(value)?value:null;
      const watts=value=>Number.isFinite(value)&&value>=0?value:null;
      const clamp=value=>Math.max(0,Math.min(1,value));
      const batteryPct=finite(row.battery_pct),temperatureK=finite(row.temperature_k);
      const batteryFraction=batteryPct===null?null:clamp(batteryPct/100);
      const low=finite(cfg.low_temperature_k),high=finite(cfg.high_temperature_k);
      const temperatureFraction=temperatureK===null||low===null||high===null||high<=low?null:clamp((temperatureK-low)/(high-low));
      return {batteryPct,batteryFraction,temperatureK,temperatureFraction,
        temperatureLowK:low,temperatureHighK:high,
        solarW:watts(row.solar_w),servedW:watts(row.served_w),unservedW:watts(row.unserved_w),
        // Unit-height fill, anchored at -0.5. The renderer only scales this presentation geometry.
        batteryFill:batteryFraction===null?null:{fraction:batteryFraction,centerY:(batteryFraction-1)/2,halfHeight:batteryFraction/2}};
    },
    sceneState(row,cfg){return {eclipse:!row.sunlit,hot:row.temperature_k>cfg.high_temperature_k,
      lowBattery:row.battery_pct<25,link:row.comms_up,solar:row.solar_w>0,
      safe:row.mode==='safe'||row.operating_mode==='SAFE_MODE',yaw:row.pointing_error_deg*Math.PI/180};}
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=core;
  else root.LabUI=core;
})(typeof window==='undefined'?globalThis:window);
