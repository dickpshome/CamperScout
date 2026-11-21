const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];
const memory = new Map();
const json = (body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export default async function handler(request){
  if(request.method!=='POST')return json({error:'Gebruik POST om camperplaatsen op te halen.'},405);
  let input;try{input=await request.json()}catch{return json({error:'Ongeldige JSON'},400)}
  const lat=Number(input.lat),lon=Number(input.lon),radius=Number(input.radius);
  if(![lat,lon,radius].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180||radius<1000||radius>75000)return json({error:'Ongeldige zoekcoördinaten'},400);
  const key=`${lat.toFixed(3)}:${lon.toFixed(3)}:${radius}`;
  const previous=memory.get(key);
  if(previous && Date.now()-previous.time<30*60*1000)return json({...previous.data,source:'server-cache'});
  const query=`[out:json][timeout:18];(nwr["tourism"="caravan_site"](around:${radius},${lat},${lon});nwr["tourism"="camp_site"](around:${radius},${lat},${lon}););out center 250;`;
  const diagnostics=[];
  // A bounded attempt per server; never rely on one unreliable public endpoint.
  for(const server of SERVERS){
    const started=Date.now();
    try{
      const response=await fetch(server,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Accept':'application/json'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(6500)});
      if(!response.ok){diagnostics.push({server:new URL(server).hostname,status:response.status,ms:Date.now()-started});continue}
      const payload=await response.json();
      if(!Array.isArray(payload.elements)){diagnostics.push({server:new URL(server).hostname,error:'ongeldig antwoord',ms:Date.now()-started});continue}
      const result={elements:payload.elements,source:new URL(server).hostname};
      memory.set(key,{data:result,time:Date.now()});
      if(memory.size>50)memory.delete(memory.keys().next().value);
      console.log('CamperScout Overpass success',JSON.stringify({server:result.source,count:payload.elements.length,ms:Date.now()-started}));
      return json(result);
    }catch(error){diagnostics.push({server:new URL(server).hostname,error:error.name==='TimeoutError'?'timeout':String(error.message).slice(0,100),ms:Date.now()-started})}
  }
  console.error('CamperScout Overpass failure',JSON.stringify(diagnostics));
  if(previous)return json({...previous.data,source:'server-cache-stale',warning:'De gegevensservers zijn niet bereikbaar; eerder gevonden resultaten worden getoond.'});
  return json({error:'Geen van de openbare kaartgegevensservers reageerde met bruikbare gegevens.',diagnostics},503);
}
export const config={path:'/api/places'};
