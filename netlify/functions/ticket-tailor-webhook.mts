import crypto from "node:crypto";

const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

function verifySignature(raw,header,secret){
  if(!header||!secret)return false;
  const parts=Object.fromEntries(header.split(",").map(p=>p.split("=")));
  const timestamp=parts.t;
  const signature=parts.v1;
  if(!timestamp||!signature)return false;
  const age=Math.abs(Date.now()/1000-Number(timestamp));
  if(!Number.isFinite(age)||age>300)return false;
  const expected=crypto.createHmac("sha256",secret).update(timestamp+raw).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}

async function supabase(path,options={}){
  const url=Netlify.env.get("SUPABASE_URL");
  const key=Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)throw new Error("Supabase server configuration is incomplete.");
  const r=await fetch(url+"/rest/v1/"+path,{
    ...options,
    headers:{
      apikey:key,
      Authorization:"Bearer "+key,
      "Content-Type":"application/json",
      Prefer:"return=representation",
      ...(options.headers||{})
    }
  });
  const text=await r.text();
  let data;try{data=JSON.parse(text)}catch{data=text}
  if(!r.ok)throw new Error(typeof data==="string"?data:(data.message||data.hint||"Supabase request failed"));
  return data;
}

function questionMap(questions=[]){
  return Object.fromEntries((questions||[]).map(q=>[(q.question||"").trim().toLowerCase(),q.answer??""]));
}

export default async (req)=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const raw=await req.text();
  if(!verifySignature(raw,req.headers.get("Tickettailor-Webhook-Signature"),Netlify.env.get("TICKET_TAILOR_WEBHOOK_SECRET"))){
    return json({error:"Invalid webhook signature"},401);
  }

  let hook;
  try{hook=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400);}

  const existing=await supabase("ticket_tailor_webhook_events?select=id,processed_at&webhook_id=eq."+encodeURIComponent(hook.id));
  if(existing.length&&existing[0].processed_at)return json({ok:true,duplicate:true});

  await supabase("ticket_tailor_webhook_events",{
    method:"POST",
    body:JSON.stringify({webhook_id:hook.id,event:hook.event||"UNKNOWN",resource_url:hook.resource_url||null,payload:hook.payload||{},processed_at:null})
  });

  const order=hook.payload||{};
  if(!order.id)return json({ok:true,ignored:true});

  if(hook.event==="ORDER.UPDATED" && order.status==="cancelled"){
    await supabase("santa_bookings?ticket_tailor_order_id=eq."+encodeURIComponent(order.id),{
      method:"PATCH",
      body:JSON.stringify({status:"cancelled",updated_at:new Date().toISOString()})
    });
    return json({ok:true,cancelled:true});
  }

  if(hook.event!=="ORDER.CREATED" && hook.event!=="ORDER.UPDATED")return json({ok:true,ignored:true});

  const campaign=(await supabase("campaigns?slug=eq.santas-local-treats-hexham&select=id&limit=1"))[0];
  if(!campaign)throw new Error("Santa's Local Treats campaign not found.");

  const buyer=order.buyer_details||{};
  const qs=questionMap(buyer.custom_questions||[]);
  const start=order.event_summary?.start_date?.iso||null;

  const existingBooking=await supabase("santa_bookings?ticket_tailor_order_id=eq."+encodeURIComponent(order.id)+"&select=id,booklet_id&limit=1");

  let booklet;
  if(existingBooking.length){
    booklet=(await supabase("booklets?id=eq."+encodeURIComponent(existingBooking[0].booklet_id)+"&select=id&limit=1"))[0];
  }else{
    booklet=(await supabase("booklets",{
      method:"POST",
      body:JSON.stringify({campaign_id:campaign.id,expires_at:order.event_summary?.end_date?.iso||null})
    }))[0];
  }

  const bookingPayload={
    ticket_tailor_order_id:order.id,
    ticket_tailor_event_id:order.event_summary?.event_id||order.event_summary?.id||null,
    event_name:order.event_summary?.name||null,
    visit_starts_at:start,
    parent_first_name:buyer.first_name||null,
    parent_last_name:buyer.last_name||null,
    parent_email:buyer.email||null,
    parent_phone:buyer.phone||null,
    status:order.status==="cancelled"?"cancelled":"confirmed",
    booklet_id:booklet.id,
    raw_payload:order
  };

  let booking;
  if(existingBooking.length){
    booking=(await supabase("santa_bookings?id=eq."+encodeURIComponent(existingBooking[0].id),{method:"PATCH",body:JSON.stringify({...bookingPayload,updated_at:new Date().toISOString()})}))[0];
  }else{
    booking=(await supabase("santa_bookings",{method:"POST",body:JSON.stringify(bookingPayload)}))[0];
  }

  const tickets=order.issued_tickets||[];
  const children=tickets.map((t)=>({
    booking_id:booking.id,
    ticket_tailor_ticket_id:t.id,
    first_name:t.first_name||qs["child first name"]||"Guest",
    age:null,
    interests:qs["child interests"]||null,
    santa_notes:qs["anything santa should mention"]||null
  }));

  if(children.length && !existingBooking.length)await supabase("santa_children",{method:"POST",body:JSON.stringify(children)});

  await supabase("ticket_tailor_webhook_events?webhook_id=eq."+encodeURIComponent(hook.id),{
    method:"PATCH",
    body:JSON.stringify({processed_at:new Date().toISOString()})
  });

  return json({ok:true,booking_id:booking.id,booklet_id:booklet.id});
};

export const config={path:"/api/ticket-tailor-webhook"};