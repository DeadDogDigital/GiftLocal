const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";
const codeEl=document.querySelector("#code");
const check=document.querySelector("#check");
const result=document.querySelector("#result");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const pathMatch=location.pathname.match(/^\/redeem\/([^/]+)/i);
const urlCode=pathMatch?.[1]||new URLSearchParams(location.search).get("code");
if(urlCode)codeEl.value=decodeURIComponent(urlCode).toUpperCase();

async function rpc(name,body){
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{
    method:"POST",
    headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const text=await r.text(); let d; try{d=JSON.parse(text)}catch{d={error:text}};
  if(!r.ok)throw new Error(d.message||d.error||"Request failed");
  return d;
}
async function validate(code){return rpc("validate_redemption",{p_redemption_code:code});}
async function confirm(code){return rpc("confirm_redemption",{p_redemption_code:code});}

function render(d,code){
  if(!d.valid){
    result.className="result card invalid";
    result.innerHTML="<div class='status' style='color:var(--red)'>Not valid</div><h2>This treat isn't available</h2><p>It may already have been redeemed, or the 10-minute reservation may have expired.</p>";
  }else{
    result.className="result card valid";
    result.innerHTML=
      "<div class='status'>✓ Ready to redeem</div>"+
      "<h2>"+esc(d.offer.title)+"</h2>"+
      "<p><strong>"+esc(d.business.name)+"</strong></p>"+
      (d.offer.description?"<p>"+esc(d.offer.description)+"</p>":"")+
      (d.offer.terms?"<p class='meta'>"+esc(d.offer.terms)+"</p>":"")+
      "<div class='code'>"+esc(d.redemption_code)+"</div>"+
      "<button class='confirm-business' id='confirmRedemption'>Confirm redemption</button>"+
      "<p class='meta'>The offer should be applied before you confirm.</p>";
    document.querySelector("#confirmRedemption").onclick=async()=>{
      const b=document.querySelector("#confirmRedemption");
      b.disabled=true;b.textContent="Confirming…";
      try{
        const done=await confirm(code);
        if(!done.success)throw new Error(done.message||"This treat is no longer available.");
        result.innerHTML=
          "<div class='status'>✓ REDEMPTION COMPLETE</div>"+
          "<h2>"+esc(d.offer.title)+"</h2>"+
          "<p><strong>"+esc(d.business.name)+"</strong></p>"+
          "<div class='code'>"+esc(done.redemption_code)+"</div>"+
          "<p class='meta'>Confirmed "+new Date(done.redeemed_at).toLocaleString("en-GB")+"</p>";
      }catch(e){
        b.disabled=false;b.textContent="Confirm redemption";alert(e.message);
      }
    };
  }
  result.classList.remove("hidden");
}
async function run(){
  const code=codeEl.value.trim().toUpperCase();
  if(!code){codeEl.focus();return}
  check.disabled=true;check.textContent="Checking…";result.classList.add("hidden");
  try{render(await validate(code),code)}
  catch(e){result.className="result card invalid";result.innerHTML="<div class='status' style='color:var(--red)'>Error</div><p>"+esc(e.message)+"</p>";result.classList.remove("hidden")}
  finally{check.disabled=false;check.textContent="Check treat"}
}
check.onclick=run;
codeEl.addEventListener("keydown",e=>{if(e.key==="Enter")run()});
if(urlCode)run();
