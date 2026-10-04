const SUPABASE_URL = process.env.SUPABASE_URL || "https://atewdukqcmsamcdcdrvx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1IouD0L-dhVbFlDtSYSXow_Q3OvIJor";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { name, body } = await request.json();

    if (!name || !/^[a-z_]+$/.test(name)) {
      return new Response(JSON.stringify({ error: "Invalid RPC name." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body || {})
    });

    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error?.message || "RPC proxy failed."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
