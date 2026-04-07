/**
 * ============================================================================
 * GLOBESKIMMERS — getActivities v4.0
 * ============================================================================
 * Worldwide: landmarks, museums, parks, tours, nightlife, sports, beaches,
 * cultural experiences, theme parks, historic sites.
 * v3.0 changes:
 *  - safeLower() fix (r.text object crash)
 *  - Nearby search fallback when text search yields < 5 results
 *  - Wikipedia API integration for top 10 results
 *  - Review sentiment: highlights + warnings + bestTime
 *  - editorialSummary passthrough from Google
 *  - Audience detection: couples, seniors, pet-friendly
 * ============================================================================
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const WORKER = "https://globeskimmers-api.maizasimeon.workers.dev";
const TTL    = 60 * 60 * 6; // 6 hours

const QUERIES = [
  // Landmarks & Culture
  "tourist attraction","historic landmark","historic site","monument","heritage site",
  "museum","art gallery","cultural center","exhibition",
  // Nature & Outdoors
  "national park","nature reserve","botanical garden","wildlife sanctuary",
  "scenic viewpoint","hiking trail","beach","waterfall","lake",
  "forest trail","canyon","cave","volcano",
  "river","fishing spot","coral reef",
  "scenic drive","lighthouse",
  "bird sanctuary","campground","ancient ruins",
  // Entertainment
  "theme park","amusement park","water park","escape room",
  "live music venue","concert hall","theater","comedy club",
  "casino","bowling alley","arcade",
  // Tours & Experiences
  "guided tour","walking tour","food tour","bike tour","boat tour",
  "cooking class","cultural experience","local experience",
  // Sports & Adventure
  "sports complex","stadium","golf course","surfing",
  "rock climbing","zip line","skydiving","snorkeling","diving",
  // Wellness
  "spa","hot spring","onsen","hammam","bath house",
  // Nightlife
  "rooftop bar","night club","jazz bar","craft brewery","winery","distillery",
  // Family
  "zoo","aquarium","children's museum","mini golf","go kart",
];

// Nearby search types used as fallback when text search yields < 5 results
const NEARBY_TYPES = [
  'tourist_attraction','museum','park','amusement_park','zoo','aquarium',
  'art_gallery','bowling_alley','casino','night_club','spa','stadium',
  'movie_theater','campground',
];

const CATEGORY_NEARBY: Record<string,string[]> = {
  culture:       ['museum','art_gallery','tourist_attraction'],
  outdoor:       ['park','campground','tourist_attraction','natural_feature'],
  entertainment: ['amusement_park','bowling_alley','casino','movie_theater'],
  nightlife:     ['night_club','bar'],
  family:        ['zoo','aquarium','amusement_park'],
  wellness:      ['spa'],
  adventure:     ['park','campground','tourist_attraction'],
  tours:         ['tourist_attraction','museum'],
};

const SIG = {
  free:        ['free admission','free entry','no charge','no fee','free access','complimentary'],
  family:      ['family','kids','children','all ages','child-friendly','stroller'],
  outdoor:     ['outdoor','outside','open air','nature','trail',
               'hiking','forest','mountain','lake','river','waterfall','canyon','cave',
               'cliff','scenic','campground','wilderness','reef','snorkel','dive',
               'lighthouse','bird watching','wildlife','fishing','volcano'],
  indoor:      ['indoor','inside','air conditioned','museum','gallery','theater'],
  guided:      ['guided','tour guide','expert','led tour','docent','commentary'],
  bucket:      ['bucket list','must see','once in lifetime','world famous','iconic','legendary'],
  hidden:      ['hidden gem','off the beaten','secret','local secret','underrated','undiscovered'],
  photo:       ['photo','instagram','photogenic','beautiful','stunning views','scenic','panoramic'],
  adventure:   ['adventure','thrill','extreme','adrenaline','exciting','challenging'],
  cultural:    ['cultural','traditional','authentic','local','historic','heritage'],
  budget:      ['free','cheap','affordable','budget','inexpensive','worth every penny'],
  accessibility:['wheelchair','accessible','disabled','ada','mobility'],
  couples:     ['romantic','date','couples','honeymoon','anniversary','intimate','perfect for couples'],
  seniors:     ['senior','elderly','easy walk','gentle','leisurely','no stairs','slow pace'],
  petFriendly: ['dog friendly','pet friendly','dogs allowed','pets welcome','bring your dog'],
  highlights:  ['amazing','spectacular','breathtaking','incredible','beautiful','must visit','loved it','fantastic','perfect','outstanding','stunning','highly recommend','worth it'],
  warnings:    ['long line','wait time','crowded','expensive','overpriced','disappointing','avoid','rude','dirty','loud','overcrowded','parking issue','too hot','too cold'],
};

const NON_NATURE_TYPES = new Set([
  'museum','art_gallery','historical_landmark','monument','cemetery',
  'church','place_of_worship','city_hall','library','school','university',
  'shopping_mall','store','restaurant','cafe','lodging','hospital',
]);

const NATURE_TYPES = ['park','national_park','campground','natural_feature',
  'hiking_area','state_park','beach','ski_resort','marina'];

function safeLower(v:any):string{
  if(typeof v==='string') return v.toLowerCase();
  if(v==null) return '';
  if(typeof v==='object') return (v.text||'').toLowerCase();
  return String(v).toLowerCase();
}

function sc(t:string,k:string[]){return k.filter(w=>t.includes(w)).length;}
function km(la1:number,lo1:number,la2:number,lo2:number){
  const R=6371,dL=(la2-la1)*Math.PI/180,dN=(lo2-lo1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function activityType(name:string,types:string[]){
  const n=name.toLowerCase(); const t=types.join(' ');
  if(/museum|gallery|exhibit/.test(n)||/museum/.test(t))             return {icon:'🏛️',label:'Museum / Gallery',color:'#7C3AED',category:'culture'};
  if(/park|garden|nature|reserve|trail|forest|canyon|cave|waterfall|lake|river|volcano|lighthouse|campground|ruins/.test(n)||/park|natural_feature/.test(t)) return {icon:'🌳',label:'Nature & Outdoors',color:'#059669',category:'outdoor'};
  if(/beach|surf|reef|snorkel|dive|coast/.test(n)||/beach/.test(t))  return {icon:'🏖️',label:'Beach & Water',color:'#0891B2',category:'outdoor'};
  if(/theme park|amusement|water park/.test(n))                      return {icon:'🎢',label:'Theme Park',color:'#DC2626',category:'entertainment'};
  if(/zoo|aquarium|wildlife/.test(n)||/zoo/.test(t))                 return {icon:'🦁',label:'Zoo / Aquarium',color:'#D97706',category:'family'};
  if(/spa|hot spring|onsen|hammam|bath/.test(n))                     return {icon:'♨️',label:'Spa & Wellness',color:'#DB2777',category:'wellness'};
  if(/bar|club|nightlife|brewery|winery|distillery/.test(n))         return {icon:'🍻',label:'Nightlife',color:'#1D4ED8',category:'nightlife'};
  if(/tour|walking|food tour|experience/.test(n))                    return {icon:'🗺️',label:'Tours & Experiences',color:'#F59E0B',category:'tour'};
  if(/historic|heritage|monument|castle|temple|church|cathedral|mosque|shrine/.test(n)||/historical_landmark|place_of_worship/.test(t)) return {icon:'🏰',label:'Historic Site',color:'#92400E',category:'culture'};
  if(/sport|stadium|arena|gym|fitness/.test(n))                      return {icon:'🏟️',label:'Sports & Fitness',color:'#1D4ED8',category:'sport'};
  if(/adventure|climb|zip|surf|dive|skydive/.test(n))                return {icon:'🧗',label:'Adventure',color:'#DC2626',category:'adventure'};
  if(/cooking|class|workshop|lesson/.test(n))                        return {icon:'👨‍🍳',label:'Classes & Workshops',color:'#059669',category:'experience'};
  return {icon:'⭐',label:'Attraction',color:'#F59E0B',category:'attraction'};
}

async function fetchWiki(name:string):Promise<{wikiSummary:string,wikiExtract:string}|null>{
  try{
    const r=await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      {headers:{'User-Agent':'Globeskimmers/3.0 (travel app)'}}
    );
    if(!r.ok) return null;
    const d=await r.json();
    if(d.type==='disambiguation'||!d.extract) return null;
    return {wikiSummary:d.description||'',wikiExtract:d.extract.slice(0,400)};
  }catch{return null;}
}

Deno.serve(async (req)=>{
  try {
    const base44=createClientFromRequest(req);
    if(!await base44.auth.me()) return Response.json({error:'Unauthorized'},{status:401});
    const {latitude,longitude,radius=24140,maxResults=30,category='all',smartRadius=false,countryName='',regionName='',cityName=''}=await req.json();
    if(!latitude||!longitude) return Response.json({error:'Location required'},{status:400});

    const INNER_RADIUS=40234; // 25 miles in meters
    const useSmartRadius=smartRadius&&radius>INNER_RADIUS;

    const queries=category==='all'?QUERIES:QUERIES.filter(q=>{
      const map:Record<string,string[]>={
        culture:['museum','gallery','historic','monument','cultural','heritage'],
        outdoor:['national park','nature','beach','hiking','waterfall','forest','canyon','cave','volcano','river','fishing','reef','lighthouse','ruins','scenic','campground','bird','trail','lake','reserve','sanctuary','botanical'],
        entertainment:['theme park','escape room','casino','bowling','arcade'],
        nightlife:['bar','club','music','brewery','winery'],
        family:['zoo','aquarium','children','mini golf','go kart'],
        wellness:['spa','hot spring','onsen','hammam'],
        adventure:['adventure','climb','zip','surf','dive','skydive','snorkeling','rock climbing'],
        tours:['tour','experience','cooking class'],
      };
      return (map[category]||[]).some(k=>q.toLowerCase().includes(k));
    });

    const seen=new Set<string>(); const places:any[]=[];
    const searchRadius=useSmartRadius?INNER_RADIUS:radius;

    // Primary: text search (uses inner radius when smartRadius active)
    for(let i=0;i<queries.length;i+=3){
      await Promise.all(queries.slice(i,i+3).map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:String(searchRadius),maxResults:'10',cacheTtl:String(TTL)});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!seen.has(id)){seen.add(id);places.push(pl);}}
        }catch{}
      }));
    }

    // Fallback: nearby search when text search yielded < 5 results
    if(places.length<5){
      const nearbyTypes=(CATEGORY_NEARBY[category]||NEARBY_TYPES).slice(0,8);
      await Promise.all(nearbyTypes.map(async t=>{
        try{
          const p=new URLSearchParams({type:t,latitude:String(latitude),longitude:String(longitude),radius:String(searchRadius),maxResults:'10',cacheTtl:String(TTL)});
          const r=await fetch(`${WORKER}/places/nearby?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!seen.has(id)){seen.add(id);places.push(pl);}}
        }catch{}
      }));
    }

    // Smart Radius Pass 2: iconic spots at full radius (25-50mi zone)
    if(useSmartRadius){
      const iconicQueries=['tourist attraction','historic landmark','national park','theme park','amusement park','world heritage site','famous museum','iconic landmark'];
      for(let i=0;i<iconicQueries.length;i+=3){
        await Promise.all(iconicQueries.slice(i,i+3).map(async q=>{
          try{
            const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:String(radius),maxResults:'10',cacheTtl:String(TTL)});
            const r=await fetch(`${WORKER}/places/text-search?${p}`);
            if(!r.ok) return;
            for(const pl of (await r.json()).places||[]){
              const id=pl.id; if(!id||seen.has(id)) continue;
              // Only include iconic places beyond inner radius with high quality
              const plLat=pl.location?.latitude||0,plLng=pl.location?.longitude||0;
              const dist=km(latitude,longitude,plLat,plLng);
              const distMi=dist*0.621371;
              if(distMi>25&&(pl.rating>=4.5||(pl.rating>=4.0&&(pl.userRatingCount||0)>=500))){
                seen.add(id); places.push(pl);
              }
            }
          }catch{}
        }));
      }
      // Iconic nearby types at full radius
      const iconicNearby=['tourist_attraction','amusement_park','museum'];
      await Promise.all(iconicNearby.map(async t=>{
        try{
          const p=new URLSearchParams({type:t,latitude:String(latitude),longitude:String(longitude),radius:String(radius),maxResults:'10',cacheTtl:String(TTL)});
          const r=await fetch(`${WORKER}/places/nearby?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){
            const id=pl.id; if(!id||seen.has(id)) continue;
            const plLat=pl.location?.latitude||0,plLng=pl.location?.longitude||0;
            const dist=km(latitude,longitude,plLat,plLng);
            const distMi=dist*0.621371;
            if(distMi>25&&(pl.rating>=4.5||(pl.rating>=4.0&&(pl.userRatingCount||0)>=500))){
              seen.add(id); places.push(pl);
            }
          }
        }catch{}
      }));
    }

    // Filter out shrines, memorials, monuments — not real "things to do"
    const EXCLUDE_TYPES_SET = new Set(['cemetery','funeral_home']);
    const EXCLUDE_NAME_RE = /\bshrine\b|\bmemorial wall\b|\bplaque\b/i;
    const filterJunk=(arr:any[])=>arr.filter(p=>{
      const types=p.types||[];
      if(types.some((t:string)=>EXCLUDE_TYPES_SET.has(t))) return false;
      if(EXCLUDE_NAME_RE.test(p.displayName?.text||p.name||'')) return false;
      return true;
    });

    // Reusable: process raw Google place into enriched activity object
    const processPlace=(p:any)=>{
      const lat=p.location?.latitude||0,lng=p.location?.longitude||0;
      const d=km(latitude,longitude,lat,lng);
      const name=p.displayName?.text||p.name||'';
      const revArr=(p.reviews||[]).map((r:any)=>safeLower(r?.text?.text??r?.text??''));
      const rev=revArr.join(' ');
      const txt=`${name.toLowerCase()} ${rev}`;
      const placeTypes=p.types||[];
      const at=activityType(name,placeTypes);
      const isSmallFeature=/waterfall|fountain|pond|stream|creek/.test(name.toLowerCase());
      const isWilderness=placeTypes.some((t:string)=>['national_park','hiking_area','state_park','natural_feature'].includes(t));
      const isInsideManagedPark=placeTypes.some((t:string)=>['botanical_garden','amusement_park','zoo'].includes(t));
      const outdoorContext=isSmallFeature&&!isWilderness?'Walk-through inside a park':isSmallFeature&&isInsideManagedPark?'Managed Park / Walk-through':null;
      const photos=(p.photos||[]).map((ph:any)=>ph.url||ph).filter(Boolean).slice(0,2);
      const hours=p.currentOpeningHours?.weekdayDescriptions||p.regularOpeningHours?.weekdayDescriptions||p.hours||[];
      const editorialSummary=p.editorialSummary?.text||p.editorialSummary||'';
      const highlights=SIG.highlights.filter(w=>rev.includes(w)).slice(0,5);
      const warnings=SIG.warnings.filter(w=>rev.includes(w)).slice(0,4);
      const timeMatches=(rev.match(/\b(morning|afternoon|evening|sunrise|sunset|weekday|weekend|summer|winter|spring|fall|autumn|off.season)\b/gi)||[]);
      const bestTime=timeMatches.length>0?[...new Set(timeMatches.map((s:string)=>s.toLowerCase()))].slice(0,3).join(', '):'';
      const badges:string[]=[];
      if(sc(txt,SIG.bucket)>0)    badges.push('🏆 Bucket List');
      if(sc(txt,SIG.hidden)>0)    badges.push('💎 Hidden Gem');
      if(sc(txt,SIG.photo)>1)     badges.push('📸 Photo Worthy');
      if(sc(txt,SIG.free)>0)      badges.push('🆓 Free Entry');
      if(sc(txt,SIG.family)>0)    badges.push('👨‍👩‍👧 Family Friendly');
      if(sc(txt,SIG.adventure)>0) badges.push('⚡ Adventure');
      if(sc(txt,SIG.cultural)>1)  badges.push('🎭 Authentic Culture');
      let qs=50;
      if(p.rating>=4.5) qs+=25; else if(p.rating>=4.0) qs+=15;
      if(p.userRatingCount>1000) qs+=10; else if(p.userRatingCount>200) qs+=5;
      if(sc(txt,SIG.bucket)>0) qs+=10;
      if(sc(txt,SIG.photo)>0)  qs+=5;
      if(sc(txt,SIG.hidden)>0) qs+=5;
      return {
        id:p.id,placeId:p.id,displayName:p.displayName||{text:name},
        name,location:{latitude:lat,longitude:lng},lat,lng,
        formattedAddress:p.formattedAddress||'',shortFormattedAddress:p.shortFormattedAddress||'',
        distanceKm:d,distanceMiles:d*0.621371,distance:`${(d*0.621371).toFixed(1)} mi`,
        rating:p.rating||null,userRatingCount:p.userRatingCount||0,
        isOpen:p.isOpen??null,hours,
        currentOpeningHours:{openNow:p.isOpen,weekdayDescriptions:hours},
        photos,photoUrl:photos[0]||null,photoUrl2:photos[1]||null,
        nationalPhoneNumber:p.nationalPhoneNumber||'',
        websiteUri:p.websiteUri||'',googleMapsUri:p.googleMapsUri||'',
        activityIcon:at.icon,activityLabel:at.label,activityColor:at.color,activityCategory:at.category,
        editorialSummary,outdoorContext,types:placeTypes,
        badges,qualityScore:Math.min(qs,100),highlights,warnings,bestTime,
        props:{
          isFree:sc(txt,SIG.free)>0,isFamilyFriendly:p.goodForChildren===true||sc(txt,SIG.family)>0,
          isOutdoor:(()=>{if(placeTypes.some((t:string)=>NON_NATURE_TYPES.has(t)))return false;return placeTypes.some((t:string)=>NATURE_TYPES.includes(t))||sc(txt,SIG.outdoor)>=2||at.category==='outdoor';})(),
          isIndoor:sc(txt,SIG.indoor)>0,hasGuidedTour:sc(txt,SIG.guided)>0,
          isBucketList:sc(txt,SIG.bucket)>0,isHiddenGem:sc(txt,SIG.hidden)>0,
          isPhotoWorthy:sc(txt,SIG.photo)>1,isAdventure:sc(txt,SIG.adventure)>0,
          isCultural:sc(txt,SIG.cultural)>1,isAccessible:sc(txt,SIG.accessibility)>0,
          isBudgetFriendly:sc(txt,SIG.budget)>0,isGoodForCouples:sc(txt,SIG.couples)>0,
          isSeniorFriendly:sc(txt,SIG.seniors)>0,isPetFriendly:sc(txt,SIG.petFriendly)>0,
        },
      };
    };
    const popScore=(a:any)=>(a.rating||0)*Math.log10((a.userRatingCount||0)+1);

    // ── TIER 3: Nearby (existing search) ──────────────────────────────
    const nearbyFiltered=filterJunk(places);
    const nearby=nearbyFiltered.slice(0,60).map(processPlace);
    nearby.sort((a:any,b:any)=>b.qualityScore-a.qualityScore||(b.rating||0)-(a.rating||0));

    // ── TIER 1: National Icons (independent search, no dedup against nearby) ──
    let nationalIcons:any[]=[];
    {
      const t1Seen=new Set<string>();
      const t1Places:any[]=[];
      const cn=countryName||'nearby';
      const t1Queries=[`top tourist attractions in ${cn}`,`bucket list landmarks ${cn}`,`famous must see ${cn}`];
      await Promise.all(t1Queries.map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:'500000',maxResults:'20',cacheTtl:String(TTL)});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!t1Seen.has(id)){t1Seen.add(id);t1Places.push(pl);}}
        }catch{}
      }));
      const t1Processed=filterJunk(t1Places).map(processPlace)
        .filter((a:any)=>(a.rating||0)>=4.0&&(a.userRatingCount||0)>=100)
        .sort((a:any,b:any)=>popScore(b)-popScore(a))
        .slice(0,40);
      t1Processed.forEach((a:any)=>{
        const mi=a.distanceMiles;
        a.travelType=mi>200?'✈️ Flight / Ferry Required':mi>100?'🚗 Long Drive':mi>50?'🚗 Drive':'🚗 Short Drive';
        if(a.photos?.length>0) a.photos=[a.photos[0]];
      });
      nationalIcons=t1Processed;
    }

    // ── TIER 2: Regional Gems (dedup against Tier 1 only) ─────────────
    let regionalGems:any[]=[];
    {
      const t2Seen=new Set(nationalIcons.map((a:any)=>a.id));
      const t2Places:any[]=[];
      const rn=regionName||cityName||'nearby';
      const t2Queries=[`top attractions in ${rn}`,`things to do in ${rn}`,`best places to visit ${rn}`];
      await Promise.all(t2Queries.map(async q=>{
        try{
          const p=new URLSearchParams({query:q,latitude:String(latitude),longitude:String(longitude),radius:'160934',maxResults:'20',cacheTtl:String(TTL)});
          const r=await fetch(`${WORKER}/places/text-search?${p}`);
          if(!r.ok) return;
          for(const pl of (await r.json()).places||[]){const id=pl.id;if(id&&!t2Seen.has(id)){t2Seen.add(id);t2Places.push(pl);}}
        }catch{}
      }));
      const t2Processed=filterJunk(t2Places).map(processPlace)
        .filter((a:any)=>(a.rating||0)>=3.5)
        .sort((a:any,b:any)=>popScore(b)-popScore(a))
        .slice(0,20)
        .sort((a:any,b:any)=>(a.distanceMiles||0)-(b.distanceMiles||0)); // re-sort closest first
      t2Processed.forEach((a:any)=>{
        const mi=a.distanceMiles;
        a.travelType=mi>50?'🚗 Drive':mi>15?'🚗 Short Drive':'📍 Nearby';
        if(a.photos?.length>0) a.photos=[a.photos[0]];
      });
      regionalGems=t2Processed;
    }

    // Deduplicate nearby against Tier 1 & 2 (icons get priority)
    const iconIds=new Set([...nationalIcons.map((a:any)=>a.id),...regionalGems.map((a:any)=>a.id)]);
    const dedupedNearby=nearby.filter((a:any)=>!iconIds.has(a.id));

    // ── Wikipedia for all tiers ───────────────────────────────────────
    const allForWiki=[...dedupedNearby.slice(0,10),...nationalIcons,...regionalGems];
    await Promise.all(allForWiki.map(async (a:any)=>{
      const wiki=await fetchWiki(a.name);
      if(wiki){a.wikiSummary=wiki.wikiSummary;a.wikiExtract=wiki.wikiExtract;}
    }));

    const total=dedupedNearby.length+nationalIcons.length+regionalGems.length;
    return Response.json({activities:dedupedNearby,nationalIcons,regionalGems,count:total,version:'v5.0'});
  } catch(e:any){
    return Response.json({error:e.message,activities:[]},{status:200});
  }
});
