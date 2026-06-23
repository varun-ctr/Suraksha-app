/**
 * Compact country list for the phone number country-code picker.
 * India is always first; the rest follow alphabetically.
 */
export interface CountryOption {
  code: string;    // ISO 3166-1 alpha-2
  dial: string;    // E.164 prefix, e.g. "+91"
  name: string;
  flag: string;    // flag emoji
}

export const COUNTRIES: CountryOption[] = [
  // India always first
  { code: "IN", dial: "+91",  name: "India",                flag: "🇮🇳" },
  // Rest alphabetical
  { code: "AF", dial: "+93",  name: "Afghanistan",          flag: "🇦🇫" },
  { code: "DZ", dial: "+213", name: "Algeria",              flag: "🇩🇿" },
  { code: "AR", dial: "+54",  name: "Argentina",            flag: "🇦🇷" },
  { code: "AU", dial: "+61",  name: "Australia",            flag: "🇦🇺" },
  { code: "AZ", dial: "+994", name: "Azerbaijan",           flag: "🇦🇿" },
  { code: "BH", dial: "+973", name: "Bahrain",              flag: "🇧🇭" },
  { code: "BD", dial: "+880", name: "Bangladesh",           flag: "🇧🇩" },
  { code: "BE", dial: "+32",  name: "Belgium",              flag: "🇧🇪" },
  { code: "BR", dial: "+55",  name: "Brazil",               flag: "🇧🇷" },
  { code: "CA", dial: "+1",   name: "Canada",               flag: "🇨🇦" },
  { code: "CN", dial: "+86",  name: "China",                flag: "🇨🇳" },
  { code: "CO", dial: "+57",  name: "Colombia",             flag: "🇨🇴" },
  { code: "CD", dial: "+243", name: "DR Congo",             flag: "🇨🇩" },
  { code: "EG", dial: "+20",  name: "Egypt",                flag: "🇪🇬" },
  { code: "ET", dial: "+251", name: "Ethiopia",             flag: "🇪🇹" },
  { code: "FR", dial: "+33",  name: "France",               flag: "🇫🇷" },
  { code: "DE", dial: "+49",  name: "Germany",              flag: "🇩🇪" },
  { code: "GH", dial: "+233", name: "Ghana",                flag: "🇬🇭" },
  { code: "HK", dial: "+852", name: "Hong Kong",            flag: "🇭🇰" },
  { code: "HU", dial: "+36",  name: "Hungary",              flag: "🇭🇺" },
  { code: "ID", dial: "+62",  name: "Indonesia",            flag: "🇮🇩" },
  { code: "IR", dial: "+98",  name: "Iran",                 flag: "🇮🇷" },
  { code: "IQ", dial: "+964", name: "Iraq",                 flag: "🇮🇶" },
  { code: "IE", dial: "+353", name: "Ireland",              flag: "🇮🇪" },
  { code: "IL", dial: "+972", name: "Israel",               flag: "🇮🇱" },
  { code: "IT", dial: "+39",  name: "Italy",                flag: "🇮🇹" },
  { code: "JP", dial: "+81",  name: "Japan",                flag: "🇯🇵" },
  { code: "JO", dial: "+962", name: "Jordan",               flag: "🇯🇴" },
  { code: "KZ", dial: "+7",   name: "Kazakhstan",           flag: "🇰🇿" },
  { code: "KE", dial: "+254", name: "Kenya",                flag: "🇰🇪" },
  { code: "KW", dial: "+965", name: "Kuwait",               flag: "🇰🇼" },
  { code: "LB", dial: "+961", name: "Lebanon",              flag: "🇱🇧" },
  { code: "MY", dial: "+60",  name: "Malaysia",             flag: "🇲🇾" },
  { code: "MX", dial: "+52",  name: "Mexico",               flag: "🇲🇽" },
  { code: "MA", dial: "+212", name: "Morocco",              flag: "🇲🇦" },
  { code: "MM", dial: "+95",  name: "Myanmar",              flag: "🇲🇲" },
  { code: "NP", dial: "+977", name: "Nepal",                flag: "🇳🇵" },
  { code: "NL", dial: "+31",  name: "Netherlands",          flag: "🇳🇱" },
  { code: "NZ", dial: "+64",  name: "New Zealand",          flag: "🇳🇿" },
  { code: "NG", dial: "+234", name: "Nigeria",              flag: "🇳🇬" },
  { code: "OM", dial: "+968", name: "Oman",                 flag: "🇴🇲" },
  { code: "PK", dial: "+92",  name: "Pakistan",             flag: "🇵🇰" },
  { code: "PH", dial: "+63",  name: "Philippines",          flag: "🇵🇭" },
  { code: "PL", dial: "+48",  name: "Poland",               flag: "🇵🇱" },
  { code: "PT", dial: "+351", name: "Portugal",             flag: "🇵🇹" },
  { code: "QA", dial: "+974", name: "Qatar",                flag: "🇶🇦" },
  { code: "RO", dial: "+40",  name: "Romania",              flag: "🇷🇴" },
  { code: "RU", dial: "+7",   name: "Russia",               flag: "🇷🇺" },
  { code: "SA", dial: "+966", name: "Saudi Arabia",         flag: "🇸🇦" },
  { code: "SG", dial: "+65",  name: "Singapore",            flag: "🇸🇬" },
  { code: "ZA", dial: "+27",  name: "South Africa",         flag: "🇿🇦" },
  { code: "KR", dial: "+82",  name: "South Korea",          flag: "🇰🇷" },
  { code: "ES", dial: "+34",  name: "Spain",                flag: "🇪🇸" },
  { code: "LK", dial: "+94",  name: "Sri Lanka",            flag: "🇱🇰" },
  { code: "SE", dial: "+46",  name: "Sweden",               flag: "🇸🇪" },
  { code: "CH", dial: "+41",  name: "Switzerland",          flag: "🇨🇭" },
  { code: "TW", dial: "+886", name: "Taiwan",               flag: "🇹🇼" },
  { code: "TZ", dial: "+255", name: "Tanzania",             flag: "🇹🇿" },
  { code: "TH", dial: "+66",  name: "Thailand",             flag: "🇹🇭" },
  { code: "TR", dial: "+90",  name: "Turkey",               flag: "🇹🇷" },
  { code: "UG", dial: "+256", name: "Uganda",               flag: "🇺🇬" },
  { code: "UA", dial: "+380", name: "Ukraine",              flag: "🇺🇦" },
  { code: "AE", dial: "+971", name: "UAE",                  flag: "🇦🇪" },
  { code: "GB", dial: "+44",  name: "United Kingdom",       flag: "🇬🇧" },
  { code: "US", dial: "+1",   name: "United States",        flag: "🇺🇸" },
  { code: "UZ", dial: "+998", name: "Uzbekistan",           flag: "🇺🇿" },
  { code: "VN", dial: "+84",  name: "Vietnam",              flag: "🇻🇳" },
  { code: "YE", dial: "+967", name: "Yemen",                flag: "🇾🇪" },
  { code: "ZM", dial: "+260", name: "Zambia",               flag: "🇿🇲" },
  { code: "ZW", dial: "+263", name: "Zimbabwe",             flag: "🇿🇼" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India
