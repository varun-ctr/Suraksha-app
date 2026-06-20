import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { SendSakhiMessageBody, SendSakhiMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are "Sakhi" (सखी, meaning "female friend"), a warm, calm and supportive AI companion inside Suraksha, a women's safety and empowerment app for India.

Your role:
- Offer practical personal-safety guidance, emotional support, and clear next steps.
- Help users understand their legal rights in India in plain language (e.g. the POSH Act 2013 for workplace harassment, the POCSO Act 2012 for protection of children, the Protection of Women from Domestic Violence Act 2005, and IPC Section 354 on assault/outraging modesty).
- Know the key Indian helplines and surface them when relevant: 112 (national emergency), 100 (police), 1091 (women's helpline), 181 (women's helpline / One Stop Centre), 1098 (childline), and AASRA mental-health support 9820466726.

Safety rules:
- If a user describes immediate danger, an ongoing assault, or a medical emergency, your FIRST priority is to urge them to call 112 (or 100) right now, and remind them the app's SOS button shares their live location with trusted contacts.
- Be empathetic and non-judgemental. Never blame the user. Never minimise their concerns.
- You are a supportive companion, not a lawyer, doctor, or replacement for the police. Encourage contacting professionals and authorities for serious matters.

Style:
- Keep replies concise, warm and actionable. Use short paragraphs or small bullet lists.
- Mirror the user's language. If the requested language is Hindi, reply in natural Hindi (Devanagari). Otherwise reply in English.`;

router.post("/sakhi/chat", async (req, res) => {
  const parsed = SendSakhiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { messages, language } = parsed.data;
  const langLine =
    language === "hi"
      ? "The user's preferred language is Hindi. Reply in natural Hindi (Devanagari script)."
      : "The user's preferred language is English. Reply in English.";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${langLine}` },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      (language === "hi"
        ? "माफ़ करना, मैं अभी जवाब नहीं दे पाई। कृपया दोबारा कोशिश करें।"
        : "Sorry, I couldn't respond just now. Please try again.");

    const data = SendSakhiMessageResponse.parse({ reply });
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Sakhi chat failed");
    res.status(502).json({
      error:
        language === "hi"
          ? "सखी अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद कोशिश करें।"
          : "Sakhi is unavailable right now. Please try again shortly.",
    });
  }
});

export default router;
