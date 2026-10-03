const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

function msg(t){$("#authMsg").textContent=t;$("#authMsg").classList.remove("hidden")}
async function load(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){$("#auth").classList.remove("hidden");$("#app").classList.add("hidden");return}
 $("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#userEmail").textContent=user.email||"Signed in";
 await Promise.all([campaigns(),businesses(),offers(),bookings()]);
}
async function campaigns(){
 const {data,error}=await sb.from("campaigns").select("*").order("created_at");
 if(error)return msg(error.message);
 $("#campaigns").innerHTML=(data||[]).map(c=>'<div class="row"><div><strong>'+esc(c.name)+'</strong><div class="muted">'+esc(c.slug)+' · '+esc(c.status)+'</div></div><div>'+new Date(c.starts_at).toLocaleDateString("en-GB")+' – '+new Date(c.ends_at).toLocaleDateString("en-GB")+'</div></div>').join("")||'<p class="muted">No campaigns.</p>';
 $("#oCampaign").innerHTML=(data||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join("");
}
async function businesses(){
 const {data,error}=await sb.from("businesses").select("*").order("name");
 if(error)return msg(error.message);
 $("#businesses").innerHTML=(data||[]).map(b=>'<div class="row"><div><strong>'+esc(b.name)+'</strong><div class="muted">'+esc(b.category||"")+'</div></div><div class="muted">'+esc(b.contact_email||"")+'</div></div>').join("")||'<p class="muted">No businesses.</p>';
 $("#oBusiness").innerHTML=(data||[]).map(b=>'<option value="'+b.id+'">'+esc(b.name)+'</option>').join("");
}
async function offers(){
 const {data,error}=await sb.from("offers").select("*,businesses(name),campaigns(name)").order("created_at",{ascending:false});
 if(error)return msg(error.message);
 $("#offers").innerHTML=(data||[]).map(o=>'<div class="row"><div><strong>'+esc(o.title)+'</strong><div class="muted">'+esc(o.businesses?.name||"")+' · '+esc(o.campaigns?.name||"")+'</div></div><div>'+ (o.active?"Active":"Off")+'</div></div>').join("")||'<p class="muted">No offers.</p>';
}
async function bookings(){
 const {data,error}=await sb.from("santa_bookings").select("*,santa_children(*)").order("visit_starts_at");
 if(error)return msg(error.message);
 $("#bookings").innerHTML=(data||[]).map(b=>'<div class="row"><div><strong>'+esc(b.parent_first_name||"")+" "+esc(b.parent_last_name||"")+'</strong><div class="muted">'+esc(b.parent_email||"")+' · '+(b.visit_starts_at?new Date(b.visit_starts_at).toLocaleString("en-GB"):"")+'</div><div>'+((b.santa_children||[]).map(c=>esc(c.first_name)+(c.age!=null?" ("+c.age+")":"")).join(", ")||"No child details yet")+'</div></div><div>'+esc(b.status)+'</div></div>').join("")||'<p class="muted">No bookings yet.</p>';
}
$("#signup").onclick=async()=>{const email=$("#email").value.trim();const password=$("#password").value;if(!email||password.length<8)return msg("Enter an email and a password of at least 8 characters.");const {error}=await sb.auth.signUp({email,password});if(error)msg(error.message);else msg("Account created. If email confirmation is enabled, confirm your email, then sign in.")};
$("#login").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)msg(error.message);else load()};
$("#logout").onclick=async()=>{await sb.auth.signOut();load()};
$("#createCampaign").onclick=async()=>{
 const {error}=await sb.from("campaigns").insert({name:$("#cName").value,slug:$("#cSlug").value,town:"Hexham",starts_at:new Date($("#cStart").value).toISOString(),ends_at:new Date($("#cEnd").value).toISOString(),status:"draft"});
 if(error)msg(error.message);else campaigns();
};
$("#createBusiness").onclick=async()=>{
 const name=$("#bName").value.trim(); if(!name)return;
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const {error}=await sb.from("businesses").insert({name,slug,town:"Hexham",category:$("#bCategory").value,contact_name:$("#bContact").value,contact_email:$("#bEmail").value});
 if(error)msg(error.message);else{["bName","bCategory","bContact","bEmail"].forEach(id=>$("#"+id).value="");businesses()}
};
$("#createOffer").onclick=async()=>{
 const {error}=await sb.from("offers").insert({campaign_id:$("#oCampaign").value,business_id:$("#oBusiness").value,title:$("#oTitle").value,description:$("#oDescription").value,terms:$("#oTerms").value,active:true});
 if(error)msg(error.message);else{["oTitle","oDescription","oTerms"].forEach(id=>$("#"+id).value="");offers()}
};
load();