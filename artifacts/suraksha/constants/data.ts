/**
 * Static, offline content for Suraksha.
 *
 * All user-facing copy carries an English (`en`) and Hindi (`hi`) variant so
 * the app stays fully usable offline in either language.
 */

import type { Palette } from "./colors";

export type IconName =
  | "bell"
  | "alert"
  | "alertCircle"
  | "mapPin"
  | "home"
  | "map"
  | "book"
  | "user"
  | "phone"
  | "plus"
  | "x"
  | "check"
  | "chevronRight"
  | "chevronDown"
  | "arrowLeft"
  | "users"
  | "store"
  | "hospital"
  | "shield"
  | "navigation"
  | "clock"
  | "search"
  | "info"
  | "lock"
  | "globe"
  | "fileText"
  | "helpCircle"
  | "crown"
  | "message"
  | "phoneCall"
  | "camera"
  | "moon"
  | "sun"
  | "palette"
  | "share"
  | "heart"
  | "send"
  | "sparkles"
  | "edit"
  | "trash"
  | "logOut"
  | "bellRing"
  | "flag"
  | "bookmark"
  | "bookmarkFilled"
  | "mapPin2"
  | "truck"
  | "zap"
  | "activity"
  | "mic"
  | "video"
  | "battery"
  | "wifi"
  | "wifiOff";

export interface QuickAction {
  key: "addcontact" | "safe" | "incident" | "fakecall" | "journey" | "nearby" | "saferoute" | "weather";
  en: string;
  hi: string;
  icon: IconName;
  color: (c: Palette) => string;
  route: string;
}

export const RIGHTS_CATEGORIES = [
  { key: "workplace", en: "Workplace",       hi: "कार्यस्थल" },
  { key: "domestic",  en: "Domestic Safety", hi: "घरेलू सुरक्षा" },
  { key: "fir",       en: "FIR & Legal Aid", hi: "FIR और कानूनी सहायता" },
  { key: "public",    en: "Public Safety",   hi: "सार्वजनिक सुरक्षा" },
] as const;

export type RightsCategory = (typeof RIGHTS_CATEGORIES)[number]["key"];

export interface RightItem {
  id: number;
  title: string;
  subtitle: string;
  icon: IconName;
  color: (c: Palette) => string;
  category: RightsCategory;
  en: string;
  hi: string;
  steps: { en: string; hi: string }[];
}

export interface Helpline {
  name: string;
  hi: string;
  number: string;
  desc: string;
  descHi: string;
  color: (c: Palette) => string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { key: "addcontact", en: "Emergency Contacts", hi: "आपातकालीन संपर्क", icon: "users",      color: (c) => c.success,  route: "/contacts"        },
  { key: "safe",       en: "Safety Map",          hi: "सुरक्षा नक्शा",     icon: "mapPin",     color: (c) => c.primary,  route: "/(tabs)/map"      },
  { key: "incident",   en: "Report Incident",     hi: "घटना रिपोर्ट करें", icon: "flag",       color: (c) => c.danger,   route: "/(tabs)/incident" },
  { key: "fakecall",   en: "Fake Call",            hi: "नकली कॉल",          icon: "phoneCall",  color: (c) => c.warning,  route: "/fakecall"        },
  { key: "journey",    en: "Journey Timer",        hi: "यात्रा टाइमर",      icon: "navigation", color: (c) => c.police,   route: "/(tabs)"          },
  { key: "nearby",     en: "Nearby Help",          hi: "पास में मदद",        icon: "shield",     color: (c) => c.primary,  route: "/(tabs)/map"      },
  { key: "saferoute",  en: "Safe Route",           hi: "सुरक्षित मार्ग",     icon: "map",        color: (c) => c.success,  route: "/(tabs)/map"      },
  { key: "weather",    en: "Weather Alerts",       hi: "मौसम अलर्ट",         icon: "sun",        color: (c) => c.warning,  route: "/(tabs)"          },
];

export const RIGHTS: RightItem[] = [
  {
    id: 1,
    title: "POSH Act, 2013",
    subtitle: "Sexual Harassment at Workplace",
    icon: "shield",
    color: (c) => c.primary,
    category: "workplace",
    en: "Protects women from sexual harassment at the workplace. Employers with 10 or more employees must set up an Internal Committee (IC) to handle complaints. The law covers all workplaces — offices, factories, hospitals, NGOs, homes, and even remote work.",
    hi: "महिलाओं को कार्यस्थल पर यौन उत्पीड़न से सुरक्षा देता है। 10 या अधिक कर्मचारियों वाले हर नियोक्ता को शिकायतों के लिए आंतरिक समिति (IC) बनानी अनिवार्य है। यह कानून सभी कार्यस्थलों पर लागू होता है — कार्यालय, कारखाने, अस्पताल, NGO, घर और रिमोट कार्य।",
    steps: [
      { en: "Write a complaint to the Internal Committee (IC) within 3 months of the incident.", hi: "घटना के 3 महीने के भीतर आंतरिक समिति (IC) को लिखित शिकायत दें।" },
      { en: "The IC must complete its inquiry and submit a report within 90 days.", hi: "IC को 90 दिनों के भीतर जांच पूरी कर रिपोर्ट देनी होती है।" },
      { en: "You can request interim relief such as transfer or leave during the inquiry.", hi: "जांच के दौरान आप स्थानांतरण या छुट्टी जैसी अंतरिम राहत मांग सकती हैं।" },
      { en: "If unsatisfied with the outcome, you can appeal in court within 90 days of the IC's report.", hi: "परिणाम से असंतुष्ट होने पर रिपोर्ट के 90 दिनों के भीतर अदालत में अपील कर सकती हैं।" },
    ],
  },
  {
    id: 2,
    title: "Maternity Benefit Act, 1961",
    subtitle: "Paid Leave and Job Protection at Work",
    icon: "heart",
    color: (c) => c.accent,
    category: "workplace",
    en: "Entitles working women to 26 weeks of paid maternity leave for the first two children, and 12 weeks for subsequent ones. Employers cannot dismiss a woman during maternity leave. Work-from-home options may be available after the leave period, depending on the nature of the job.",
    hi: "कामकाजी महिलाओं को पहले दो बच्चों के लिए 26 सप्ताह और बाद के बच्चों के लिए 12 सप्ताह का सवेतन मातृत्व अवकाश मिलता है। नियोक्ता मातृत्व अवकाश के दौरान महिला को नहीं हटा सकता। काम की प्रकृति के अनुसार अवकाश के बाद घर से काम का विकल्प भी उपलब्ध हो सकता है।",
    steps: [
      { en: "Inform your employer in writing at least 8 weeks before your expected delivery date.", hi: "प्रत्याशित प्रसव तिथि से कम से कम 8 सप्ताह पहले नियोक्ता को लिखित सूचना दें।" },
      { en: "Your employer cannot require you to work during the 6 weeks before delivery.", hi: "नियोक्ता प्रसव से 6 सप्ताह पहले आपको काम करने के लिए नहीं कह सकता।" },
      { en: "If dismissed during maternity leave, file a complaint with the Labour Commissioner.", hi: "मातृत्व अवकाश के दौरान बर्खास्त होने पर श्रम आयुक्त के पास शिकायत दर्ज करें।" },
      { en: "Companies with 50+ employees must provide creche facilities within a prescribed distance.", hi: "50+ कर्मचारियों वाली कंपनियों को निर्धारित दूरी के भीतर शिशु गृह (creche) सुविधा देनी होती है।" },
    ],
  },
  {
    id: 3,
    title: "Domestic Violence Act, 2005",
    subtitle: "Protection of Women from Domestic Violence",
    icon: "home",
    color: (c) => c.warning,
    category: "domestic",
    en: "Gives women the right to live free from violence at home — covering physical, emotional, verbal, sexual, and economic abuse. You can seek protection orders, residence rights, monetary relief, and custody orders. The law also covers live-in relationships.",
    hi: "महिलाओं को घर में हिंसा से मुक्त रहने का अधिकार देता है — शारीरिक, भावनात्मक, मौखिक, यौन और आर्थिक शोषण सहित। आप सुरक्षा आदेश, निवास अधिकार, आर्थिक राहत और हिरासत आदेश मांग सकती हैं। यह कानून लिव-इन संबंधों पर भी लागू होता है।",
    steps: [
      { en: "Approach a Protection Officer or file a complaint directly with the Magistrate.", hi: "संरक्षण अधिकारी से संपर्क करें या सीधे मजिस्ट्रेट के पास शिकायत दर्ज करें।" },
      { en: "Request a Protection Order to stop the abuser from contacting you.", hi: "उत्पीड़क को संपर्क से रोकने के लिए सुरक्षा आदेश का अनुरोध करें।" },
      { en: "Ask for a Residence Order to continue living in the shared household.", hi: "साझा घर में रहना जारी रखने के लिए निवास आदेश मांगें।" },
      { en: "Apply for monetary relief to cover medical costs and lost income.", hi: "चिकित्सा खर्च और आय की हानि के लिए आर्थिक राहत हेतु आवेदन करें।" },
    ],
  },
  {
    id: 4,
    title: "Section 125 CrPC — Maintenance",
    subtitle: "Right to Financial Support After Separation",
    icon: "users",
    color: (c) => c.success,
    category: "domestic",
    en: "Any woman — wife, divorced wife, or abandoned wife — can apply to a Magistrate's court for maintenance from her husband if she is unable to maintain herself. The husband must pay a monthly allowance as ordered by the court. This right applies regardless of religion.",
    hi: "कोई भी महिला — पत्नी, तलाकशुदा पत्नी, या परित्यक्त पत्नी — पति से भरण-पोषण के लिए मजिस्ट्रेट अदालत में आवेदन कर सकती है। अदालत के आदेश के अनुसार पति को मासिक भत्ता देना होगा। यह अधिकार सभी धर्मों पर लागू होता है।",
    steps: [
      { en: "File a petition in the nearest Magistrate's court under Section 125 CrPC.", hi: "धारा 125 CrPC के तहत निकटतम मजिस्ट्रेट अदालत में याचिका दाखिल करें।" },
      { en: "The court can grant interim maintenance while the case is pending.", hi: "मामला लंबित रहने के दौरान अदालत अंतरिम भरण-पोषण दे सकती है।" },
      { en: "Free legal aid is available at the District Legal Services Authority (DLSA).", hi: "जिला विधिक सेवा प्राधिकरण (DLSA) से निःशुल्क कानूनी सहायता उपलब्ध है।" },
      { en: "If the husband refuses to comply with the order, the court can issue a warrant.", hi: "पति द्वारा आदेश न मानने पर अदालत वारंट जारी कर सकती है।" },
    ],
  },
  {
    id: 5,
    title: "IPC Section 354",
    subtitle: "Assault on a Woman to Outrage Her Modesty",
    icon: "alert",
    color: (c) => c.police,
    category: "fir",
    en: "Makes it a criminal offence to assault or use force against a woman with the intent to outrage her modesty, punishable with imprisonment up to 5 years. The 2013 Criminal Amendment Act added Sections 354A–354D, covering stalking, voyeurism, and acid attacks specifically.",
    hi: "महिला की मर्यादा भंग करने के इरादे से हमला या बल प्रयोग करना दंडनीय अपराध है जिसमें 5 साल तक कारावास हो सकता है। 2013 के आपराधिक संशोधन अधिनियम ने पीछा करना, दृश्यरतिकता और तेजाब हमलों के लिए धाराएँ 354A-354D जोड़ीं।",
    steps: [
      { en: "File an FIR at the nearest police station — this is a cognizable offence.", hi: "नज़दीकी थाने में FIR दर्ज करें — यह संज्ञेय अपराध है।" },
      { en: "The police cannot refuse to register your FIR.", hi: "पुलिस आपकी FIR दर्ज करने से इनकार नहीं कर सकती।" },
      { en: "You may request a woman police officer to record your statement.", hi: "आप बयान दर्ज करने के लिए महिला पुलिस अधिकारी का अनुरोध कर सकती हैं।" },
      { en: "Free legal aid is available through the District Legal Services Authority.", hi: "जिला विधिक सेवा प्राधिकरण से निःशुल्क कानूनी सहायता उपलब्ध है।" },
    ],
  },
  {
    id: 6,
    title: "Zero FIR — File Anywhere",
    subtitle: "Your Right to Report a Crime at Any Police Station",
    icon: "fileText",
    color: (c) => c.primary,
    category: "fir",
    en: "A Zero FIR can be filed at any police station regardless of where the offence occurred. The police cannot refuse on the grounds of jurisdiction. Once registered, the Zero FIR is transferred to the police station with proper jurisdiction. This is especially important when a crime happens far from your home station.",
    hi: "जीरो FIR अपराध स्थान की परवाह किए बिना किसी भी थाने में दर्ज कराई जा सकती है। पुलिस क्षेत्राधिकार का हवाला देकर मना नहीं कर सकती। दर्ज होने के बाद जीरो FIR को उचित क्षेत्राधिकार वाले थाने में स्थानांतरित कर दिया जाता है।",
    steps: [
      { en: "Walk into any police station in India and demand to file an FIR.", hi: "भारत के किसी भी थाने में जाएँ और FIR दर्ज करने की मांग करें।" },
      { en: "The police must register it as a Zero FIR and give you a copy with a case number.", hi: "पुलिस को इसे जीरो FIR के रूप में दर्ज कर केस नंबर सहित प्रति देनी होगी।" },
      { en: "If refused, approach the Superintendent of Police or file a complaint with the Magistrate.", hi: "मना करने पर पुलिस अधीक्षक के पास जाएँ या मजिस्ट्रेट के पास शिकायत दर्ज करें।" },
      { en: "You can also send an email complaint to the National Commission for Women.", hi: "आप राष्ट्रीय महिला आयोग को ईमेल शिकायत भी भेज सकती हैं।" },
    ],
  },
  {
    id: 7,
    title: "POCSO Act, 2012",
    subtitle: "Protection of Children from Sexual Offences",
    icon: "shield",
    color: (c) => c.accent,
    category: "public",
    en: "Protects children under 18 from sexual abuse and exploitation, and mandates child-friendly procedures in police stations and courts. Reporting is legally mandatory for anyone who becomes aware of the offence — failure to report is itself a criminal offence.",
    hi: "18 वर्ष से कम आयु के बच्चों को यौन शोषण से बचाता है, और पुलिस व अदालत में बाल-सुलभ प्रक्रिया अनिवार्य करता है। अपराध की जानकारी होने पर रिपोर्ट करना कानूनन अनिवार्य है — रिपोर्ट न करना स्वयं एक आपराधिक अपराध है।",
    steps: [
      { en: "Call Childline at 1098 immediately — it is free and available 24x7.", hi: "तुरंत चाइल्डलाइन 1098 पर कॉल करें — यह निःशुल्क और 24x7 उपलब्ध है।" },
      { en: "Reporting is legally mandatory for anyone who becomes aware of the offence.", hi: "अपराध की जानकारी होने पर रिपोर्ट करना कानूनन अनिवार्य है।" },
      { en: "The child's statement is recorded in the presence of a parent or trusted adult.", hi: "बच्चे का बयान माता-पिता या विश्वसनीय वयस्क की उपस्थिति में दर्ज होता है।" },
      { en: "The trial is conducted in-camera to protect the child's identity.", hi: "बच्चे की पहचान सुरक्षित रखने के लिए सुनवाई बंद कमरे में होती है।" },
    ],
  },
  {
    id: 8,
    title: "Criminal Amendment Act, 2013",
    subtitle: "Nirbhaya Act — Stronger Protection in Public",
    icon: "lock",
    color: (c) => c.danger,
    category: "public",
    en: "Passed after the 2012 Delhi gang rape, this act expanded and strengthened laws against sexual violence. It introduced stricter penalties for rape, defined new offences like stalking and voyeurism, and mandated that police register complaints within 24 hours. Victim identity is strictly protected.",
    hi: "2012 दिल्ली गैंगरेप के बाद पारित, इस अधिनियम ने यौन हिंसा के विरुद्ध कानूनों को विस्तारित और सुदृढ़ किया। इसने बलात्कार के लिए कड़ी सजा, पीछा करने और दृश्यरतिकता जैसे नए अपराध परिभाषित किए, और पुलिस को 24 घंटे में शिकायत दर्ज करने का आदेश दिया।",
    steps: [
      { en: "File an FIR immediately — police must register it within 24 hours.", hi: "तुरंत FIR दर्ज करें — पुलिस को 24 घंटे के भीतर दर्ज करना होगा।" },
      { en: "A woman magistrate must record the victim's statement if requested.", hi: "अनुरोध करने पर महिला मजिस्ट्रेट को पीड़िता का बयान दर्ज करना होगा।" },
      { en: "Free legal aid from DLSA must be provided to the victim.", hi: "पीड़िता को DLSA से निःशुल्क कानूनी सहायता प्रदान की जानी चाहिए।" },
      { en: "The victim's identity cannot be disclosed publicly — violations are punishable.", hi: "पीड़िता की पहचान सार्वजनिक नहीं की जा सकती — उल्लंघन दंडनीय है।" },
    ],
  },
];

export const HELPLINES: Helpline[] = [
  { name: "Women Helpline", hi: "महिला हेल्पलाइन", number: "1091", desc: "24x7 support for women in distress", descHi: "संकटग्रस्त महिलाओं के लिए 24x7 सहायता", color: (c) => c.accent },
  { name: "Police", hi: "पुलिस", number: "100", desc: "For immediate police assistance", descHi: "तत्काल पुलिस सहायता के लिए", color: (c) => c.police },
  { name: "Childline", hi: "चाइल्डलाइन", number: "1098", desc: "For children in need of care and protection", descHi: "देखभाल व सुरक्षा हेतु बच्चों के लिए", color: (c) => c.warning },
  { name: "Domestic Violence Helpline", hi: "घरेलू हिंसा हेल्पलाइन", number: "181", desc: "24x7 helpline for women facing violence at home", descHi: "घर में हिंसा झेल रही महिलाओं के लिए 24x7", color: (c) => c.primary },
  { name: "AASRA — Crisis Line", hi: "आसरा — संकट रेखा", number: "9820466726", desc: "Emotional support & suicide-prevention helpline", descHi: "भावनात्मक सहायता व आत्महत्या रोकथाम हेल्पलाइन", color: (c) => c.success },
];

export type IncidentTypeKey =
  | "harassment"
  | "accident"
  | "medical"
  | "unsafe_area"
  | "suspicious_activity"
  | "road_block"
  | "fire"
  | "flood"
  | "animal_attack"
  | "stalking"
  | "other";

export interface IncidentType {
  key: IncidentTypeKey;
  en: string;
  hi: string;
  icon: IconName;
  color: (c: Palette) => string;
}

export const INCIDENT_TYPES: IncidentType[] = [
  { key: "harassment",          en: "Harassment",           hi: "उत्पीड़न",          icon: "alert",       color: (c) => c.danger  },
  { key: "accident",            en: "Accident",             hi: "दुर्घटना",           icon: "alertCircle", color: (c) => c.warning },
  { key: "medical",             en: "Medical Emergency",    hi: "चिकित्सा आपात",      icon: "hospital",    color: (c) => c.danger  },
  { key: "unsafe_area",         en: "Unsafe Area",          hi: "असुरक्षित क्षेत्र",   icon: "mapPin",      color: (c) => c.warning },
  { key: "suspicious_activity", en: "Suspicious Activity",  hi: "संदिग्ध गतिविधि",   icon: "alert",       color: (c) => c.warning },
  { key: "road_block",          en: "Road Block",           hi: "सड़क अवरोध",         icon: "truck",       color: (c) => c.textMuted },
  { key: "fire",                en: "Fire",                 hi: "आग",                icon: "zap",         color: (c) => c.danger  },
  { key: "flood",               en: "Flood",                hi: "बाढ़",               icon: "activity",    color: (c) => c.primary },
  { key: "animal_attack",       en: "Animal Attack",        hi: "जानवर का हमला",      icon: "alert",       color: (c) => c.warning },
  { key: "stalking",            en: "Stalking",             hi: "पीछा करना",          icon: "user",        color: (c) => c.warning },
  { key: "other",               en: "Other",                hi: "अन्य",               icon: "info",        color: (c) => c.textMuted },
];
