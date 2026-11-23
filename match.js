(function(global){
'use strict';
const keys=['rust','natuur','cultuur','voorzieningen'];
const defaults={rust:5,natuur:5,cultuur:4,voorzieningen:2};
function calculate(place,weights=defaults){
 const indicators=place.match_indicators||{};let numerator=0,denominator=0,allWeight=0;const details=[];
 for(const key of keys){
  const weight=Math.max(0,Math.min(5,Number(weights[key])||0));allWeight+=weight;
  const item=indicators[key]||{},score=Number(item.score);
  const available=item.score!==null&&item.score!==undefined&&Number.isFinite(score);
  if(available&&weight){numerator+=weight*Math.max(0,Math.min(100,score));denominator+=weight}
  details.push({key,weight,score:available?score:null,method:item.method||'Geen brongegevens',confirmed:item.confirmed||[],nearest_km:item.nearest_km});
 }
 const coverage=allWeight?Math.round(denominator/allWeight*100):0;
 const score=denominator?Math.round(numerator/denominator):null;
 return {score,coverage,provisional:coverage<85,details};
}
global.CamperScoutMatch={calculate,defaults,keys};
})(typeof window!=='undefined'?window:globalThis);
