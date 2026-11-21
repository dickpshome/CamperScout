const SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];
const cache = new Map();
export default async (request) => {
  if (request.method !== 'POST') return Response.json({error:'Method not allowed'}, {status:405});
  let body;
  try {body=await request.json()} catch {return Response.json({error:'Ongeldige aanvraag'}, {status:400})}
  const {lat,lon,radius}=body;
  if (![lat,lon,radius].every(Number.isFinite) || Math.abs(lat)>90 || Math.abs(lon)>180 || radius<1000 || radius>75000) return Response.json({error:'Ongeldige zoekcoördinaten'}, {status:400});
  const key=[lat.toFixed(2),lon.toFixed(2),radius].join(':');
  const old=cache.get(key);
  if(old && Date.now()-old.time<1800000) return Response.json(old.data);
  const query=`[out:json][timeout:22];(nwr["tourism"="caravan_site"](around:${radius},${lat},${lon});nwr["tourism"="camp_site"](around:${radius},${lat},${lon}););out center 250;`;
  for (const server of SERVERS) {
    try {
      const response=await fetch(server,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(8500)});
      if(!response.ok) continue;
      const data=await response.json();
      if(!Array.isArray(data.elements)) continue;
      cache.set(key,{time:Date.now(),data});
      if(cache.size>80) cache.delete(cache.keys().next().value);
      return Response.json(data,{headers:{'Cache-Control':'public, max-age=300, s-maxage=1800'}});
    } catch(e) {console.error('Overpass fallback',server,e.message)}
  }
  if(old) return Response.json(old.data);
  return Response.json({error:'Kaartgegevens tijdelijk niet bereikbaar. Probeer het later opnieuw.'},{status:503});
};
export const config = {path:'/api/places'};
