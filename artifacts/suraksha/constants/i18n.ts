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
  "onb.body1": { en: "One tap on SOS shows your location so you can quickly call or message your trusted contacts.", hi: "SOS पर एक टैप आपकी लोकेशन दिखाता है, ताकि आप झट से अपने विश्वसनीय संपर्कों को कॉल या संदेश भेज सकें।" },
  "onb.title2": { en: "Safety, all around you", hi: "हर ओर सुरक्षा" },
  "onb.body2": { en: "Find police stations, hospitals and shelters near you using your maps app.", hi: "अपने मैप ऐप से पास के थाने, अस्पताल और आश्रय खोजें।" },
  "onb.title3": { en: "Know your rights", hi: "अपने अधिकार जानें" },
  "onb.body3": { en: "Learn the laws that protect you — and meet Sakhi, your private safety companion.", hi: "आपकी रक्षा करने वाले कानून जानें — और मिलें सखी से, आपकी निजी साथी।" },

  // Home
  "home.greeting": { en: "Namaste,", hi: "नमस्ते," },
  "home.guest": { en: "friend", hi: "सखी" },
  "home.locating": { en: "Locating…", hi: "लोकेशन ढूँढ रहे हैं…" },
  "home.locationOff": { en: "Location off", hi: "लोकेशन बंद" },
  "home.selectLanguage": { en: "Select Language", hi: "भाषा चुनें" },
  "home.selectLanguageSub": { en: "You can change this any time from your profile.", hi: "आप इसे कभी भी अपनी प्रोफ़ाइल से बदल सकते हैं।" },
  "home.tapForHelp": { en: "Tap for instant help", hi: "तुरंत सहायता के लिए दबाएँ" },
  "home.journey": { en: "Journey Timer", hi: "यात्रा टाइमर" },
  "home.journeySub": { en: "Time your trip and share your location with someone you trust.", hi: "अपनी यात्रा का समय रखें और किसी विश्वसनीय व्यक्ति को अपनी लोकेशन भेजें।" },
  "home.startSharing": { en: "Start Journey", hi: "यात्रा शुरू करें" },
  "home.sharingLive": { en: "Journey in progress", hi: "यात्रा जारी है" },
  "home.shareLocation": { en: "Share my location", hi: "मेरी लोकेशन भेजें" },
  "home.overdue": { en: "Overdue — let someone know", hi: "समय पार — किसी को बताएँ" },
  "home.arrivedSafely": { en: "I've Arrived Safely", hi: "मैं सुरक्षित पहुँच गई" },
  "home.trustedContacts": { en: "Trusted Contacts", hi: "विश्वसनीय संपर्क" },
  "home.quickActions": { en: "Quick Actions", hi: "त्वरित क्रियाएँ" },
  "home.manage": { en: "Manage", hi: "प्रबंधित करें" },
  "home.noContacts": { en: "Add someone you trust", hi: "किसी विश्वसनीय व्यक्ति को जोड़ें" },
  "home.minutes": { en: "min", hi: "मिनट" },

  // SOS
  "sos.sent": { en: "SOS Activated", hi: "SOS सक्रिय" },
  "sos.helpComing": { en: "Alert your contacts now", hi: "अभी अपने संपर्कों को सूचित करें" },
  "sos.notConfigured": { en: "Alerts are not sent automatically. Tap a contact to share your location and call them.", hi: "अलर्ट स्वतः नहीं भेजे जाते। लोकेशन भेजने और कॉल करने हेतु किसी संपर्क पर टैप करें।" },
  "sos.elapsed": { en: "Elapsed time", hi: "बीता हुआ समय" },
  "sos.liveLocation": { en: "Your location", hi: "आपकी लोकेशन" },
  "sos.locationUnavailable": { en: "Location unavailable — enable GPS to share it.", hi: "लोकेशन अनुपलब्ध — साझा करने हेतु GPS चालू करें।" },
  "sos.alertedContacts": { en: "Your trusted contacts", hi: "आपके विश्वसनीय संपर्क" },
  "sos.noContacts": { en: "No trusted contacts yet. Add someone so you can reach them quickly.", hi: "अभी कोई विश्वसनीय संपर्क नहीं। शीघ्र संपर्क हेतु किसी को जोड़ें।" },
  "sos.addContacts": { en: "Add Contacts", hi: "संपर्क जोड़ें" },
  "sos.call": { en: "Call", hi: "कॉल" },
  "sos.sms": { en: "SMS", hi: "SMS" },
  "sos.whatsapp": { en: "WhatsApp", hi: "WhatsApp" },
  "sos.smsBody": { en: "SOS! I need help. My location: {link}", hi: "SOS! मुझे मदद चाहिए। मेरी लोकेशन: {link}" },
  "sos.smsNoLoc": { en: "SOS! I need help. Please call me.", hi: "SOS! मुझे मदद चाहिए। कृपया मुझे कॉल करें।" },
  "sos.call112": { en: "Call Emergency 112", hi: "आपातकाल 112 पर कॉल करें" },
  "sos.shareLocation": { en: "Share my location", hi: "मेरी लोकेशन साझा करें" },
  "sos.imSafe": { en: "I'm Safe — Cancel Alert", hi: "मैं सुरक्षित हूँ — अलर्ट रद्द करें" },
  "sos.gettingLocation": { en: "Getting your location…", hi: "आपकी लोकेशन ले रहे हैं…" },
  "sos.liveTrackingOn": { en: "Live tracking is on", hi: "लाइव ट्रैकिंग चालू है" },

  // Map
  "map.title": { en: "Safety Map", hi: "सुरक्षा नक्शा" },
  "map.sub": { en: "Find help near you", hi: "अपने पास सहायता खोजें" },
  "map.note": { en: "Tap a category to find these places near you in your maps app.", hi: "अपने मैप ऐप में पास के ये स्थान खोजने हेतु किसी श्रेणी पर टैप करें।" },
  "map.locationOff": { en: "Turn on location to see your position on the map.", hi: "मैप पर अपनी स्थिति देखने हेतु लोकेशन चालू करें।" },
  "map.police": { en: "Police", hi: "पुलिस" },
  "map.hospital": { en: "Hospital", hi: "अस्पताल" },
  "map.pharmacy": { en: "Pharmacy", hi: "दवाख़ाना" },
  "map.shelter": { en: "Shelter", hi: "आश्रय" },
  "map.callNow": { en: "Call Now", hi: "अभी कॉल करें" },
  "map.noResults": { en: "No results found nearby. Your maps app opened instead.", hi: "पास में कोई परिणाम नहीं मिला। इसके बजाय आपका मैप ऐप खुल गया।" },
  "map.navigateTip": { en: "Tap to navigate", hi: "रास्ता देखने हेतु टैप करें" },

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
  "contacts.sub": { en: "For quick alerts when you need help", hi: "जरूरत पड़ने पर त्वरित संपर्क हेतु" },
  "contacts.addNew": { en: "Add a new contact", hi: "नया संपर्क जोड़ें" },
  "contacts.fullName": { en: "Full name", hi: "पूरा नाम" },
  "contacts.phone": { en: "Phone number", hi: "फ़ोन नंबर" },
  "contacts.add": { en: "Add Contact", hi: "संपर्क जोड़ें" },
  "contacts.import": { en: "Import from phone", hi: "फ़ोन से आयात करें" },
  "contacts.info": { en: "When you trigger SOS, you can instantly call or send each contact your location by SMS or WhatsApp.", hi: "SOS पर आप हर संपर्क को तुरंत कॉल कर सकती हैं या SMS/WhatsApp से अपनी लोकेशन भेज सकती हैं।" },
  "contacts.empty": { en: "No contacts yet — add someone you trust.", hi: "अभी कोई संपर्क नहीं — किसी विश्वसनीय व्यक्ति को जोड़ें।" },
  "contacts.added": { en: "Contact added", hi: "संपर्क जोड़ा गया" },
  "contacts.removed": { en: "Contact removed", hi: "संपर्क हटाया गया" },
  "contacts.invalid": { en: "Enter a valid 10-digit Indian mobile number.", hi: "मान्य 10-अंकीय भारतीय मोबाइल नंबर दर्ज करें।" },
  "contacts.duplicate": { en: "This contact is already added.", hi: "यह संपर्क पहले से जोड़ा जा चुका है।" },

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

  // Report (private on-device safety journal)
  "report.title": { en: "Safety Journal", hi: "सुरक्षा डायरी" },
  "report.sub": { en: "Private notes saved on your device", hi: "आपके डिवाइस पर सहेजे निजी नोट्स" },
  "report.newReport": { en: "Log an incident", hi: "घटना दर्ज करें" },
  "report.category": { en: "Category", hi: "श्रेणी" },
  "report.description": { en: "What happened?", hi: "क्या हुआ?" },
  "report.addPhoto": { en: "Add photo", hi: "फ़ोटो जोड़ें" },
  "report.attachLocation": { en: "Attach my current location", hi: "मेरी वर्तमान लोकेशन जोड़ें" },
  "report.locationUnavailable": { en: "Location not available right now", hi: "अभी लोकेशन उपलब्ध नहीं" },
  "report.submit": { en: "Save to Journal", hi: "डायरी में सहेजें" },
  "report.submitted": { en: "Saved to your device", hi: "आपके डिवाइस पर सहेजा गया" },
  "report.recent": { en: "Your journal", hi: "आपकी डायरी" },
  "report.empty": { en: "No entries yet.", hi: "अभी कोई प्रविष्टि नहीं।" },
  "report.anonymous": { en: "Entries are saved only on this device. Nothing is uploaded.", hi: "प्रविष्टियाँ केवल इसी डिवाइस पर सहेजी जाती हैं। कुछ भी अपलोड नहीं होता।" },

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
  "profile.terms": { en: "Terms of Use", hi: "उपयोग की शर्तें" },
  "profile.data": { en: "Your Data & Account", hi: "आपका डेटा और खाता" },
  "profile.about": { en: "About Suraksha", hi: "सुरक्षा के बारे में" },
  "profile.support": { en: "Contact Support", hi: "सहायता से संपर्क करें" },
  "profile.premium": { en: "Suraksha Premium", hi: "सुरक्षा प्रीमियम" },
  "profile.editName": { en: "Edit profile", hi: "प्रोफ़ाइल संपादित करें" },
  "profile.guest": { en: "Set up your profile", hi: "अपनी प्रोफ़ाइल सेट करें" },

  // Premium
  "premium.title": { en: "Suraksha Premium", hi: "सुरक्षा प्रीमियम" },
  "premium.sub": { en: "Extra protection for total peace of mind", hi: "पूर्ण मन की शांति हेतु अतिरिक्त सुरक्षा" },
  "premium.choosePlan": { en: "Planned plans", hi: "नियोजित योजनाएँ" },
  "premium.subscribe": { en: "Coming soon", hi: "जल्द आ रहा है" },
  "premium.currentPlan": { en: "Your current plan", hi: "आपकी वर्तमान योजना" },
  "premium.comingSoon": { en: "Premium is not yet available. These features are planned for a future update.", hi: "प्रीमियम अभी उपलब्ध नहीं है। ये सुविधाएँ भविष्य के अपडेट हेतु नियोजित हैं।" },
  "premium.note": { en: "Billing is not enabled in this version.", hi: "इस संस्करण में बिलिंग सक्षम नहीं है।" },

  // Data & legal
  "legal.privacyTitle": { en: "Privacy Policy", hi: "गोपनीयता नीति" },
  "legal.termsTitle": { en: "Terms of Use", hi: "उपयोग की शर्तें" },
  "legal.updated": { en: "Last updated: June 2026", hi: "अंतिम अपडेट: जून 2026" },
  "data.title": { en: "Your Data & Account", hi: "आपका डेटा और खाता" },
  "data.sub": { en: "What we store and how to remove it", hi: "हम क्या सहेजते हैं और इसे कैसे हटाएँ" },
  "data.deleteHeading": { en: "Delete all data", hi: "सारा डेटा हटाएँ" },
  "data.deleteBody": { en: "This permanently removes your contacts, profile, journal entries and settings from this device. This cannot be undone.", hi: "यह आपके संपर्क, प्रोफ़ाइल, डायरी प्रविष्टियाँ और सेटिंग्स इस डिवाइस से स्थायी रूप से हटा देता है। इसे पूर्ववत नहीं किया जा सकता।" },
  "data.deleteBtn": { en: "Delete all my data", hi: "मेरा सारा डेटा हटाएँ" },
  "data.confirmTitle": { en: "Delete everything?", hi: "सब कुछ हटाएँ?" },
  "data.confirmBody": { en: "All your data on this device will be erased and the app will restart from onboarding.", hi: "इस डिवाइस का आपका सारा डेटा मिट जाएगा और ऐप ऑनबोर्डिंग से फिर शुरू होगा।" },
  "data.deleted": { en: "All data deleted", hi: "सारा डेटा हटाया गया" },

  // Login — shared
  "login.tagline": { en: "Your safety, always with you.", hi: "आपकी सुरक्षा, हमेशा आपके साथ।" },
  "login.signIn": { en: "Sign in", hi: "साइन इन" },
  "login.tabMobile": { en: "Mobile Number", hi: "मोबाइल नंबर" },
  "login.tabEmail": { en: "Email Address", hi: "ईमेल पता" },
  "login.or": { en: "or", hi: "या" },
  "login.verify": { en: "Verify & continue", hi: "सत्यापित करें और आगे बढ़ें" },
  "login.invalidCode": { en: "Enter the 6-digit code.", hi: "6-अंकीय कोड दर्ज करें।" },
  // Login — phone tab
  "login.phoneSub": { en: "We'll send a one-time code to your mobile number.", hi: "हम आपके मोबाइल नंबर पर एक बार का कोड भेजेंगे।" },
  "login.countryCode": { en: "Country", hi: "देश" },
  "login.phonePlaceholder": { en: "Mobile number", hi: "मोबाइल नंबर" },
  "login.sendOtp": { en: "Send OTP", hi: "OTP भेजें" },
  "login.otpSentTo": { en: "OTP sent to {phone}", hi: "{phone} पर OTP भेजा गया" },
  "login.resend": { en: "Resend OTP", hi: "OTP दोबारा भेजें" },
  "login.resendIn": { en: "Resend in {n}s", hi: "{n}s में दोबारा भेजें" },
  "login.invalidPhone": { en: "Please enter a valid mobile number.", hi: "कृपया मान्य मोबाइल नंबर दर्ज करें।" },
  "login.rateLimited": { en: "Too many attempts. Try again in {n} min.", hi: "बहुत अधिक प्रयास। {n} मिनट बाद पुनः प्रयास करें।" },
  "login.backToPhone": { en: "← Change number", hi: "← नंबर बदलें" },
  "login.searchCountry": { en: "Search country…", hi: "देश खोजें…" },
  // Login — email tab
  "login.signInSub": { en: "We'll send a secure sign-in link and a 6-digit code to your email.", hi: "हम आपके ईमेल पर एक सुरक्षित साइन-इन लिंक और 6-अंकीय कोड भेजेंगे।" },
  "login.emailLabel": { en: "Email address", hi: "ईमेल पता" },
  "login.sendCode": { en: "Send link & code", hi: "लिंक और कोड भेजें" },
  "login.checkEmail": { en: "Check your email", hi: "अपना ईमेल देखें" },
  "login.checkEmailSub": { en: "We sent a secure sign-in link and verification code to {email}. Click the link or enter the code below.", hi: "{email} पर एक सुरक्षित साइन-इन लिंक और कोड भेजा गया है। लिंक पर क्लिक करें या नीचे कोड दर्ज करें।" },
  "login.waitingForLink": { en: "Waiting for magic link click…", hi: "मैजिक लिंक क्लिक का इंतज़ार है…" },
  "login.enterCodeInstead": { en: "Enter the 6-digit code instead", hi: "इसके बजाय 6-अंकीय कोड दर्ज करें" },
  "login.enterCode": { en: "Enter code", hi: "कोड दर्ज करें" },
  "login.enterCodeSub": { en: "Enter the 6-digit code from your email.", hi: "अपने ईमेल से 6-अंकीय कोड दर्ज करें।" },
  "login.otpLabel": { en: "One-time code", hi: "एक बार का कोड" },
  "login.useDifferentEmail": { en: "← Use a different email", hi: "← दूसरा ईमेल उपयोग करें" },
  "login.invalidEmail": { en: "Please enter a valid email address.", hi: "कृपया मान्य ईमेल पता दर्ज करें।" },
  // Account / sessions
  "account.sessions": { en: "Manage Account", hi: "खाता प्रबंधन" },
  "account.sessionsSub": { en: "Your sign-in sessions and security settings", hi: "आपके साइन-इन सत्र और सुरक्षा सेटिंग्स" },
  "account.signedInAs": { en: "Signed in as", hi: "साइन इन किया हुआ" },
  "account.lastSignIn": { en: "Last sign-in", hi: "अंतिम साइन-इन" },
  "account.signOutAll": { en: "Sign out of all devices", hi: "सभी डिवाइस से साइन आउट करें" },
  "account.signOutAllConfirm": { en: "Sign out of all devices?", hi: "सभी डिवाइस से साइन आउट करें?" },
  "account.signOutAllBody": { en: "You will be signed out everywhere and need to sign in again.", hi: "आप हर जगह से साइन आउट हो जाएंगी और फिर से साइन इन करना होगा।" },
  "account.deleteAccount": { en: "Delete account", hi: "खाता हटाएँ" },
  "account.deleteAccountSub": { en: "Permanently erase all your data", hi: "अपना सारा डेटा स्थायी रूप से मिटाएँ" },
  "account.deleteWarning": { en: "This permanently deletes your account, SOS history, community reports, and all personal data. This cannot be undone.", hi: "यह आपका खाता, SOS इतिहास, सामुदायिक रिपोर्ट और सभी व्यक्तिगत डेटा स्थायी रूप से हटा देता है। इसे वापस नहीं किया जा सकता।" },
  "account.deleteTypePrompt": { en: "Type DELETE to confirm", hi: "पुष्टि के लिए DELETE टाइप करें" },
  "account.deleteConfirmBtn": { en: "Delete my account", hi: "मेरा खाता हटाएँ" },
  "account.deleting": { en: "Deleting…", hi: "हटा रहे हैं…" },

  // Not found
  "notFound.title": { en: "Oops!", hi: "ओह!" },
  "notFound.body": { en: "This screen doesn't exist.", hi: "यह स्क्रीन मौजूद नहीं है।" },
  "notFound.goHome": { en: "Go to home screen!", hi: "होम स्क्रीन पर जाएँ!" },

  // Common
  "common.save": { en: "Save", hi: "सहेजें" },
  "common.cancel": { en: "Cancel", hi: "रद्द करें" },
  "common.done": { en: "Done", hi: "पूर्ण" },
  "common.calling": { en: "Calling", hi: "कॉल कर रहे हैं" },
  "common.navigatingTo": { en: "Navigating to", hi: "रास्ता दिखा रहे हैं" },
  "common.send": { en: "Send", hi: "भेजें" },
  "common.name": { en: "Name", hi: "नाम" },
};
