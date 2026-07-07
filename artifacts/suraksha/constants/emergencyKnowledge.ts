/**
 * Static offline emergency knowledge, shown as an instant answer when the
 * Sakhi AI assistant is unreachable. Content mirrors a curated subset of the
 * backend's SYSTEM_PROMPT (api-server/src/routes/sakhi.ts) so the two never
 * contradict each other — this is not new advice, just the same advice
 * available without a network round trip.
 */

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  en: { title: string; body: string };
  hi: { title: string; body: string };
}

export const EMERGENCY_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "helplines",
    keywords: [
      "helpline", "helpline number", "emergency number", "call", "phone number",
      "हेल्पलाइन", "नंबर", "कॉल",
    ],
    en: {
      title: "Emergency Helplines",
      body:
        "112 — National emergency (police/fire/ambulance)\n" +
        "100 — Police · 101 — Fire · 102 — Ambulance\n" +
        "1091 / 181 — Women's helpline\n" +
        "1098 — Childline · 14567 — Elder helpline\n" +
        "AASRA 9820466726 / Vandrevala 1860-2662-345 — Mental health (24x7)",
    },
    hi: {
      title: "आपातकालीन हेल्पलाइन",
      body:
        "112 — राष्ट्रीय आपातकाल (पुलिस/फायर/एम्बुलेंस)\n" +
        "100 — पुलिस · 101 — फायर · 102 — एम्बुलेंस\n" +
        "1091 / 181 — महिला हेल्पलाइन\n" +
        "1098 — चाइल्डलाइन · 14567 — वरिष्ठ नागरिक हेल्पलाइन\n" +
        "AASRA 9820466726 / Vandrevala 1860-2662-345 — मानसिक स्वास्थ्य (24x7)",
    },
  },
  {
    id: "first-aid",
    keywords: [
      "first aid", "cpr", "bleeding", "burn", "choking", "seizure", "heatstroke", "fracture",
      "फर्स्ट एड", "खून", "जलना", "दौरा",
    ],
    en: {
      title: "First Aid — call 112 immediately for life-threatening emergencies",
      body:
        "CPR: 30 chest compressions + 2 rescue breaths.\n" +
        "Bleeding: firm pressure with a clean cloth, elevate the limb.\n" +
        "Burns: cool running water 10-20 min — no ice, no butter/toothpaste.\n" +
        "Choking: 5 back blows + 5 abdominal thrusts.\n" +
        "Seizure: protect from injury, turn on side, time it — call 112 if over 5 min.",
    },
    hi: {
      title: "फर्स्ट एड — जानलेवा आपातकाल में तुरंत 112 पर कॉल करें",
      body:
        "CPR: 30 छाती संपीड़न + 2 बचाव सांसें।\n" +
        "खून बहना: साफ कपड़े से दबाव डालें, अंग को ऊपर उठाएं।\n" +
        "जलना: 10-20 मिनट बहते पानी से ठंडा करें — बर्फ या मक्खन न लगाएं।\n" +
        "दम घुटना: 5 पीठ पर थपकी + 5 पेट पर दबाव।\n" +
        "दौरा: चोट से बचाएं, करवट लिटाएं, समय नोट करें — 5 मिनट से ज़्यादा हो तो 112 पर कॉल करें।",
    },
  },
  {
    id: "legal-rights",
    keywords: [
      "harass", "harassment", "abuse", "legal", "rights", "law", "police", "fir", "complaint",
      "उत्पीड़न", "कानून", "अधिकार", "शिकायत",
    ],
    en: {
      title: "Know Your Rights (India)",
      body:
        "POSH Act 2013 — Workplace harassment, Internal Committee.\n" +
        "Domestic Violence Act 2005 — Protection orders, residence rights.\n" +
        "IPC 354/354A-D — Assault, stalking, voyeurism.\n" +
        "Zero FIR — file at ANY police station, any jurisdiction.\n" +
        "POCSO 2012 — Child protection, mandatory reporting, Childline 1098.",
    },
    hi: {
      title: "अपने अधिकार जानें (भारत)",
      body:
        "POSH अधिनियम 2013 — कार्यस्थल उत्पीड़न, आंतरिक समिति।\n" +
        "घरेलू हिंसा अधिनियम 2005 — सुरक्षा आदेश, निवास अधिकार।\n" +
        "IPC 354/354A-D — हमला, पीछा करना, ताक-झांक।\n" +
        "Zero FIR — किसी भी पुलिस थाने में, किसी भी क्षेत्राधिकार में दर्ज करें।\n" +
        "POCSO 2012 — बाल सुरक्षा, अनिवार्य रिपोर्टिंग, चाइल्डलाइन 1098।",
    },
  },
  {
    id: "travel-safety",
    keywords: [
      "travel", "cab", "auto", "taxi", "night", "alone", "solo", "commute",
      "यात्रा", "कैब", "अकेले", "रात",
    ],
    en: {
      title: "Travel Safety Tips",
      body:
        "Share your live location with a trusted contact before travelling.\n" +
        "Use the Journey Timer — it alerts contacts if you don't check in.\n" +
        "Prefer well-lit, busy streets, especially at night.\n" +
        "Cabs/autos: share the OTP only once inside the vehicle.",
    },
    hi: {
      title: "यात्रा सुरक्षा सुझाव",
      body:
        "यात्रा से पहले किसी विश्वसनीय व्यक्ति के साथ अपनी लाइव लोकेशन साझा करें।\n" +
        "जर्नी टाइमर का उपयोग करें — चेक-इन न करने पर यह संपर्कों को सूचित करता है।\n" +
        "विशेष रूप से रात में रोशनी वाली, व्यस्त सड़कों को प्राथमिकता दें।\n" +
        "कैब/ऑटो: OTP केवल वाहन के अंदर बैठने के बाद ही साझा करें।",
    },
  },
];

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/** Finds the best keyword match for a user's question, or null if none. */
export function findOfflineAnswer(
  query: string,
  lang: string,
): { title: string; body: string } | null {
  const q = normalize(query);
  if (!q) return null;

  let best: KnowledgeEntry | null = null;
  let bestHits = 0;
  for (const entry of EMERGENCY_KNOWLEDGE) {
    const hits = entry.keywords.filter((k) => q.includes(normalize(k))).length;
    if (hits > bestHits) {
      best = entry;
      bestHits = hits;
    }
  }
  if (!best) return null;
  return lang === "hi" ? best.hi : best.en;
}
