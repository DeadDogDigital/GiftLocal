const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";
const params=new URLSearchParams(location.search);
const pathMatch=location.pathname.match(/^\/treats\/([^/]+)/i);
const token=params.get("token")||pathMatch?.[1]||params.get("t");

const $=s=>document.querySelector(s);

function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function date(v){return new Date(v).toLocaleDateString("en-GB",{day:"numeric",month:"long"});}
function error(msg){
  $("#loading").classList.add("hidden");
  $("#booklet").classList.add("hidden");
  $("#errorText").textContent=msg;
  $("#error").classList.remove("hidden");
}
async function rpc(name,body){
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const text=await r.text();
  let data; try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok)throw new Error(data?.message||data?.error||String(data)||"Request failed");
  return data;
}

function showConfirm(offer,button){
  const existing=document.querySelector("#confirmDialog");
  if(existing)existing.remove();
  const dialog=document.createElement("div");
  dialog.id="confirmDialog";
  dialog.innerHTML=
    '<div class="confirm-backdrop"></div>'+
    '<div class="confirm-card" role="dialog" aria-modal="true">'+
      '<div class="gift">🎁</div>'+
      '<p class="eyebrow">READY TO CLAIM YOUR TREAT?</p>'+
      '<h2>'+esc(offer.title)+'</h2>'+
      '<p>Only continue when you are with the business and ready to show them the QR code.</p>'+
      '<p><strong>The treat will be reserved for 10 minutes.</strong></p>'+
      '<div class="confirm-actions"><button class="cancel">Not yet</button><button class="confirm">Show my QR code</button></div>'+
    '</div>';
  document.body.appendChild(dialog);
  dialog.querySelector(".cancel").onclick=()=>dialog.remove();
  dialog.querySelector(".confirm").onclick=async()=>{dialog.remove();await redeem(offer.id,button)};
}

async function load(){
  if(!token)return error("This Treat Booklet link is incomplete.");
  try{
    const data=await rpc("get_booklet",{p_access_token:token});
    const campaign=data.campaign||{};
    const offers=data.offers||[];
    $("#campaignName").textContent=campaign.name||"Your treats";
    $("#campaignDescription").textContent=campaign.description||"Enjoy a few treats from local Hexham businesses.";

    $("#offers").innerHTML=offers.length?offers.map(o=>{
      const biz=o.business||{};
      const r=o.redemption;
      const pending=r&&r.status==="pending";
      const redeemed=r&&r.status==="redeemed";
      let action="";
      if(redeemed){
        action='<div class="badge">Treat redeemed</div>';
      }else if(pending){
        action='<div class="badge">Ready to show</div><div class="show-code"><strong>SHOW THIS QR CODE TO THE BUSINESS</strong></div><div class="qr-wrap"><canvas id="qr-'+o.id+'"></canvas></div><div class="code">'+esc(r.redemption_code)+'</div><p class="meta qr-help">The business scans this code. Your treat is reserved for 10 minutes.</p><button class="fallback-redeem" data-fallback="'+o.id+'">Business: redeem on this phone</button><p class="meta fallback-help">Use this if the business can't get a signal to scan the QR. Your phone needs an internet connection.</p>';
      }else{
        action='<button data-offer="'+o.id+'">Use this treat</button>';
      }
      return '<article class="offer '+(r?"used":"")+'">'+
        '<div class="business">'+esc(biz.name||"Hexham business")+'</div>'+
        '<h3>'+esc(o.title)+'</h3>'+
        '<p>'+esc(o.description||"A little something from Santa.")+'</p>'+
        (o.terms?'<div class="meta">'+esc(o.terms)+'</div>':"")+
        '<div class="meta">Valid until '+date(o.valid_until||campaign.ends_at)+'</div>'+
        action+
      '</article>';
    }).join(""):'<div class="card state"><p>No treats are currently available.</p></div>';

    document.querySelectorAll("[data-offer]").forEach(b=>b.onclick=()=>showConfirm(offers.find(o=>o.id===b.dataset.offer)||{title:"this treat"},b));
    document.querySelectorAll("[data-fallback]").forEach(b=>b.onclick=()=>fallbackConfirm(offers.find(o=>o.id===b.dataset.fallback)||{title:"this treat"}));

    for(const o of offers){
      const r=o.redemption;
      if(r&&r.status==="pending"){
        const canvas=document.querySelector("#qr-"+o.id);
        if(canvas&&typeof qrcode==="function"){
          const url=location.origin+"/business.html?code="+encodeURIComponent(r.redemption_code);
          const qr=qrcode(0,"M");
          qr.addData(url);
          qr.make();
          const img=document.createElement("img");
          img.alt="Scan to redeem this treat";
          img.width=230;
          img.height=230;
          img.src=qr.createDataURL(6,0);
          canvas.replaceWith(img);
        }
      }
    }

    $("#loading").classList.add("hidden");
    $("#booklet").classList.remove("hidden");
  }catch(e){error(e.message||"We couldn't open your treats.");}
}

function fallbackConfirm(offer){
  const existing=document.querySelector("#fallbackDialog");
  if(existing)existing.remove();
  const dialog=document.createElement("div");
  dialog.id="fallbackDialog";
  dialog.innerHTML=
    '<div class="confirm-backdrop"></div>'+
    '<div class="confirm-card" role="dialog" aria-modal="true">'+
      '<div class="gift">📱</div>'+
      '<p class="eyebrow">BUSINESS REDEMPTION</p>'+
      '<h2>'+esc(offer.title)+'</h2>'+
      '<p>The business should only continue after applying the offer.</p>'+
      '<p><strong>This will redeem the treat now.</strong></p>'+
      '<div class="confirm-actions"><button class="cancel">Not yet</button><button class="confirm">Redeem this treat</button></div>'+
    '</div>';
  document.body.appendChild(dialog);
  dialog.querySelector(".cancel").onclick=()=>dialog.remove();
  dialog.querySelector(".confirm").onclick=async()=>{
    const b=dialog.querySelector(".confirm");
    b.disabled=true;b.textContent="Redeeming…";
    try{
      await rpc("confirm_redemption",{p_redemption_code:findPendingCode(offer.id)});
      dialog.remove();
      await load();
    }catch(e){b.disabled=false;b.textContent="Redeem this treat";alert(e.message||"This treat couldn't be redeemed.");}
  };
}
function findPendingCode(offerId){
  const article=document.querySelector("[data-fallback='"+offerId+"']")?.closest(".offer");
  return article?.querySelector(".code")?.textContent.trim();
}

async function redeem(offer,button){
  button.disabled=true;
  try{
    await rpc("redeem_offer",{p_access_token:token,p_offer_id:offer});
    await load();
    const used=document.querySelector(".used");
    if(used)window.scrollTo({top:used.offsetTop,behavior:"smooth"});
  }catch(e){
    alert(e.message||"That treat couldn't be prepared.");
    button.disabled=false;
  }
}
load();
