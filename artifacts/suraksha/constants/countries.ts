/**
 * Full country list for the phone-number country-code picker.
 * India is always first; the rest follow alphabetically by country name.
 * Covers all 193 UN member states plus Kosovo, Palestine, Taiwan, and Vatican City.
 */
export interface CountryOption {
  code: string;  // ISO 3166-1 alpha-2 (XK for Kosovo, PS for Palestine, TW for Taiwan)
  dial: string;  // E.164 prefix, e.g. "+91"
  name: string;
  flag: string;  // flag emoji
}

export const COUNTRIES: CountryOption[] = [
  // ── India first ────────────────────────────────────────────────────────────
  { code: "IN", dial: "+91",   name: "India",                        flag: "🇮🇳" },

  // ── A ──────────────────────────────────────────────────────────────────────
  { code: "AF", dial: "+93",   name: "Afghanistan",                  flag: "🇦🇫" },
  { code: "AL", dial: "+355",  name: "Albania",                      flag: "🇦🇱" },
  { code: "DZ", dial: "+213",  name: "Algeria",                      flag: "🇩🇿" },
  { code: "AD", dial: "+376",  name: "Andorra",                      flag: "🇦🇩" },
  { code: "AO", dial: "+244",  name: "Angola",                       flag: "🇦🇴" },
  { code: "AG", dial: "+1268", name: "Antigua & Barbuda",            flag: "🇦🇬" },
  { code: "AR", dial: "+54",   name: "Argentina",                    flag: "🇦🇷" },
  { code: "AM", dial: "+374",  name: "Armenia",                      flag: "🇦🇲" },
  { code: "AU", dial: "+61",   name: "Australia",                    flag: "🇦🇺" },
  { code: "AT", dial: "+43",   name: "Austria",                      flag: "🇦🇹" },
  { code: "AZ", dial: "+994",  name: "Azerbaijan",                   flag: "🇦🇿" },

  // ── B ──────────────────────────────────────────────────────────────────────
  { code: "BS", dial: "+1242", name: "Bahamas",                      flag: "🇧🇸" },
  { code: "BH", dial: "+973",  name: "Bahrain",                      flag: "🇧🇭" },
  { code: "BD", dial: "+880",  name: "Bangladesh",                   flag: "🇧🇩" },
  { code: "BB", dial: "+1246", name: "Barbados",                     flag: "🇧🇧" },
  { code: "BY", dial: "+375",  name: "Belarus",                      flag: "🇧🇾" },
  { code: "BE", dial: "+32",   name: "Belgium",                      flag: "🇧🇪" },
  { code: "BZ", dial: "+501",  name: "Belize",                       flag: "🇧🇿" },
  { code: "BJ", dial: "+229",  name: "Benin",                        flag: "🇧🇯" },
  { code: "BT", dial: "+975",  name: "Bhutan",                       flag: "🇧🇹" },
  { code: "BO", dial: "+591",  name: "Bolivia",                      flag: "🇧🇴" },
  { code: "BA", dial: "+387",  name: "Bosnia & Herzegovina",         flag: "🇧🇦" },
  { code: "BW", dial: "+267",  name: "Botswana",                     flag: "🇧🇼" },
  { code: "BR", dial: "+55",   name: "Brazil",                       flag: "🇧🇷" },
  { code: "BN", dial: "+673",  name: "Brunei",                       flag: "🇧🇳" },
  { code: "BG", dial: "+359",  name: "Bulgaria",                     flag: "🇧🇬" },
  { code: "BF", dial: "+226",  name: "Burkina Faso",                 flag: "🇧🇫" },
  { code: "BI", dial: "+257",  name: "Burundi",                      flag: "🇧🇮" },

  // ── C ──────────────────────────────────────────────────────────────────────
  { code: "KH", dial: "+855",  name: "Cambodia",                     flag: "🇰🇭" },
  { code: "CM", dial: "+237",  name: "Cameroon",                     flag: "🇨🇲" },
  { code: "CA", dial: "+1",    name: "Canada",                       flag: "🇨🇦" },
  { code: "CV", dial: "+238",  name: "Cape Verde",                   flag: "🇨🇻" },
  { code: "CF", dial: "+236",  name: "Central African Republic",     flag: "🇨🇫" },
  { code: "TD", dial: "+235",  name: "Chad",                         flag: "🇹🇩" },
  { code: "CL", dial: "+56",   name: "Chile",                        flag: "🇨🇱" },
  { code: "CN", dial: "+86",   name: "China",                        flag: "🇨🇳" },
  { code: "CO", dial: "+57",   name: "Colombia",                     flag: "🇨🇴" },
  { code: "KM", dial: "+269",  name: "Comoros",                      flag: "🇰🇲" },
  { code: "CG", dial: "+242",  name: "Congo",                        flag: "🇨🇬" },
  { code: "CD", dial: "+243",  name: "Congo (DRC)",                  flag: "🇨🇩" },
  { code: "CR", dial: "+506",  name: "Costa Rica",                   flag: "🇨🇷" },
  { code: "HR", dial: "+385",  name: "Croatia",                      flag: "🇭🇷" },
  { code: "CU", dial: "+53",   name: "Cuba",                         flag: "🇨🇺" },
  { code: "CY", dial: "+357",  name: "Cyprus",                       flag: "🇨🇾" },
  { code: "CZ", dial: "+420",  name: "Czech Republic",               flag: "🇨🇿" },
  { code: "CI", dial: "+225",  name: "Côte d'Ivoire",                flag: "🇨🇮" },

  // ── D ──────────────────────────────────────────────────────────────────────
  { code: "DK", dial: "+45",   name: "Denmark",                      flag: "🇩🇰" },
  { code: "DJ", dial: "+253",  name: "Djibouti",                     flag: "🇩🇯" },
  { code: "DM", dial: "+1767", name: "Dominica",                     flag: "🇩🇲" },
  { code: "DO", dial: "+1809", name: "Dominican Republic",           flag: "🇩🇴" },

  // ── E ──────────────────────────────────────────────────────────────────────
  { code: "EC", dial: "+593",  name: "Ecuador",                      flag: "🇪🇨" },
  { code: "EG", dial: "+20",   name: "Egypt",                        flag: "🇪🇬" },
  { code: "SV", dial: "+503",  name: "El Salvador",                  flag: "🇸🇻" },
  { code: "GQ", dial: "+240",  name: "Equatorial Guinea",            flag: "🇬🇶" },
  { code: "ER", dial: "+291",  name: "Eritrea",                      flag: "🇪🇷" },
  { code: "EE", dial: "+372",  name: "Estonia",                      flag: "🇪🇪" },
  { code: "SZ", dial: "+268",  name: "Eswatini",                     flag: "🇸🇿" },
  { code: "ET", dial: "+251",  name: "Ethiopia",                     flag: "🇪🇹" },

  // ── F ──────────────────────────────────────────────────────────────────────
  { code: "FJ", dial: "+679",  name: "Fiji",                         flag: "🇫🇯" },
  { code: "FI", dial: "+358",  name: "Finland",                      flag: "🇫🇮" },
  { code: "FR", dial: "+33",   name: "France",                       flag: "🇫🇷" },

  // ── G ──────────────────────────────────────────────────────────────────────
  { code: "GA", dial: "+241",  name: "Gabon",                        flag: "🇬🇦" },
  { code: "GM", dial: "+220",  name: "Gambia",                       flag: "🇬🇲" },
  { code: "GE", dial: "+995",  name: "Georgia",                      flag: "🇬🇪" },
  { code: "DE", dial: "+49",   name: "Germany",                      flag: "🇩🇪" },
  { code: "GH", dial: "+233",  name: "Ghana",                        flag: "🇬🇭" },
  { code: "GR", dial: "+30",   name: "Greece",                       flag: "🇬🇷" },
  { code: "GD", dial: "+1473", name: "Grenada",                      flag: "🇬🇩" },
  { code: "GT", dial: "+502",  name: "Guatemala",                    flag: "🇬🇹" },
  { code: "GN", dial: "+224",  name: "Guinea",                       flag: "🇬🇳" },
  { code: "GW", dial: "+245",  name: "Guinea-Bissau",                flag: "🇬🇼" },
  { code: "GY", dial: "+592",  name: "Guyana",                       flag: "🇬🇾" },

  // ── H ──────────────────────────────────────────────────────────────────────
  { code: "HT", dial: "+509",  name: "Haiti",                        flag: "🇭🇹" },
  { code: "HN", dial: "+504",  name: "Honduras",                     flag: "🇭🇳" },
  { code: "HU", dial: "+36",   name: "Hungary",                      flag: "🇭🇺" },

  // ── I ──────────────────────────────────────────────────────────────────────
  { code: "IS", dial: "+354",  name: "Iceland",                      flag: "🇮🇸" },
  { code: "ID", dial: "+62",   name: "Indonesia",                    flag: "🇮🇩" },
  { code: "IR", dial: "+98",   name: "Iran",                         flag: "🇮🇷" },
  { code: "IQ", dial: "+964",  name: "Iraq",                         flag: "🇮🇶" },
  { code: "IE", dial: "+353",  name: "Ireland",                      flag: "🇮🇪" },
  { code: "IL", dial: "+972",  name: "Israel",                       flag: "🇮🇱" },
  { code: "IT", dial: "+39",   name: "Italy",                        flag: "🇮🇹" },

  // ── J ──────────────────────────────────────────────────────────────────────
  { code: "JM", dial: "+1876", name: "Jamaica",                      flag: "🇯🇲" },
  { code: "JP", dial: "+81",   name: "Japan",                        flag: "🇯🇵" },
  { code: "JO", dial: "+962",  name: "Jordan",                       flag: "🇯🇴" },

  // ── K ──────────────────────────────────────────────────────────────────────
  { code: "KZ", dial: "+7",    name: "Kazakhstan",                   flag: "🇰🇿" },
  { code: "KE", dial: "+254",  name: "Kenya",                        flag: "🇰🇪" },
  { code: "KI", dial: "+686",  name: "Kiribati",                     flag: "🇰🇮" },
  { code: "XK", dial: "+383",  name: "Kosovo",                       flag: "🇽🇰" },
  { code: "KW", dial: "+965",  name: "Kuwait",                       flag: "🇰🇼" },
  { code: "KG", dial: "+996",  name: "Kyrgyzstan",                   flag: "🇰🇬" },

  // ── L ──────────────────────────────────────────────────────────────────────
  { code: "LA", dial: "+856",  name: "Laos",                         flag: "🇱🇦" },
  { code: "LV", dial: "+371",  name: "Latvia",                       flag: "🇱🇻" },
  { code: "LB", dial: "+961",  name: "Lebanon",                      flag: "🇱🇧" },
  { code: "LS", dial: "+266",  name: "Lesotho",                      flag: "🇱🇸" },
  { code: "LR", dial: "+231",  name: "Liberia",                      flag: "🇱🇷" },
  { code: "LY", dial: "+218",  name: "Libya",                        flag: "🇱🇾" },
  { code: "LI", dial: "+423",  name: "Liechtenstein",                flag: "🇱🇮" },
  { code: "LT", dial: "+370",  name: "Lithuania",                    flag: "🇱🇹" },
  { code: "LU", dial: "+352",  name: "Luxembourg",                   flag: "🇱🇺" },

  // ── M ──────────────────────────────────────────────────────────────────────
  { code: "MG", dial: "+261",  name: "Madagascar",                   flag: "🇲🇬" },
  { code: "MW", dial: "+265",  name: "Malawi",                       flag: "🇲🇼" },
  { code: "MY", dial: "+60",   name: "Malaysia",                     flag: "🇲🇾" },
  { code: "MV", dial: "+960",  name: "Maldives",                     flag: "🇲🇻" },
  { code: "ML", dial: "+223",  name: "Mali",                         flag: "🇲🇱" },
  { code: "MT", dial: "+356",  name: "Malta",                        flag: "🇲🇹" },
  { code: "MH", dial: "+692",  name: "Marshall Islands",             flag: "🇲🇭" },
  { code: "MR", dial: "+222",  name: "Mauritania",                   flag: "🇲🇷" },
  { code: "MU", dial: "+230",  name: "Mauritius",                    flag: "🇲🇺" },
  { code: "MX", dial: "+52",   name: "Mexico",                       flag: "🇲🇽" },
  { code: "FM", dial: "+691",  name: "Micronesia",                   flag: "🇫🇲" },
  { code: "MD", dial: "+373",  name: "Moldova",                      flag: "🇲🇩" },
  { code: "MC", dial: "+377",  name: "Monaco",                       flag: "🇲🇨" },
  { code: "MN", dial: "+976",  name: "Mongolia",                     flag: "🇲🇳" },
  { code: "ME", dial: "+382",  name: "Montenegro",                   flag: "🇲🇪" },
  { code: "MA", dial: "+212",  name: "Morocco",                      flag: "🇲🇦" },
  { code: "MZ", dial: "+258",  name: "Mozambique",                   flag: "🇲🇿" },
  { code: "MM", dial: "+95",   name: "Myanmar",                      flag: "🇲🇲" },

  // ── N ──────────────────────────────────────────────────────────────────────
  { code: "NA", dial: "+264",  name: "Namibia",                      flag: "🇳🇦" },
  { code: "NR", dial: "+674",  name: "Nauru",                        flag: "🇳🇷" },
  { code: "NP", dial: "+977",  name: "Nepal",                        flag: "🇳🇵" },
  { code: "NL", dial: "+31",   name: "Netherlands",                  flag: "🇳🇱" },
  { code: "NZ", dial: "+64",   name: "New Zealand",                  flag: "🇳🇿" },
  { code: "NI", dial: "+505",  name: "Nicaragua",                    flag: "🇳🇮" },
  { code: "NE", dial: "+227",  name: "Niger",                        flag: "🇳🇪" },
  { code: "NG", dial: "+234",  name: "Nigeria",                      flag: "🇳🇬" },
  { code: "KP", dial: "+850",  name: "North Korea",                  flag: "🇰🇵" },
  { code: "MK", dial: "+389",  name: "North Macedonia",              flag: "🇲🇰" },
  { code: "NO", dial: "+47",   name: "Norway",                       flag: "🇳🇴" },

  // ── O ──────────────────────────────────────────────────────────────────────
  { code: "OM", dial: "+968",  name: "Oman",                         flag: "🇴🇲" },

  // ── P ──────────────────────────────────────────────────────────────────────
  { code: "PK", dial: "+92",   name: "Pakistan",                     flag: "🇵🇰" },
  { code: "PW", dial: "+680",  name: "Palau",                        flag: "🇵🇼" },
  { code: "PS", dial: "+970",  name: "Palestine",                    flag: "🇵🇸" },
  { code: "PA", dial: "+507",  name: "Panama",                       flag: "🇵🇦" },
  { code: "PG", dial: "+675",  name: "Papua New Guinea",             flag: "🇵🇬" },
  { code: "PY", dial: "+595",  name: "Paraguay",                     flag: "🇵🇾" },
  { code: "PE", dial: "+51",   name: "Peru",                         flag: "🇵🇪" },
  { code: "PH", dial: "+63",   name: "Philippines",                  flag: "🇵🇭" },
  { code: "PL", dial: "+48",   name: "Poland",                       flag: "🇵🇱" },
  { code: "PT", dial: "+351",  name: "Portugal",                     flag: "🇵🇹" },

  // ── Q ──────────────────────────────────────────────────────────────────────
  { code: "QA", dial: "+974",  name: "Qatar",                        flag: "🇶🇦" },

  // ── R ──────────────────────────────────────────────────────────────────────
  { code: "RO", dial: "+40",   name: "Romania",                      flag: "🇷🇴" },
  { code: "RU", dial: "+7",    name: "Russia",                       flag: "🇷🇺" },
  { code: "RW", dial: "+250",  name: "Rwanda",                       flag: "🇷🇼" },

  // ── S ──────────────────────────────────────────────────────────────────────
  { code: "KN", dial: "+1869", name: "Saint Kitts & Nevis",          flag: "🇰🇳" },
  { code: "LC", dial: "+1758", name: "Saint Lucia",                  flag: "🇱🇨" },
  { code: "VC", dial: "+1784", name: "Saint Vincent & Grenadines",   flag: "🇻🇨" },
  { code: "WS", dial: "+685",  name: "Samoa",                        flag: "🇼🇸" },
  { code: "SM", dial: "+378",  name: "San Marino",                   flag: "🇸🇲" },
  { code: "ST", dial: "+239",  name: "São Tomé & Príncipe",          flag: "🇸🇹" },
  { code: "SA", dial: "+966",  name: "Saudi Arabia",                 flag: "🇸🇦" },
  { code: "SN", dial: "+221",  name: "Senegal",                      flag: "🇸🇳" },
  { code: "RS", dial: "+381",  name: "Serbia",                       flag: "🇷🇸" },
  { code: "SC", dial: "+248",  name: "Seychelles",                   flag: "🇸🇨" },
  { code: "SL", dial: "+232",  name: "Sierra Leone",                 flag: "🇸🇱" },
  { code: "SG", dial: "+65",   name: "Singapore",                    flag: "🇸🇬" },
  { code: "SK", dial: "+421",  name: "Slovakia",                     flag: "🇸🇰" },
  { code: "SI", dial: "+386",  name: "Slovenia",                     flag: "🇸🇮" },
  { code: "SB", dial: "+677",  name: "Solomon Islands",              flag: "🇸🇧" },
  { code: "SO", dial: "+252",  name: "Somalia",                      flag: "🇸🇴" },
  { code: "ZA", dial: "+27",   name: "South Africa",                 flag: "🇿🇦" },
  { code: "KR", dial: "+82",   name: "South Korea",                  flag: "🇰🇷" },
  { code: "SS", dial: "+211",  name: "South Sudan",                  flag: "🇸🇸" },
  { code: "ES", dial: "+34",   name: "Spain",                        flag: "🇪🇸" },
  { code: "LK", dial: "+94",   name: "Sri Lanka",                    flag: "🇱🇰" },
  { code: "SD", dial: "+249",  name: "Sudan",                        flag: "🇸🇩" },
  { code: "SR", dial: "+597",  name: "Suriname",                     flag: "🇸🇷" },
  { code: "SE", dial: "+46",   name: "Sweden",                       flag: "🇸🇪" },
  { code: "CH", dial: "+41",   name: "Switzerland",                  flag: "🇨🇭" },
  { code: "SY", dial: "+963",  name: "Syria",                        flag: "🇸🇾" },

  // ── T ──────────────────────────────────────────────────────────────────────
  { code: "TW", dial: "+886",  name: "Taiwan",                       flag: "🇹🇼" },
  { code: "TJ", dial: "+992",  name: "Tajikistan",                   flag: "🇹🇯" },
  { code: "TZ", dial: "+255",  name: "Tanzania",                     flag: "🇹🇿" },
  { code: "TH", dial: "+66",   name: "Thailand",                     flag: "🇹🇭" },
  { code: "TL", dial: "+670",  name: "Timor-Leste",                  flag: "🇹🇱" },
  { code: "TG", dial: "+228",  name: "Togo",                         flag: "🇹🇬" },
  { code: "TO", dial: "+676",  name: "Tonga",                        flag: "🇹🇴" },
  { code: "TT", dial: "+1868", name: "Trinidad & Tobago",            flag: "🇹🇹" },
  { code: "TN", dial: "+216",  name: "Tunisia",                      flag: "🇹🇳" },
  { code: "TR", dial: "+90",   name: "Turkey",                       flag: "🇹🇷" },
  { code: "TM", dial: "+993",  name: "Turkmenistan",                 flag: "🇹🇲" },
  { code: "TV", dial: "+688",  name: "Tuvalu",                       flag: "🇹🇻" },

  // ── U ──────────────────────────────────────────────────────────────────────
  { code: "AE", dial: "+971",  name: "UAE",                          flag: "🇦🇪" },
  { code: "UG", dial: "+256",  name: "Uganda",                       flag: "🇺🇬" },
  { code: "UA", dial: "+380",  name: "Ukraine",                      flag: "🇺🇦" },
  { code: "GB", dial: "+44",   name: "United Kingdom",               flag: "🇬🇧" },
  { code: "US", dial: "+1",    name: "United States",                flag: "🇺🇸" },
  { code: "UY", dial: "+598",  name: "Uruguay",                      flag: "🇺🇾" },
  { code: "UZ", dial: "+998",  name: "Uzbekistan",                   flag: "🇺🇿" },

  // ── V ──────────────────────────────────────────────────────────────────────
  { code: "VU", dial: "+678",  name: "Vanuatu",                      flag: "🇻🇺" },
  { code: "VA", dial: "+39",   name: "Vatican City",                 flag: "🇻🇦" },
  { code: "VE", dial: "+58",   name: "Venezuela",                    flag: "🇻🇪" },
  { code: "VN", dial: "+84",   name: "Vietnam",                      flag: "🇻🇳" },

  // ── Y ──────────────────────────────────────────────────────────────────────
  { code: "YE", dial: "+967",  name: "Yemen",                        flag: "🇾🇪" },

  // ── Z ──────────────────────────────────────────────────────────────────────
  { code: "ZM", dial: "+260",  name: "Zambia",                       flag: "🇿🇲" },
  { code: "ZW", dial: "+263",  name: "Zimbabwe",                     flag: "🇿🇼" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India
