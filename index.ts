// Medera Akademi — yapay zekâ aracısı (Supabase Edge Function)
// API anahtarı burada, sunucuda kalır; tarayıcıya hiç gönderilmez.
// Gerekli gizli değişken:  ANTHROPIC_API_KEY
// İsteğe bağlı:            ANTHROPIC_MODEL (varsayılan aşağıda), ALLOWED_ORIGIN (örn. https://kullanici.github.io)

const ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Yalnızca POST" }, 405);

  // Yalnızca giriş yapmış kullanıcılar
  // (Yeni "publishable" anahtarlarla da çalışması için istemcinin gönderdiği apikey kullanılır)
  const apikey = Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "";
  const who = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { Authorization: req.headers.get("Authorization") ?? "", apikey },
  });
  if (!who.ok) return json({ error: "Oturum gerekli" }, 401);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "Sunucuda ANTHROPIC_API_KEY tanımlı değil" }, 500);

  let body: { system?: string; messages?: { role: string; content: string }[]; stream?: boolean; max_tokens?: number };
  try { body = await req.json(); } catch { return json({ error: "Geçersiz istek" }, 400); }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));
  if (!messages.length || messages[0].role !== "user") return json({ error: "Mesaj yok" }, 400);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: Math.min(Math.max(body.max_tokens ?? 2000, 100), 8000),
      system: (body.system ?? "").slice(0, 8000) || undefined,
      messages,
      stream: !!body.stream,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error("Anthropic error", upstream.status, text);
    return json({ error: upstream.status === 429 ? "Çok fazla istek" : "Yapay zekâ servisi hata verdi" }, upstream.status === 429 ? 429 : 502);
  }

  if (body.stream) {
    return new Response(upstream.body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }
  const data = await upstream.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  return json({ text });
});
