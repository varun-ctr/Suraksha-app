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
  | "flag";

export interface QuickAction {
  key: "safe" | "rights" | "addcontact" | "helpline" | "sakhi" | "fakecall" | "community" | "journey";
  en: string;
  hi: string;
  icon: IconName;
  color: (c: Palette) => string;
  route: string;
}

export interface RightItem {
  id: number;
  title: string;
  subtitle: string;
  icon: IconName;
  color: (c: Palette) => string;
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
  { key: "addcontact", en: "Emergency Contacts", hi: "आपातकालीन संपर्क",  icon: "users",      color: (c) => c.success,      route: "/contacts" },
  { key: "safe",       en: "Safety Map",          hi: "सुरक्षा नक्शा",      icon: "mapPin",     color: (c) => c.primary,      route: "/(tabs)/map" },
  { key: "fakecall",   en: "Fake Call",            hi: "नकली कॉल",           icon: "phoneCall",  color: (c) => c.warning,      route: "/fakecall" },
  { key: "journey",    en: "Journey Timer",        hi: "यात्रा टाइमर",       icon: "navigation", color: (c) => c.police,       route: "/(tabs)/index" },
  { key: "community",  en: "Community Reports",    hi: "सामुदायिक रिपोर्ट",  icon: "flag",       color: (c) => c.accent,       route: "/community-report" },
  { key: "rights",     en: "Know Your Rights",     hi: "अपने अधिकार जानें",  icon: "book",       color: (c) => c.police,       route: "/(tabs)/rights" },
  { key: "sakhi",      en: "Sakhi AI",             hi: "सखी AI",              icon: "message",    color: (c) => c.primaryLight, route: "/(tabs)/sakhi" },
  { key: "helpline",   en: "Helpline",             hi: "हेल्पलाइन",           icon: "phone",      color: (c) => c.accent,       route: "/helpline" },
];

export const RIGHTS: RightItem[] = [
  {
    id: 1,
    title: "POSH Act, 2013",
    subtitle: "Sexual Harassment of Women at Workplace",
    icon: "shield",
    color: (c) => c.primary,
    en: "Protects women from sexual harassment at the workplace. Employers with 10 or more employees must set up an Internal Committee (IC) to handle complaints.",
    hi: "महिलाओं को कार्यस्थल पर यौन उत्पीड़न से सुरक्षा देता है। 10 या अधिक कर्मचारियों वाले हर नियोक्ता को शिकायतों के लिए आंतरिक समिति (IC) बनानी अनिवार्य है।",
    steps: [
      { en: "Write a complaint to the Internal Committee (IC) within 3 months of the incident.", hi: "घटना के 3 महीने के भीतर आंतरिक समिति (IC) को लिखित शिकायत दें।" },
      { en: "The IC must complete its inquiry and submit a report within 90 days.", hi: "IC को 90 दिनों के भीतर जांच पूरी कर रिपोर्ट देनी होती है।" },
      { en: "You can request interim relief such as transfer or leave during the inquiry.", hi: "जांच के दौरान आप स्थानांतरण या छुट्टी जैसी अंतरिम राहत मांग सकती हैं।" },
      { en: "If unsatisfied with the outcome, you can appeal in court within 90 days of the IC's report.", hi: "परिणाम से असंतुष्ट होने पर रिपोर्ट के 90 दिनों के भीतर अदालत में अपील कर सकती हैं।" },
    ],
  },
  {
    id: 2,
    title: "POCSO Act, 2012",
    subtitle: "Protection of Children from Sexual Offences",
    icon: "users",
    color: (c) => c.accent,
    en: "Protects children under 18 from sexual abuse and exploitation, and mandates child-friendly procedures in police stations and courts.",
    hi: "18 वर्ष से कम आयु के बच्चों को यौन शोषण से बचाता है, और पुलिस व अदालत में बाल-सुलभ प्रक्रिया अनिवार्य करता है।",
    steps: [
      { en: "Call Childline at 1098 immediately — it is free and available 24x7.", hi: "तुरंत चाइल्डलाइन 1098 पर कॉल करें — यह निःशुल्क और 24x7 उपलब्ध है।" },
      { en: "Reporting is legally mandatory for anyone who becomes aware of the offence.", hi: "अपराध की जानकारी होने पर रिपोर्ट करना कानूनन अनिवार्य है।" },
      { en: "The child's statement is recorded in the presence of a parent or trusted adult.", hi: "बच्चे का बयान माता-पिता या विश्वसनीय वयस्क की उपस्थिति में दर्ज होता है।" },
      { en: "The trial is conducted in-camera to protect the child's identity.", hi: "बच्चे की पहचान सुरक्षित रखने के लिए सुनवाई बंद कमरे में होती है।" },
    ],
  },
  {
    id: 3,
    title: "Domestic Violence Act, 2005",
    subtitle: "Protection of Women from Domestic Violence",
    icon: "home",
    color: (c) => c.warning,
    en: "Gives women the right to live free from violence at home, and to seek protection orders, residence rights and maintenance.",
    hi: "महिलाओं को घर में हिंसा से मुक्त रहने तथा सुरक्षा आदेश, निवास अधिकार और भरण-पोषण पाने का अधिकार देता है।",
    steps: [
      { en: "Approach a Protection Officer or file a complaint directly with the Magistrate.", hi: "संरक्षण अधिकारी से संपर्क करें या सीधे मजिस्ट्रेट के पास शिकायत दर्ज करें।" },
      { en: "Request a Protection Order to stop the abuser from contacting you.", hi: "उत्पीड़क को संपर्क से रोकने के लिए सुरक्षा आदेश का अनुरोध करें।" },
      { en: "Ask for a Residence Order to continue living in the shared household.", hi: "साझा घर में रहना जारी रखने के लिए निवास आदेश मांगें।" },
      { en: "Apply for monetary relief to cover medical costs and lost income.", hi: "चिकित्सा खर्च और आय की हानि के लिए आर्थिक राहत हेतु आवेदन करें।" },
    ],
  },
  {
    id: 4,
    title: "IPC Section 354",
    subtitle: "Assault on a Woman to Outrage Her Modesty",
    icon: "alert",
    color: (c) => c.police,
    en: "Makes it a criminal offence to assault or use force against a woman with the intent to outrage her modesty, punishable with imprisonment.",
    hi: "महिला की मर्यादा भंग करने के इरादे से हमला या बल प्रयोग करना दंडनीय अपराध है, जिसमें कारावास की सजा हो सकती है।",
    steps: [
      { en: "File an FIR at the nearest police station — this is a cognizable offence.", hi: "नज़दीकी थाने में FIR दर्ज करें — यह संज्ञेय अपराध है।" },
      { en: "The police cannot refuse to register your FIR.", hi: "पुलिस आपकी FIR दर्ज करने से इनकार नहीं कर सकती।" },
      { en: "You may request a woman police officer to record your statement.", hi: "आप बयान दर्ज करने के लिए महिला पुलिस अधिकारी का अनुरोध कर सकती हैं।" },
      { en: "Free legal aid is available through the District Legal Services Authority.", hi: "जिला विधिक सेवा प्राधिकरण से निःशुल्क कानूनी सहायता उपलब्ध है।" },
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

export const REPORT_CATEGORIES: { key: string; en: string; hi: string; icon: IconName }[] = [
  { key: "harassment", en: "Harassment",   hi: "उत्पीड़न",         icon: "alert" },
  { key: "unsafe",     en: "Unsafe Area",  hi: "असुरक्षित क्षेत्र", icon: "mapPin" },
  { key: "stalking",   en: "Stalking",     hi: "पीछा करना",        icon: "user" },
  { key: "poorLighting", en: "Poor Lighting", hi: "खराब रोशनी",    icon: "sun" },
  { key: "other",      en: "Other",        hi: "अन्य",              icon: "info" },
];
