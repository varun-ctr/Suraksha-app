/**
 * Plain-language, truthful legal copy for Suraksha.
 *
 * Every claim here must match what the app actually does:
 *  - Contacts, profile, journal entries and settings are stored only on the
 *    device (contacts & profile in the OS secure keystore).
 *  - Location is read on-device and is shared with other people only when the
 *    user taps a share / SMS / WhatsApp / call action. Turning coordinates into
 *    a readable address may use the OS geocoding service.
 *  - The only network feature is Sakhi: chat messages are sent to our server,
 *    which forwards them to OpenAI to generate a reply.
 */

export interface LegalSection {
  heading: { en: string; hi: string };
  body: { en: string; hi: string };
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: { en: "Your data stays on your device", hi: "आपका डेटा आपके डिवाइस पर रहता है" },
    body: {
      en: "Your trusted contacts and profile are stored in your phone's secure keystore. Your safety journal entries (including any photos you attach) and app settings are stored in the app's local storage. None of this is sent to us or to anyone else.",
      hi: "आपके विश्वसनीय संपर्क और प्रोफ़ाइल आपके फ़ोन के सुरक्षित कीस्टोर में रखे जाते हैं। आपकी सुरक्षा डायरी की प्रविष्टियाँ (और जोड़ी गई कोई भी फ़ोटो) तथा ऐप सेटिंग्स ऐप के स्थानीय स्टोरेज में रहती हैं। इनमें से कुछ भी हमें या किसी और को नहीं भेजा जाता।",
    },
  },
  {
    heading: { en: "Location", hi: "लोकेशन" },
    body: {
      en: "The app reads your location only when you open the map, start a journey, or trigger SOS. It is shared with other people only when you tap a share, SMS, WhatsApp or call action yourself. To turn your coordinates into a readable address, the app may use your device's operating-system geocoding service.",
      hi: "ऐप आपकी लोकेशन तभी पढ़ता है जब आप मैप खोलती हैं, यात्रा शुरू करती हैं, या SOS दबाती हैं। यह अन्य लोगों के साथ तभी साझा होती है जब आप स्वयं शेयर, SMS, WhatsApp या कॉल पर टैप करती हैं। आपके निर्देशांक को पढ़ने योग्य पते में बदलने के लिए ऐप आपके डिवाइस की ऑपरेटिंग-सिस्टम जियोकोडिंग सेवा का उपयोग कर सकता है।",
    },
  },
  {
    heading: { en: "Sakhi chat uses AI", hi: "सखी चैट AI का उपयोग करती है" },
    body: {
      en: "When you message Sakhi, your messages are sent to our server, which forwards them to OpenAI to generate a reply. Please avoid sharing details you would not want processed by an AI provider. Sakhi conversations are not used to identify you and are not stored by us after the reply is generated.",
      hi: "जब आप सखी को संदेश भेजती हैं, तो आपके संदेश हमारे सर्वर को भेजे जाते हैं, जो उत्तर बनाने हेतु उन्हें OpenAI को अग्रेषित करता है। ऐसी जानकारी साझा करने से बचें जिसे आप किसी AI प्रदाता द्वारा संसाधित नहीं कराना चाहतीं। सखी की बातचीत से आपकी पहचान नहीं की जाती और उत्तर बनने के बाद हम इसे संग्रहीत नहीं करते।",
    },
  },
  {
    heading: { en: "No accounts, no tracking", hi: "कोई खाता नहीं, कोई ट्रैकिंग नहीं" },
    body: {
      en: "Suraksha has no sign-up or login. We do not use analytics, advertising or third-party trackers, and we do not sell any data.",
      hi: "सुरक्षा में कोई साइन-अप या लॉगिन नहीं है। हम एनालिटिक्स, विज्ञापन या तृतीय-पक्ष ट्रैकर्स का उपयोग नहीं करते, और कोई डेटा नहीं बेचते।",
    },
  },
  {
    heading: { en: "Deleting your data", hi: "अपना डेटा हटाना" },
    body: {
      en: "You can erase everything stored on your device at any time from Profile → Your Data & Account → Delete all my data.",
      hi: "आप अपने डिवाइस पर संग्रहीत सब कुछ कभी भी प्रोफ़ाइल → आपका डेटा और खाता → मेरा सारा डेटा हटाएँ से मिटा सकती हैं।",
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
      en: "The app is provided “as is”. Features depend on your device, permissions and network, and may not always work. Please do not rely on it as your only means of getting help.",
      hi: "ऐप “जैसा है” के आधार पर दिया गया है। सुविधाएँ आपके डिवाइस, अनुमतियों और नेटवर्क पर निर्भर करती हैं और हमेशा काम नहीं कर सकतीं। कृपया इसे सहायता पाने का एकमात्र साधन न मानें।",
    },
  },
];
