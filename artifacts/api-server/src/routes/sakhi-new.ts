import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SYSTEM_PROMPT = `You are "Sakhi" (सखी, meaning "female friend"), a warm, calm and supportive AI companion inside Suraksha, a women's safety and empowerment app for India.

Your role:
- Offer practical personal-safety guidance, emotional support, and clear next steps.
- Help users understand their legal rights in India in plain language (e.g. the POSH Act 2013 for workplace harassment, the POCSO Act 2012 for protection of children, the Protection of Women from Domestic Violence Act 2005, and IPC Section 354 on assault/outraging modesty).
- Know the key Indian helplines and surface them when relevant: 112 (national emergency), 100 (police), 1091 (women's helpline), 181 (women's helpline / One Stop Centre), 1098 (childline), and AASRA mental-health support 9820466627.

Safety rules:
- If a user describes immediate danger, an ongoing assault, or a medical emergency, your FIRST priority is to urge them to call 112 (or 100) right now, and remind them the app's SOS button shares their live location with trusted contacts.
- Be empathetic and non-judgemental. Never blame the user. Never minimise their concerns.
- You are a supportive companion, not a lawyer, doctor, or replacement for the police. Encourage contacting professionals and authorities for serious matters.

Style:
- Keep replies concise, warm and actionable. Use short paragraphs or small bullet lists.
- Mirror the user's language. If the requested language is Hindi, reply in natural Hindi (Devanagari). Otherwise reply in English.`;

router.post("/sakhi-chat", async (req: Request, res: Response) => {
  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "auth_required", message: "No auth token provided." });
    return;
  }

  const { data: userData, error: authError } = await serviceSupabase.auth.getUser(token);
  if (authError || !userData.user) {
    res.status(401).json({ error: "auth_required", message: "Invalid or expired token." });
    return;
  }

  const userId = userData.user.id;

  const { data: profile, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("is_premium, premium_until, sakhi_message_count")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    res.status(500).json({ error: "server", message: "Could not load user profile." });
    return;
  }

  const isPremiumActive =
    profile.is_premium &&
    (profile.premium_until === null || new Date(profile.premium_until) > new Date());

  if (!isPremiumActive && profile.sakhi_message_count >= 5) {
    res.status(402).json({
      error: "limit_reached",
      message: "You've used your 5 free Sakhi messages. Upgrade to Suraksha Premium for unlimited access.",
    });
    return;
  }

  const { messages, language } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[];
    language?: string;
  };

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "bad_request", message: "messages must be an array." });
    return;
  }

  const langLine =
    language === "hi"
      ? "The user's preferred language is Hindi. Reply in natural Hindi (Devanagari script)."
      : "The user's preferred language is English. Reply in English.";

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n${langLine}` },
          ...messages,
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      req.log?.error?.({ status: openaiRes.status, body: errText }, "OpenAI error");
      res.status(502).json({ error: "server", message: "AI service unavailable." });
      return;
    }

    const openaiData = (await openaiRes.json()) as {
      choices: { message: { content: string } }[];
    };
    const reply = openaiData.choices[0]?.message?.content?.trim() ?? "";

    await serviceSupabase
      .from("profiles")
      .update({ sakhi_message_count: profile.sakhi_message_count + 1 })
      .eq("id", userId);

    res.json({ reply });
  } catch (err) {
    req.log?.error?.({ err }, "Sakhi chat failed");
    res.status(502).json({ error: "server", message: "AI service unavailable." });
  }
});

export default router;
