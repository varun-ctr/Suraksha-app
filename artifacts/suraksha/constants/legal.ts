/**
 * Plain-language, truthful legal copy for Suraksha.
 *
 * Every claim here reflects what the app actually does as of June 2026:
 *
 *  ON-DEVICE (never sent to a server):
 *    - Trusted contacts and profile: stored in OS secure keystore (native) or
 *      app local storage (web preview only).
 *    - Safety journal entries (including attached photos) and app settings:
 *      stored in app local storage. Nothing is uploaded.
 *
 *  NETWORK — data that does leave the device:
 *    1. Authentication: Supabase email OTP login. Your e-mail address is sent
 *       to Supabase to issue a one-time passcode and to maintain a session.
 *    2. Sakhi chat: each message you send is forwarded to our API server,
 *       which passes it to OpenAI to generate a reply.
 *    3. SOS live-tracking: when you trigger SOS and GPS is available, your
 *       coordinates are written to a Supabase row linked to a random share ID.
 *       The row is readable only by someone who has that exact share URL. The
 *       session expires automatically (24 h) and can be ended at any time.
 *    4. Nearby-places search: when you tap a map category, your coordinates
 *       are sent to our API server, which calls the Google Places API on your
 *       behalf and returns results. No result is stored after the request.
 */

export interface LegalSection {
  heading: { en: string; hi: string };
  body: { en: string; hi: string };
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: { en: "Data stored only on your device", hi: "केवल आपके डिवाइस पर सहेजा गया डेटा" },
    body: {
      en: "Your trusted contacts and profile are stored in your phone's secure keystore. Your safety journal entries (including any attached photos) and app settings are stored in the app's local storage. None of this is uploaded to any server.",
      hi: "आपके विश्वसनीय संपर्क और प्रोफ़ाइल आपके फ़ोन के सुरक्षित कीस्टोर में रखे जाते हैं। आपकी सुरक्षा डायरी की प्रविष्टियाँ (और जोड़ी गई कोई भी फ़ोटो) तथा ऐप सेटिंग्स ऐप के स्थानीय स्टोरेज में रहती हैं। इनमें से कुछ भी किसी सर्वर पर अपलोड नहीं होता।",
    },
  },
  {
    heading: { en: "Login and account", hi: "लॉगिन और खाता" },
    body: {
      en: "To use the app you sign in with an email one-time passcode via Supabase. Your email address is sent to Supabase to verify your identity and maintain your session. You can sign out at any time from your Profile.",
      hi: "ऐप उपयोग करने हेतु आप Supabase के माध्यम से ईमेल वन-टाइम पासकोड से साइन इन करती हैं। आपकी पहचान सत्यापित करने और सत्र बनाए रखने के लिए आपका ईमेल पता Supabase को भेजा जाता है। आप प्रोफ़ाइल से कभी भी साइन आउट कर सकती हैं।",
    },
  },
  {
    heading: { en: "Location", hi: "लोकेशन" },
    body: {
      en: "The app reads your location only when you open the map, trigger SOS, or log a journal entry with location attached. When SOS is triggered and GPS is available, your coordinates are written to a secure Supabase row identified by a random share ID. Only someone you share that link with can see the coordinates. The session expires in 24 hours and you can end it at any time by tapping 'I'm Safe'. The OS geocoding service may be used to convert coordinates to a readable address.",
      hi: "ऐप आपकी लोकेशन तभी पढ़ता है जब आप मैप खोलती हैं, SOS दबाती हैं, या लोकेशन के साथ डायरी प्रविष्टि सहेजती हैं। SOS पर जब GPS उपलब्ध हो, आपके निर्देशांक एक यादृच्छिक शेयर ID से जुड़ी सुरक्षित Supabase पंक्ति में लिखे जाते हैं। केवल वही व्यक्ति निर्देशांक देख सकता है जिसे आप वह लिंक भेजती हैं। सत्र 24 घंटे में स्वतः समाप्त हो जाता है और आप 'मैं सुरक्षित हूँ' टैप करके इसे कभी भी समाप्त कर सकती हैं।",
    },
  },
  {
    heading: { en: "Sakhi chat uses AI", hi: "सखी चैट AI का उपयोग करती है" },
    body: {
      en: "When you message Sakhi, your messages are sent to our API server, which forwards them to OpenAI to generate a reply. Please avoid sharing details you would not want processed by an AI provider. Sakhi conversations are not stored by us after the reply is generated and are not used to identify you.",
      hi: "जब आप सखी को संदेश भेजती हैं, तो वे हमारे API सर्वर को भेजे जाते हैं, जो उत्तर बनाने हेतु उन्हें OpenAI को अग्रेषित करता है। ऐसी जानकारी साझा करने से बचें जिसे आप किसी AI प्रदाता द्वारा संसाधित नहीं कराना चाहतीं। उत्तर बनने के बाद सखी की बातचीत हमारे द्वारा संग्रहीत नहीं की जाती और आपकी पहचान के लिए उपयोग नहीं होती।",
    },
  },
  {
    heading: { en: "Nearby-places search", hi: "पास के स्थान खोज" },
    body: {
      en: "When you tap a category on the Safety Map, your coordinates are sent to our API server, which queries the Google Places API and returns the results to your device. No search result or coordinate is stored after the request completes.",
      hi: "जब आप सुरक्षा मैप पर कोई श्रेणी टैप करती हैं, तो आपके निर्देशांक हमारे API सर्वर को भेजे जाते हैं, जो Google Places API से परिणाम लाकर आपके डिवाइस पर वापस करता है। अनुरोध पूरा होने के बाद कोई भी खोज परिणाम या निर्देशांक सहेजा नहीं जाता।",
    },
  },
  {
    heading: { en: "Alerts are always in your hands", hi: "अलर्ट हमेशा आपके हाथ में" },
    body: {
      en: "SOS and journey features do not contact the police or emergency services automatically. They prepare a call, SMS or WhatsApp message that you choose to send. The app cannot guarantee that a message is delivered or read.",
      hi: "SOS और यात्रा सुविधाएँ स्वतः पुलिस या आपातकालीन सेवाओं से संपर्क नहीं करतीं। वे एक कॉल, SMS या WhatsApp संदेश तैयार करती हैं जिसे भेजने का निर्णय आप लेती हैं। ऐप यह गारंटी नहीं दे सकता कि संदेश पहुँचा या पढ़ा गया।",
    },
  },
  {
    heading: { en: "Deleting your data", hi: "अपना डेटा हटाना" },
    body: {
      en: "You can erase everything stored on your device at any time from Profile → Your Data & Account → Delete all my data. Your Supabase account and any active live-tracking sessions are separate; to remove those, sign out and contact support.",
      hi: "आप अपने डिवाइस पर संग्रहीत सब कुछ कभी भी प्रोफ़ाइल → आपका डेटा और खाता → मेरा सारा डेटा हटाएँ से मिटा सकती हैं। आपका Supabase खाता और सक्रिय लाइव-ट्रैकिंग सत्र अलग हैं; उन्हें हटाने हेतु साइन आउट करें और सहायता से संपर्क करें।",
    },
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: { en: "Suraksha is a safety aid, not an emergency service", hi: "सुरक्षा एक सहायक है, आपातकालीन सेवा नहीं" },
    body: {
      en: "Suraksha helps you reach people and places quickly, but it does not contact the police or emergency services on your behalf. In a real emergency, always call 112 (or the relevant helpline) directly.",
      hi: "सुरक्षा आपको लोगों और स्थानों तक जल्दी पहुँचने में मदद करती है, लेकिन यह आपकी ओर से पुलिस या आपातकालीन सेवाओं से संपर्क नहीं करती। वास्तविक आपात स्थिति में हमेशा सीधे 112 (या संबंधित हेल्पलाइन) पर कॉल करें।",
    },
  },
  {
    heading: { en: "Alerts are manual", hi: "अलर्ट मैनुअल हैं" },
    body: {
      en: "SOS and journey features do not send messages automatically. They prepare a call, SMS or WhatsApp message that you choose to send. The app cannot guarantee that a message is delivered or read.",
      hi: "SOS और यात्रा सुविधाएँ संदेश स्वतः नहीं भेजतीं। वे एक कॉल, SMS या WhatsApp संदेश तैयार करती हैं जिसे भेजने का निर्णय आप लेती हैं। ऐप यह गारंटी नहीं दे सकता कि संदेश पहुँचा या पढ़ा गया।",
    },
  },
  {
    heading: { en: "Guidance, not professional advice", hi: "मार्गदर्शन, पेशेवर सलाह नहीं" },
    body: {
      en: "Legal information and Sakhi's replies are for general guidance only and are not legal, medical or professional advice. Verify important details with a qualified professional or official source.",
      hi: "कानूनी जानकारी और सखी के उत्तर केवल सामान्य मार्गदर्शन हेतु हैं और कानूनी, चिकित्सकीय या पेशेवर सलाह नहीं हैं। महत्वपूर्ण बातों की पुष्टि किसी योग्य पेशेवर या आधिकारिक स्रोत से करें।",
    },
  },
  {
    heading: { en: "No warranty", hi: "कोई वारंटी नहीं" },
    body: {
      en: "The app is provided \"as is\". Features depend on your device, permissions and network, and may not always work. Please do not rely on it as your only means of getting help.",
      hi: "ऐप \"जैसा है\" के आधार पर दिया गया है। सुविधाएँ आपके डिवाइस, अनुमतियों और नेटवर्क पर निर्भर करती हैं और हमेशा काम नहीं कर सकतीं। कृपया इसे सहायता पाने का एकमात्र साधन न मानें।",
    },
  },
];
