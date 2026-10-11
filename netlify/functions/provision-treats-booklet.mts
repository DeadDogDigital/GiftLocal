import crypto from "node:crypto";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

function safeEqual(a, b) {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Netlify.env.get("SANTA_TREATS_PROVISION_SECRET");
  const supplied = request.headers.get("x-santa-provision-secret");
  if (!secret || !safeEqual(secret, supplied)) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Netlify.env.get("SUPABASE_URL") || "https://atewdukqcmsamcdcdrvx.supabase.co";
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Treats server configuration is incomplete" }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const bookingRef = typeof body?.booking_ref === "string" ? body.booking_ref.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookingRef)) {
    return json({ error: "A valid opaque booking reference is required" }, 400);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
  async function db(path, options = {}) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    const text = await response.text();
    let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error("Treats database request failed");
    return data;
  }

  try {
    const campaignRows = await db("campaigns?select=id,ends_at&slug=eq.santas-local-treats-hexham&status=eq.active&limit=1", { headers });
    if (!campaignRows?.length) return json({ error: "The Santa Treats campaign is not active" }, 409);
    const campaign = campaignRows[0];

    const existing = await db("booklets?select=id,access_token,campaign_id,source_booking_ref&source_booking_ref=eq." + encodeURIComponent(bookingRef) + "&limit=1", { headers });
    if (existing?.length) {
      if (existing[0].campaign_id !== campaign.id) return json({ error: "Booking reference is already linked to a different campaign" }, 409);
      return json({ ok: true, created: false, booklet_id: existing[0].id, access_token: existing[0].access_token });
    }

    const created = await db("booklets", {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({ campaign_id: campaign.id, source_booking_ref: bookingRef, expires_at: campaign.ends_at })
    });
    if (created?.length) {
      return json({ ok: true, created: true, booklet_id: created[0].id, access_token: created[0].access_token });
    }

    // Concurrent webhook retries can race; fetch the unique winner instead of creating another booklet.
    const winner = await db("booklets?select=id,access_token,campaign_id,source_booking_ref&source_booking_ref=eq." + encodeURIComponent(bookingRef) + "&limit=1", { headers });
    if (winner?.length && winner[0].campaign_id === campaign.id) {
      return json({ ok: true, created: false, booklet_id: winner[0].id, access_token: winner[0].access_token });
    }
    return json({ error: "Could not provision the booklet" }, 500);
  } catch {
    return json({ error: "Treats booklet provisioning failed" }, 500);
  }
};

export const config = { path: "/api/provision-treats-booklet" };
