const SUPABASE_URL="https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY="sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function msg(t){const el=$("#authMsg");el.textContent=t;el.classList.remove("hidden");}
function status(t){let el=$("#adminMsg");if(!el){el=document.createElement("div");el.id="adminMsg";el.className="notice";$("#app").prepend(el);}el.textContent=t;el.classList.remove("hidden");}
async function load(){
 const {data:{user}}=await sb.auth.getUser();
 if(!user){$("#auth").classList.remove("hidden");$("#app").classList.add("hidden");return;}
 $("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#userEmail").textContent=user.email||"Signed in";
 await Promise.all([campaigns(),businesses(),offers(),booklets()]);
}

let bookletOffset=0;
const bookletPageSize=5;
let bookletSearchTerm="";
let bookletHasMore=false;
async function booklets(reset=true){
 const el=$("#bookletsList"), count=$("#bookletCount"), more=$("#loadMoreBooklets");
 if(reset)bookletOffset=0;
 el.innerHTML=reset?'<p class="muted">Loading booklets…</p>':el.innerHTML;
 const search=$("#bookletSearch")?.value.trim()||"";
 bookletSearchTerm=search;
 let query=sb.from("booklets").select("id,access_token,status,created_at,expires_at,family_surname,source_booking_ref,campaigns(name)").order("created_at",{ascending:false}).range(bookletOffset,bookletOffset+bookletPageSize-1);
 if(search)query=query.ilike("family_surname","%"+search.replace(/[%_]/g,"\\$&")+"%");
 const {data,error}=await query;
 if(error){if(reset)el.innerHTML="";count.innerHTML='<span class="danger">Could not load booklets: '+esc(error.message)+'</span>';more.classList.add("hidden");return;}
 const rows=data||[];
 bookletHasMore=rows.length===bookletPageSize;
 if(reset)el.innerHTML="";
 const markup=rows.map(b=>{
  const link=location.origin+"/treats/"+encodeURIComponent(b.access_token);
  const label=b.family_surname?esc(b.family_surname)+" family":"Family booklet";
  const date=b.created_at?new Date(b.created_at).toLocaleDateString("en-GB"):"Date unknown";
  const expiry=b.expires_at?"Expires "+new Date(b.expires_at).toLocaleDateString("en-GB"):"No expiry";
  return '<div class="booklet-row"><div class="meta"><strong>'+label+'</strong><div class="muted">Created '+esc(date)+' · '+esc(b.status||"active")+' · '+esc(expiry)+'</div></div><div class="actions"><button type="button" class="secondary" data-copy-booklet="'+esc(b.id)+'">Copy link</button><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">Open ↗</a></div></div>';
 }).join("");
 el.insertAdjacentHTML("beforeend",markup);
 const shown=bookletOffset+rows.length;
 count.textContent=(search?'Search results':'Latest booklets')+' · showing '+shown+(bookletHasMore?' or more':' total on this view');
 more.classList.toggle("hidden",!bookletHasMore);
 more.textContent="Load more booklets";
 el.querySelectorAll("[data-copy-booklet]").forEach(button=>button.onclick=async()=>{
  const id=button.dataset.copyBooklet;
  const {data:b,error:fetchError}=await sb.from("booklets").select("access_token").eq("id",id).single();
  if(fetchError||!b){status("Could not retrieve booklet link.");return;}
  const link=location.origin+"/treats/"+encodeURIComponent(b.access_token);
  try{await navigator.clipboard.writeText(link);}
  catch{const field=document.createElement("textarea");field.value=link;document.body.appendChild(field);field.select();document.execCommand("copy");field.remove();}
  button.textContent="Copied";setTimeout(()=>button.textContent="Copy link",1800);
 });
 bookletOffset+=rows.length;
}
async function campaigns(){
 const {data,error}=await sb.from("campaigns").select("*").order("created_at");
 if(error)return status("Could not load campaigns: "+error.message);
 $("#campaigns").innerHTML=(data||[]).map(c=>'<div class="row"><div><strong>'+esc(c.name)+'</strong><div class="muted">'+esc(c.slug)+' · '+esc(c.status)+'</div></div><div>'+new Date(c.starts_at).toLocaleDateString("en-GB")+' – '+new Date(c.ends_at).toLocaleDateString("en-GB")+'</div></div>').join("")||'<p class="muted">No campaigns.</p>';
 $("#oCampaign").innerHTML=(data||[]).map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join("");
}
async function businesses(){
 const {data,error}=await sb.from("businesses").select("*").order("name");
 if(error)return status("Could not load businesses: "+error.message);
 $("#businesses").innerHTML=(data||[]).map(b=>'<div class="row"><div><strong>'+esc(b.name)+'</strong><div class="muted">'+esc(b.category||"")+' · '+esc(b.onboarding_status||"prospect")+' · '+(b.active?"Active":"Paused")+'</div><div class="muted">'+esc(b.contact_email||"")+'</div></div><div><button class="secondary" onclick="editBusiness(\''+b.id+'\')">Edit</button> <button class="secondary" onclick="toggleBusiness(\''+b.id+'\','+(b.active?"false":"true")+')">'+(b.active?"Pause":"Activate")+'</button></div></div>').join("")||'<p class="muted">No businesses.</p>';
 $("#oBusiness").innerHTML=(data||[]).map(b=>'<option value="'+b.id+'">'+esc(b.name)+(b.active?"":" (paused)")+'</option>').join("");
}
async function offers(){
 const {data,error}=await sb.from("offers").select("*,businesses(name),campaigns(name)").order("created_at",{ascending:false});
 if(error)return status("Could not load offers: "+error.message);
 $("#offers").innerHTML=(data||[]).map(o=>'<div class="row"><div><strong>'+esc(o.title)+'</strong><div class="muted">'+esc(o.businesses?.name||"")+' · '+esc(o.campaigns?.name||"")+'</div><div class="muted">'+(o.active?"Active":"Paused")+'</div></div><div><button class="secondary" onclick="editOffer(\''+o.id+'\')">Edit</button> <button class="secondary" onclick="toggleOffer(\''+o.id+'\','+(o.active?"false":"true")+')">'+(o.active?"Pause":"Activate")+'</button></div></div>').join("")||'<p class="muted">No offers.</p>';
}
window.editBusiness=async id=>{
 const {data:b,error}=await sb.from("businesses").select("*").eq("id",id).single();if(error)return status("Could not open business: "+error.message);
 const name=prompt("Business name:",b.name);if(name===null)return;if(!name.trim())return status("Business name cannot be blank.");
 const category=prompt("Category:",b.category||"");if(category===null)return;
 const contact_name=prompt("Contact name:",b.contact_name||"");if(contact_name===null)return;
 const contact_email=prompt("Contact email:",b.contact_email||"");if(contact_email===null)return;
 const contact_phone=prompt("Contact phone:",b.contact_phone||"");if(contact_phone===null)return;
 const address=prompt("Address:",b.address||"");if(address===null)return;
 const website_url=prompt("Website URL:",b.website_url||"");if(website_url===null)return;
 const onboarding_status=prompt("Status (prospect, contacted, offer_pending, ready, live, paused):",b.onboarding_status||"prospect");if(onboarding_status===null)return;
 if(!["prospect","contacted","offer_pending","ready","live","paused"].includes(onboarding_status.trim()))return status("Invalid status. No changes saved.");
 const slug=name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const {error:saveError}=await sb.from("businesses").update({name:name.trim(),slug,category,contact_name,contact_email,contact_phone,address,website_url,onboarding_status:onboarding_status.trim()}).eq("id",id);
 if(saveError)return status("Business update failed: "+saveError.message);status("Business updated.");await businesses();
};
window.toggleBusiness=async(id,active)=>{
 if(!confirm("Are you sure you want to "+(active?"activate":"pause")+" this business?"))return;
 const {error}=await sb.from("businesses").update({active}).eq("id",id);if(error)return status("Business status change failed: "+error.message);
 status("Business "+(active?"activated":"paused")+".");await businesses();
};
window.editOffer=async id=>{
 const {data:o,error}=await sb.from("offers").select("*").eq("id",id).single();if(error)return status("Could not open offer: "+error.message);
 const title=prompt("Offer title:",o.title);if(title===null)return;if(!title.trim())return status("Offer title cannot be blank.");
 const description=prompt("Offer description:",o.description||"");if(description===null)return;
 const terms=prompt("Offer terms:",o.terms||"");if(terms===null)return;
 const valid_from=prompt("Valid from (YYYY-MM-DD; leave blank to keep unchanged):",o.valid_from||"");if(valid_from===null)return;
 const valid_until=prompt("Valid until (YYYY-MM-DD; leave blank to keep unchanged):",o.valid_until||"");if(valid_until===null)return;
 const updates={title:title.trim(),description,terms};
 if(valid_from.trim())updates.valid_from=valid_from.trim();if(valid_until.trim())updates.valid_until=valid_until.trim();
 const {error:saveError}=await sb.from("offers").update(updates).eq("id",id);if(saveError)return status("Offer update failed: "+saveError.message);
 status("Offer updated.");await offers();
};
window.toggleOffer=async(id,active)=>{
 if(!confirm("Are you sure you want to "+(active?"activate":"pause")+" this offer?"))return;
 const {error}=await sb.from("offers").update({active}).eq("id",id);if(error)return status("Offer status change failed: "+error.message);
 status("Offer "+(active?"activated":"paused")+".");await offers();
};
$("#signup").onclick=async()=>{const email=$("#email").value.trim();const password=$("#password").value;if(!email||password.length<8)return msg("Enter an email and a password of at least 8 characters.");const {error}=await sb.auth.signUp({email,password});if(error)msg(error.message);else msg("Account created. If email confirmation is enabled, confirm your email, then sign in.");};
$("#login").onclick=async()=>{const {error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)msg(error.message);else load();};
$("#logout").onclick=async()=>{await sb.auth.signOut();load();};
$("#createCampaign").onclick=async()=>{
 const {error}=await sb.from("campaigns").insert({name:$("#cName").value,slug:$("#cSlug").value,town:"Hexham",starts_at:new Date($("#cStart").value).toISOString(),ends_at:new Date($("#cEnd").value).toISOString(),status:"draft"});
 if(error)return status("Campaign creation failed: "+error.message);status("Campaign created.");await campaigns();
};
$("#createBusiness").onclick=async()=>{
 const name=$("#bName").value.trim();if(!name)return status("Enter a business name first.");
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const {error}=await sb.from("businesses").insert({name,slug,town:"Hexham",category:$("#bCategory").value,contact_name:$("#bContact").value,contact_email:$("#bEmail").value,contact_phone:$("#bPhone").value,address:$("#bAddress").value,website_url:$("#bWebsite").value,onboarding_status:"prospect",active:false});
 if(error)return status("Business creation failed: "+error.message);
 ["bName","bCategory","bContact","bEmail","bPhone","bAddress","bWebsite"].forEach(id=>$("#"+id).value="");status("Business added.");await businesses();
};
$("#createOffer").onclick=async()=>{
 if(!$("#oCampaign").value||!$("#oBusiness").value)return status("Choose a campaign and business first.");
 const {error}=await sb.from("offers").insert({campaign_id:$("#oCampaign").value,business_id:$("#oBusiness").value,title:$("#oTitle").value,description:$("#oDescription").value,terms:$("#oTerms").value,active:true});
 if(error)return status("Offer creation failed: "+error.message);
 ["oTitle","oDescription","oTerms"].forEach(id=>$("#"+id).value="");status("Offer created.");await offers();
};

$("#createManualBooklet").onclick=async()=>{
 const surname=$("#manualSurname").value.trim();
 const button=$("#createManualBooklet");
 const result=$("#manualBookletResult");
 button.disabled=true;button.textContent="Creating…";
 result.classList.add("hidden");
 try{
  const {data,error}=await sb.rpc("create_manual_treats_booklet",{p_family_surname:surname||null});
  if(error)throw error;
  if(!data?.ok||!data?.access_token)throw new Error("The booklet could not be created.");
  const link=location.origin+"/treats/"+encodeURIComponent(data.access_token);
  result.innerHTML="<strong>Extra booklet created.</strong><p>Share this personal link with the family:</p><p><a href=\""+esc(link)+"\" target=\"_blank\" rel=\"noopener noreferrer\">"+esc(link)+"</a></p><button type=\"button\" id=\"copyManualBooklet\" class=\"secondary\">Copy booklet link</button>";
  result.classList.remove("hidden");
  $("#copyManualBooklet").onclick=async()=>{
   try{await navigator.clipboard.writeText(link);$("#copyManualBooklet").textContent="Link copied";}
   catch{const field=document.createElement("input");field.value=link;result.appendChild(field);field.select();document.execCommand("copy");field.remove();$("#copyManualBooklet").textContent="Link copied";}
  };
  $("#manualSurname").value="";
  status("Extra Treats booklet created and saved to the Treats booklets list.");await booklets();
 }catch(e){status("Could not create extra booklet: "+(e.message||"Please try again."));}
 finally{button.disabled=false;button.textContent="Create extra booklet";}
};

$("#searchBooklets").onclick=()=>booklets(true);
$("#clearBookletSearch").onclick=()=>{$("#bookletSearch").value="";booklets(true);};
$("#bookletSearch").addEventListener("keydown",e=>{if(e.key==="Enter")booklets(true);});
$("#loadMoreBooklets").onclick=()=>booklets(false);
load();
