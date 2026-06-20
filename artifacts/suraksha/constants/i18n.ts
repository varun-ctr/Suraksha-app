/**
 * Lightweight bilingual string table (English / Hindi).
 *
 * Access via the `useI18n()` hook (see context/LanguageContext). Keys are flat
 * dotted strings; `t("home.tapForHelp")` returns the active-language value.
 */

export type Language = "en" | "hi";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "हिंदी",
};

type Strings = Record<string, { en: string; hi: string }>;

export const STRINGS: Strings = {
  // Tabs
  "tab.home": { en: "Home", hi: "होम" },
  "tab.map": { en: "Map", hi: "नक्शा" },
  "tab.sakhi": { en: "Sakhi", hi: "सखी" },
  "tab.rights": { en: "Rights", hi: "अधिकार" },
  "tab.profile": { en: "Profile", hi: "प्रोफ़ाइल" },

  // Onboarding
  "onb.skip": { en: "Skip", hi: "छोड़ें" },
  "onb.next": { en: "Next", hi: "आगे" },
  "onb.getStarted": { en: "Get Started", hi: "शुरू करें" },
  "onb.chooseLanguage": { en: "Choose your language", hi: "अपनी भाषा चुनें" },
  "onb.langSub": { en: "You can change this anytime in Profile", hi: "इसे आप प्रोफ़ाइल में कभी भी बदल सकती हैं" },
  "onb.title1": { en: "You are never alone", hi: "आप कभी अकेली नहीं हैं" },
  "onb.body1": { en: "One tap on SOS instantly alerts your trusted contacts with your live location.", hi: "SOS पर एक टैप आपके विश्वसनीय संपर्कों को तुरंत आपकी लाइव लोकेशन भेज देता है।" },
  "onb.title2": { en: "Safety, all around you", hi: "हर ओर सुरक्षा" },
  "onb.body2": { en: "Find nearby police stations, hospitals and shelters on the safety map.", hi: "सुरक्षा नक्शे पर पास के थाने, अस्पताल और आश्रय खोजें।" },
  "onb.title3": { en: "Know your rights", hi: "अपने अधिकार जानें" },
  "onb.body3": { en: "Learn the laws that protect you — and meet Sakhi, your private safety companion.", hi: "आपकी रक्षा करने वाले कानून जानें — और मिलें सखी से, आपकी निजी साथी।" },

  // Home
  "home.greeting": { en: "Namaste,", hi: "नमस्ते," },
  "home.safeZone": { en: "Safe Zone", hi: "सुरक्षित क्षेत्र" },
  "home.locating": { en: "Locating…", hi: "लोकेशन ढूँढ रहे हैं…" },
  "home.tapForHelp": { en: "Tap for instant help", hi: "तुरंत सहायता के लिए दबाएँ" },
  "home.journey": { en: "Journey Sharing", hi: "यात्रा साझा करना" },
  "home.journeySub": { en: "Share live location while you travel", hi: "यात्रा के दौरान लाइव लोकेशन शेयर करें" },
  "home.startSharing": { en: "Start Sharing", hi: "साझा करना शुरू करें" },
  "home.sharingLive": { en: "Sharing live", hi: "लाइव साझा हो रहा है" },
  "home.arrivedSafely": { en: "I've Arrived Safely", hi: "मैं सुरक्षित पहुँच गई" },
  "home.trustedContacts": { en: "Trusted Contacts", hi: "विश्वसनीय संपर्क" },
  "home.quickActions": { en: "Quick Actions", hi: "त्वरित क्रियाएँ" },
  "home.manage": { en: "Manage", hi: "प्रबंधित करें" },
  "home.noContacts": { en: "Add someone you trust", hi: "किसी विश्वसनीय व्यक्ति को जोड़ें" },
  "home.minutes": { en: "min", hi: "मिनट" },

  // SOS
  "sos.sent": { en: "SOS Alert Sent!", hi: "SOS अलर्ट भेजा गया!" },
  "sos.helpComing": { en: "Help is on its way", hi: "सहायता आपकी ओर आ रही है" },
  "sos.elapsed": { en: "Elapsed time", hi: "बीता हुआ समय" },
  "sos.liveLocation": { en: "Live location shared", hi: "लाइव लोकेशन साझा" },
  "sos.alertedContacts": { en: "Alerted contacts", hi: "सूचित संपर्क" },
  "sos.delivered": { en: "Notified", hi: "सूचित" },
  "sos.sending": { en: "Sending…", hi: "भेज रहे हैं…" },
  "sos.call112": { en: "Call Emergency 112", hi: "आपातकाल 112 पर कॉल करें" },
  "sos.shareLocation": { en: "Share live location", hi: "लाइव लोकेशन साझा करें" },
  "sos.imSafe": { en: "I'm Safe — Cancel Alert", hi: "मैं सुरक्षित हूँ — अलर्ट रद्द करें" },
  "sos.gettingLocation": { en: "Getting your location…", hi: "आपकी लोकेशन ले रहे हैं…" },

  // Map
  "map.title": { en: "Safety Map", hi: "सुरक्षा नक्शा" },
  "map.sub": { en: "Find safe places nearby", hi: "आस-पास सुरक्षित स्थान खोजें" },
  "map.all": { en: "All", hi: "सभी" },
  "map.police": { en: "Police", hi: "पुलिस" },
  "map.hospital": { en: "Hospital", hi: "अस्पताल" },
  "map.shelter": { en: "Shelter", hi: "आश्रय" },
  "map.shops": { en: "Shops", hi: "दुकानें" },
  "map.safe": { en: "Safe", hi: "सुरक्षित" },
  "map.callNow": { en: "Call Now", hi: "अभी कॉल करें" },
  "map.navigate": { en: "Navigate", hi: "रास्ता" },

  // Rights
  "rights.title": { en: "Know Your Rights", hi: "अपने अधिकार जानें" },
  "rights.sub": { en: "Laws that protect you", hi: "कानून जो आपकी रक्षा करते हैं" },
  "rights.legalProtections": { en: "Legal Protections", hi: "कानूनी सुरक्षा" },
  "rights.stepsToTake": { en: "Steps to take", hi: "क्या करें" },

  // Sakhi
  "sakhi.title": { en: "Sakhi", hi: "सखी" },
  "sakhi.sub": { en: "Your private safety companion", hi: "आपकी निजी सुरक्षा साथी" },
  "sakhi.online": { en: "Always here for you", hi: "हमेशा आपके लिए" },
  "sakhi.placeholder": { en: "Ask me anything…", hi: "मुझसे कुछ भी पूछें…" },
  "sakhi.greeting": {
    en: "Hi, I'm Sakhi 💜 I'm here for you — ask me about your safety, your rights, or anything on your mind.",
    hi: "नमस्ते, मैं सखी हूँ 💜 मैं आपके लिए हूँ — अपनी सुरक्षा, अधिकारों या मन की किसी भी बात के बारे में पूछें।",
  },
  "sakhi.thinking": { en: "Sakhi is typing…", hi: "सखी लिख रही है…" },
  "sakhi.error": { en: "I couldn't reach you just now. Please try again.", hi: "अभी संपर्क नहीं हो सका। कृपया फिर प्रयास करें।" },
  "sakhi.suggest1": { en: "I feel unsafe walking home", hi: "घर जाते हुए असुरक्षित महसूस कर रही हूँ" },
  "sakhi.suggest2": { en: "How do I file an FIR?", hi: "FIR कैसे दर्ज करूँ?" },
  "sakhi.suggest3": { en: "Help me make a safety plan", hi: "सुरक्षा योजना बनाने में मदद करें" },
  "sakhi.disclaimer": { en: "Sakhi offers guidance, not legal or medical advice. In an emergency, call 112.", hi: "सखी मार्गदर्शन देती है, कानूनी या चिकित्सकीय सलाह नहीं। आपात में 112 पर कॉल करें।" },

  // Contacts
  "contacts.title": { en: "Trusted Contacts", hi: "विश्वसनीय संपर्क" },
  "contacts.sub": { en: "They get alerted on SOS", hi: "SOS पर इन्हें सूचित किया जाता है" },
  "contacts.addNew": { en: "Add a new contact", hi: "नया संपर्क जोड़ें" },
  "contacts.fullName": { en: "Full name", hi: "पूरा नाम" },
  "contacts.phone": { en: "Phone number", hi: "फ़ोन नंबर" },
  "contacts.add": { en: "Add Contact", hi: "संपर्क जोड़ें" },
  "contacts.import": { en: "Import from phone", hi: "फ़ोन से आयात करें" },
  "contacts.info": { en: "When you trigger SOS, every contact below instantly gets your live location and a call alert.", hi: "SOS पर नीचे दिया हर संपर्क तुरंत आपकी लाइव लोकेशन और कॉल अलर्ट पाता है।" },
  "contacts.empty": { en: "No contacts yet — add someone you trust.", hi: "अभी कोई संपर्क नहीं — किसी विश्वसनीय व्यक्ति को जोड़ें।" },
  "contacts.added": { en: "Contact added", hi: "संपर्क जोड़ा गया" },
  "contacts.removed": { en: "Contact removed", hi: "संपर्क हटाया गया" },

  // Helpline
  "helpline.title": { en: "Emergency Helplines", hi: "आपातकालीन हेल्पलाइन" },
  "helpline.sub": { en: "Tap any number to call", hi: "कॉल करने के लिए नंबर पर टैप करें" },

  // Fake call
  "fake.title": { en: "Fake Call", hi: "नकली कॉल" },
  "fake.sub": { en: "Schedule a call to exit unsafe situations", hi: "असुरक्षित स्थिति से निकलने हेतु कॉल शेड्यूल करें" },
  "fake.callerName": { en: "Caller name", hi: "कॉल करने वाले का नाम" },
  "fake.ringIn": { en: "Ring in", hi: "कॉल आएगी" },
  "fake.schedule": { en: "Schedule Fake Call", hi: "नकली कॉल शेड्यूल करें" },
  "fake.scheduled": { en: "Fake call scheduled", hi: "नकली कॉल शेड्यूल हुई" },
  "fake.cancel": { en: "Cancel scheduled call", hi: "शेड्यूल की गई कॉल रद्द करें" },
  "fake.incoming": { en: "Incoming call", hi: "आ रही कॉल" },
  "fake.decline": { en: "Decline", hi: "अस्वीकार" },
  "fake.accept": { en: "Accept", hi: "स्वीकार" },
  "fake.seconds": { en: "seconds", hi: "सेकंड" },

  // Report
  "report.title": { en: "Community Reports", hi: "सामुदायिक रिपोर्ट" },
  "report.sub": { en: "Help keep others safe", hi: "दूसरों को सुरक्षित रखने में मदद करें" },
  "report.newReport": { en: "Report an incident", hi: "घटना की रिपोर्ट करें" },
  "report.category": { en: "Category", hi: "श्रेणी" },
  "report.description": { en: "What happened?", hi: "क्या हुआ?" },
  "report.addPhoto": { en: "Add photo", hi: "फ़ोटो जोड़ें" },
  "report.attachLocation": { en: "Attach my location", hi: "मेरी लोकेशन जोड़ें" },
  "report.submit": { en: "Submit Report", hi: "रिपोर्ट भेजें" },
  "report.submitted": { en: "Report submitted — thank you", hi: "रिपोर्ट भेजी गई — धन्यवाद" },
  "report.recent": { en: "Recent reports", hi: "हाल की रिपोर्ट" },
  "report.empty": { en: "No reports yet.", hi: "अभी कोई रिपोर्ट नहीं।" },
  "report.anonymous": { en: "Reports are stored privately on your device.", hi: "रिपोर्ट आपके डिवाइस पर निजी रूप से सुरक्षित रहती हैं।" },

  // Profile
  "profile.premiumMember": { en: "Premium Member", hi: "प्रीमियम सदस्य" },
  "profile.appearance": { en: "Appearance", hi: "रूप-रंग" },
  "profile.colorTheme": { en: "Color theme", hi: "रंग थीम" },
  "profile.darkMode": { en: "Dark mode", hi: "डार्क मोड" },
  "profile.settings": { en: "Settings", hi: "सेटिंग्स" },
  "profile.notifications": { en: "Notifications", hi: "सूचनाएं" },
  "profile.bgLocation": { en: "Background Location", hi: "बैकग्राउंड लोकेशन" },
  "profile.language": { en: "App Language", hi: "भाषा" },
  "profile.account": { en: "Account", hi: "खाता" },
  "profile.privacy": { en: "Privacy Policy", hi: "गोपनीयता नीति" },
  "profile.about": { en: "About Suraksha", hi: "सुरक्षा के बारे में" },
  "profile.support": { en: "Contact Support", hi: "सहायता से संपर्क करें" },
  "profile.premium": { en: "Suraksha Premium", hi: "सुरक्षा प्रीमियम" },
  "profile.editName": { en: "Edit profile", hi: "प्रोफ़ाइल संपादित करें" },

  // Premium
  "premium.title": { en: "Suraksha Premium", hi: "सुरक्षा प्रीमियम" },
  "premium.sub": { en: "Extra protection for total peace of mind", hi: "पूर्ण मन की शांति हेतु अतिरिक्त सुरक्षा" },
  "premium.choosePlan": { en: "Choose a plan", hi: "योजना चुनें" },
  "premium.subscribe": { en: "Subscribe", hi: "सदस्यता लें" },
  "premium.currentPlan": { en: "Your current plan", hi: "आपकी वर्तमान योजना" },
  "premium.note": { en: "Billing is not enabled in this version.", hi: "इस संस्करण में बिलिंग सक्षम नहीं है।" },

  // Common
  "common.save": { en: "Save", hi: "सहेजें" },
  "common.cancel": { en: "Cancel", hi: "रद्द करें" },
  "common.done": { en: "Done", hi: "पूर्ण" },
  "common.calling": { en: "Calling", hi: "कॉल कर रहे हैं" },
  "common.navigatingTo": { en: "Navigating to", hi: "रास्ता दिखा रहे हैं" },
  "common.send": { en: "Send", hi: "भेजें" },
  "common.name": { en: "Name", hi: "नाम" },
};
