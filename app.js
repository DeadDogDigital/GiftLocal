const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";
const params=new URLSearchParams(location.search);
const pathMatch=location.pathname.match(/^\/treats\/([^/]+)/i);
const token=params.get("token")||pathMatch?.[1]||params.get("t");

const $=s=>document.querySelector(s);

function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function date(v){
  return new Date(v).toLocaleDateString("en-GB",{day:"numeric",month:"long"});
}

function error(msg){
  $("#loading").classList.add("hidden");
  $("#booklet").classList.add("hidden");
  $("#errorText").textContent=msg;
  $("#error").classList.remove("hidden");
}

async function rpc(name,body){
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:"Bearer "+SUPABASE_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify(body)
  });
  const text=await r.text();
  let data;
  try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok) throw new Error(data?.message||data?.error||String(data)||"Request failed");
  return data;
}

async function load(){
  if(!token)return error("This Treat Booklet link is incomplete.");
  try{
    const data=await rpc("get_booklet",{p_access_token:token});
    const campaign=data.campaign||{};
    const offers=data.offers||[];

    $("#campaignName").textContent=campaign.name||"Your treats";
    $("#campaignDescription").textContent=campaign.description||"Enjoy a few treats from local Hexham businesses.";

    $("#offers").innerHTML=offers.length
      ? offers.map(o=>{
          const biz=o.business||{};
          const r=o.redemption;
          return '<article class="offer '+(r?"used":"")+'">'+
            '<div class="business">'+esc(biz.name||"Hexham business")+'</div>'+
            '<h3>'+esc(o.title)+'</h3>'+
            '<p>'+esc(o.description||"A little something from Santa.")+'</p>'+
            (o.terms?'<div class="meta">'+esc(o.terms)+'</div>':"")+
            '<div class="meta">Valid until '+date(o.valid_until||campaign.ends_at)+'</div>'+
            (r
              ? '<div class="badge">Treat used</div><div class="code">'+esc(r.redemption_code)+'</div>'
              : '<button data-offer="'+o.id+'">Use this treat</button>')+
          '</article>';
        }).join("")
      : '<div class="card state"><p>No treats are currently available.</p></div>';

    document.querySelectorAll("[data-offer]").forEach(b=>b.onclick=()=>redeem(b.dataset.offer,b));
    $("#loading").classList.add("hidden");
    $("#booklet").classList.remove("hidden");
  }catch(e){
    error(e.message||"We couldn't open your treats.");
  }
}

async function redeem(offer,button){
  if(!confirm("Use this treat now? It can only be used once."))return;
  button.disabled=true;
  try{
    await rpc("redeem_offer",{p_access_token:token,p_offer_id:offer});
    await load();
  }catch(e){
    alert(e.message||"That treat couldn't be used.");
    button.disabled=false;
  }
}

load();