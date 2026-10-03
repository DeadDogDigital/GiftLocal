const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";

const codeEl=document.querySelector("#code");
const check=document.querySelector("#check");
const result=document.querySelector("#result");

const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

async function validate(code){
  const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/validate_redemption",{
    method:"POST",
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:"Bearer "+SUPABASE_KEY,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({p_redemption_code:code})
  });
  const text=await r.text();
  let d;
  try{d=JSON.parse(text)}catch{d={error:text}}
  if(!r.ok)throw new Error(d.message||d.error||"Could not check the code.");
  return d;
}

async function run(){
  const code=codeEl.value.trim().toUpperCase();
  if(!code){codeEl.focus();return}

  check.disabled=true;
  check.textContent="Checking…";
  result.classList.add("hidden");

  try{
    const d=await validate(code);

    if(!d.valid){
      result.className="result card invalid";
      result.innerHTML="<div class='status' style='color:var(--red)'>Not valid</div><h2>We couldn't verify that treat</h2><p>Ask the customer to check the code and try again.</p>";
    }else{
      result.className="result card valid";
      result.innerHTML=
        "<div class='status'>✓ Valid redemption</div>"+
        "<h2>"+esc(d.offer.title)+"</h2>"+
        "<p><strong>"+esc(d.business.name)+"</strong></p>"+
        (d.offer.description?"<p>"+esc(d.offer.description)+"</p>":"")+
        (d.offer.terms?"<p class='meta'>"+esc(d.offer.terms)+"</p>":"")+
        "<div class='code'>"+esc(d.redemption_code)+"</div>"+
        "<p class='meta'>Redeemed "+new Date(d.redeemed_at).toLocaleString("en-GB")+"</p>";
    }

    result.classList.remove("hidden");
  }catch(e){
    result.className="result card invalid";
    result.innerHTML="<div class='status' style='color:var(--red)'>Error</div><p>"+esc(e.message)+"</p>";
    result.classList.remove("hidden");
  }finally{
    check.disabled=false;
    check.textContent="Check treat";
  }
}

check.onclick=run;
codeEl.addEventListener("keydown",e=>{if(e.key==="Enter")run()});
