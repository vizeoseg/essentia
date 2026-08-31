import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_ADDRESS = "Essentia Services <contact@essentia-services.fr>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, cc, subject, html, text, attachments } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Champs obligatoires manquants : to, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construire le corps HTML si non fourni
    const htmlBody = html || `<pre style="font-family:sans-serif;white-space:pre-wrap;">${text || ""}</pre>`;

    const resendBody: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlBody,
    };

    if (cc) resendBody.reply_to = Array.isArray(cc) ? cc[0] : cc;
    if (attachments && attachments.length > 0) resendBody.attachments = attachments;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[send-email] Resend error:", resendData);
      return new Response(
        JSON.stringify({ error: resendData.message || "Erreur Resend", details: resendData }),
        { status: resendRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ id: resendData.id, ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[send-email] Exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
