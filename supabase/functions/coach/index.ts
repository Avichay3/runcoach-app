import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ALLOWED_ORIGIN = "*"

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return json({ error: "missing ANTHROPIC_API_KEY secret" }, 500)
    }

    const { messages, system } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages required" }, 400)
    }

    const cleaned = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content }))

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: typeof system === "string" ? system : undefined,
        messages: cleaned,
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return json({ error: "claude_error", detail: errText }, 502)
    }

    const data = await resp.json()
    const reply = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
      : ""

    return json({ reply })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}
