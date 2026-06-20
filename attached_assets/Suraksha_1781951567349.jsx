import React, { useState, useEffect } from 'react';

/* ---------------------------------------------------------------
   Suraksha (सुरक्षा) — Women's Safety & Empowerment App Demo
   Single-file React component. Inline styles + inline SVG icons only.
---------------------------------------------------------------- */

const COLORS = {
  primary: '#5B2FBF',
  primaryDark: '#3F1F8C',
  primaryLight: '#8B68DC',
  accent: '#D91A7A',
  accentDark: '#A8125C',
  success: '#0E9B6B',
  warning: '#C47D0E',
  text: '#1A1035',
  textMuted: '#6E6485',
  textFaint: '#A099B4',
  bg: '#F6F3FB',
  card: '#FFFFFF',
  border: '#E9E3F4',
  police: '#2454C7',
  hospital: '#D91A7A',
  shelter: '#0E9B6B',
  shops: '#C47D0E',
};

/* ---------------------------- ICONS ---------------------------- */

function Icon({ name, size = 22, color = COLORS.text, strokeWidth = 2 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  const paths = {
    bell: (
      <>
        <path d="M12 3.5c-2.2 0-4 1.8-4 4v2.6c0 .9-.35 1.8-1 2.4L6 13.5h12l-1-1c-.65-.6-1-1.5-1-2.4V7.5c0-2.2-1.8-4-4-4Z" />
        <path d="M10 17a2 2 0 0 0 4 0" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3.5 21 19.5H3Z" />
        <line x1="12" y1="9.5" x2="12" y2="14" />
        <line x1="12" y1="16.3" x2="12" y2="16.4" />
      </>
    ),
    mapPin: (
      <>
        <path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 12 3.5 6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11Z" />
        <circle cx="12" cy="10" r="2.2" />
      </>
    ),
    home: (
      <>
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9h5v-5h2v5h5v-9" />
      </>
    ),
    map: (
      <>
        <polygon points="3,6 9,4 15,6 21,4 21,18 15,20 9,18 3,20" />
        <line x1="9" y1="4" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="20" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5a2 2 0 0 1 2-2h6v15H6a2 2 0 0 0-2 2Z" />
        <path d="M12 3.5h6a2 2 0 0 1 2 2V19a2 2 0 0 0-2-2h-6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
      </>
    ),
    phone: (
      <path d="M6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5C11.5 18.2 5.8 12.5 4.5 6.1A1.5 1.5 0 0 1 6 3.5Z" />
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    x: (
      <>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </>
    ),
    check: <polyline points="5,13 10,18 19,7" />,
    chevronRight: <polyline points="9,5 16,12 9,19" />,
    chevronDown: <polyline points="5,9 12,16 19,9" />,
    arrowLeft: (
      <>
        <polyline points="14,5 7,12 14,19" />
        <line x1="7" y1="12" x2="19" y2="12" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
        <circle cx="17" cy="9" r="2.3" />
        <path d="M15.5 13.2c2.3.3 4 2 4 5.8" />
      </>
    ),
    store: (
      <>
        <path d="M4 9 5 4h14l1 5" />
        <path d="M4 9v9.5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
        <path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      </>
    ),
    hospital: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 19 6v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6Z" />
        <polyline points="9,12 11,14 15,9.5" />
      </>
    ),
    navigation: <polygon points="12,3 19,20 12,16 5,20" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <polyline points="12,7 12,12 16,14" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <line x1="16" y1="16" x2="20.5" y2="20.5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="7.5" x2="12" y2="7.6" />
      </>
    ),
    lock: (
      <>
        <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <path d="M12 3.5c2.5 2.3 2.5 14.7 0 17" />
        <path d="M12 3.5c-2.5 2.3-2.5 14.7 0 17" />
      </>
    ),
    fileText: (
      <>
        <path d="M6 3.5h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
        <line x1="8.5" y1="11" x2="15.5" y2="11" />
        <line x1="8.5" y1="14.5" x2="15.5" y2="14.5" />
      </>
    ),
    helpCircle: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M9.5 9.2a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1.9-1.1 1.8" />
        <line x1="12" y1="16.5" x2="12" y2="16.6" />
      </>
    ),
    crown: <polyline points="4,8 8,12 12,6 16,12 20,8 19,17 5,17" />,
  };

  return <svg {...props}>{paths[name] || null}</svg>;
}

/* ---------------------------- DATA ---------------------------- */

const QUICK_ACTIONS = [
  { key: 'safe', label: 'Safe Places', hi: 'सुरक्षित स्थान', icon: 'mapPin', color: COLORS.primary },
  { key: 'rights', label: 'Know Your Rights', hi: 'अपने अधिकार जानें', icon: 'book', color: COLORS.police },
  { key: 'addcontact', label: 'Add Contact', hi: 'संपर्क जोड़ें', icon: 'users', color: COLORS.success },
  { key: 'helpline', label: 'Helpline', hi: 'हेल्पलाइन', icon: 'phone', color: COLORS.accent },
];

const PLACES = [
  { id: 1, name: 'Koramangala Police Station', category: 'Police', address: '80 Feet Rd, Koramangala 4th Block', distance: '0.4 km', x: 32, y: 36 },
  { id: 2, name: "St. John's Medical College Hospital", category: 'Hospital', address: 'Sarjapur Road, Koramangala', distance: '1.2 km', x: 64, y: 24 },
  { id: 3, name: 'Sakhi One Stop Centre', category: 'Shelter', address: 'Near BDA Complex, Koramangala', distance: '2.1 km', x: 50, y: 64 },
  { id: 4, name: 'Forum Mall Koramangala', category: 'Shops', address: 'Hosur Road, Koramangala', distance: '0.8 km', x: 74, y: 56 },
  { id: 5, name: 'Jyoti Nivas Police Outpost', category: 'Police', address: '5th Block, Koramangala', distance: '1.5 km', x: 18, y: 66 },
  { id: 6, name: 'Cloudnine Hospital', category: 'Hospital', address: 'Old Airport Road', distance: '2.4 km', x: 82, y: 36 },
  { id: 7, name: 'Swadhar Greh Shelter Home', category: 'Shelter', address: 'Ejipura, Bengaluru', distance: '3.0 km', x: 34, y: 82 },
  { id: 8, name: '5th Block Market', category: 'Shops', address: '5th Block, Koramangala', distance: '0.6 km', x: 56, y: 16 },
];

const RIGHTS = [
  {
    id: 1,
    title: 'POSH Act, 2013',
    subtitle: 'Sexual Harassment of Women at Workplace',
    icon: 'shield',
    color: COLORS.primary,
    en: 'Protects women from sexual harassment at the workplace. Employers with 10 or more employees must set up an Internal Committee (IC) to handle complaints.',
    hi: 'महिलाओं को कार्यस्थल पर यौन उत्पीड़न से सुरक्षा देता है। 10 या अधिक कर्मचारियों वाले हर नियोक्ता को शिकायतों के लिए आंतरिक समिति (IC) बनानी अनिवार्य है।',
    steps: [
      'Write a complaint to the Internal Committee (IC) within 3 months of the incident.',
      'The IC must complete its inquiry and submit a report within 90 days.',
      'You can request interim relief such as transfer or leave during the inquiry.',
      "If unsatisfied with the outcome, you can appeal in court within 90 days of the IC's report.",
    ],
  },
  {
    id: 2,
    title: 'POCSO Act, 2012',
    subtitle: 'Protection of Children from Sexual Offences',
    icon: 'users',
    color: COLORS.accent,
    en: 'Protects children under 18 from sexual abuse and exploitation, and mandates child-friendly procedures in police stations and courts.',
    hi: '18 वर्ष से कम आयु के बच्चों को यौन शोषण से बचाता है, और पुलिस व अदालत में बाल-सुलभ प्रक्रिया अनिवार्य करता है।',
    steps: [
      'Call Childline at 1098 immediately — it is free and available 24x7.',
      'Reporting is legally mandatory for anyone who becomes aware of the offence.',
      "The child's statement is recorded in the presence of a parent or trusted adult.",
      "The trial is conducted in-camera to protect the child's identity.",
    ],
  },
  {
    id: 3,
    title: 'Domestic Violence Act, 2005',
    subtitle: 'Protection of Women from Domestic Violence',
    icon: 'home',
    color: COLORS.warning,
    en: 'Gives women the right to live free from violence at home, and to seek protection orders, residence rights and maintenance.',
    hi: 'महिलाओं को घर में हिंसा से मुक्त रहने तथा सुरक्षा आदेश, निवास अधिकार और भरण-पोषण पाने का अधिकार देता है।',
    steps: [
      'Approach a Protection Officer or file a complaint directly with the Magistrate.',
      'Request a Protection Order to stop the abuser from contacting you.',
      'Ask for a Residence Order to continue living in the shared household.',
      'Apply for monetary relief to cover medical costs and lost income.',
    ],
  },
  {
    id: 4,
    title: 'IPC Section 354',
    subtitle: 'Assault on a Woman to Outrage Her Modesty',
    icon: 'alert',
    color: COLORS.police,
    en: 'Makes it a criminal offence to assault or use force against a woman with the intent to outrage her modesty, punishable with imprisonment.',
    hi: 'महिला की मर्यादा भंग करने के इरादे से हमला या बल प्रयोग करना दंडनीय अपराध है, जिसमें कारावास की सजा हो सकती है।',
    steps: [
      'File an FIR at the nearest police station — this is a cognizable offence.',
      'The police cannot refuse to register your FIR.',
      'You may request a woman police officer to record your statement.',
      'Free legal aid is available through the District Legal Services Authority.',
    ],
  },
];

const HELPLINES = [
  { name: 'Women Helpline', hi: 'महिला हेल्पलाइन', number: '1091', desc: '24x7 support for women in distress', color: COLORS.accent },
  { name: 'Police', hi: 'पुलिस', number: '100', desc: 'For immediate police assistance', color: COLORS.police },
  { name: 'Childline', hi: 'चाइल्डलाइन', number: '1098', desc: 'For children in need of care and protection', color: COLORS.warning },
  { name: 'Domestic Violence Helpline', hi: 'घरेलू हिंसा हेल्पलाइन', number: '181', desc: '24x7 helpline for women facing violence at home', color: COLORS.primary },
  { name: 'AASRA — Crisis Line', hi: 'आसरा — संकट रेखा', number: '9820466726', desc: 'Emotional support & suicide-prevention helpline', color: COLORS.success },
];

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${COLORS.border}`,
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  color: COLORS.text,
  outline: 'none',
  fontFamily: 'inherit',
};

/* ------------------------- SMALL PIECES ------------------------- */

function ToggleSwitch({ on, onChange }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        background: on ? COLORS.success : '#D8D2E6',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background .2s',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 23 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: COLORS.border, marginLeft: 43 }} />;
}

function Row({ icon, label, hi, right, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Icon name={icon} size={17} color={COLORS.primary} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{label}</div>
        {hi && <div style={{ fontSize: 10.5, color: COLORS.textMuted }}>{hi}</div>}
      </div>
      {right}
    </div>
  );
}

function BackHeader({ title, subtitle, onBack }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 18px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.card,
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <div
        onClick={onBack}
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: '#F1ECFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <Icon name="arrowLeft" size={16} color={COLORS.primary} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div
      style={{
        height: 34,
        padding: '0 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 65,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          <div style={{ width: 3, height: 4, background: COLORS.text, borderRadius: 1 }} />
          <div style={{ width: 3, height: 6, background: COLORS.text, borderRadius: 1 }} />
          <div style={{ width: 3, height: 8, background: COLORS.text, borderRadius: 1 }} />
          <div style={{ width: 3, height: 10, background: COLORS.text, borderRadius: 1 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>5G</span>
        <div
          style={{
            width: 22,
            height: 11,
            border: `1.5px solid ${COLORS.text}`,
            borderRadius: 3,
            padding: 1,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '80%', height: '100%', background: COLORS.text, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'map', label: 'Safety Map', icon: 'map' },
    { key: 'rights', label: 'My Rights', icon: 'book' },
    { key: 'profile', label: 'Profile', icon: 'user' },
  ];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: '#FFFFFF',
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        zIndex: 55,
      }}
    >
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <div
            key={it.key}
            onClick={() => setTab(it.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              cursor: 'pointer',
            }}
          >
            <Icon name={it.icon} size={21} color={active ? COLORS.primary : COLORS.textFaint} strokeWidth={active ? 2.3 : 2} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? COLORS.primary : COLORS.textFaint }}>
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const fmtClock = (s) => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

/* ----------------------------- HOME ----------------------------- */

function HomeScreen({ contacts, journey, selectedDuration, setSelectedDuration, startJourney, endJourney, onSOS, onQuickAction }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, padding: '18px 18px 50px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 700,
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>नमस्ते,</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Ananya Rao</div>
            </div>
          </div>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="bell" size={18} color="#fff" />
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.16)',
            padding: '6px 12px',
            borderRadius: 20,
          }}
        >
          <Icon name="mapPin" size={13} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Koramangala, Bengaluru</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#BFF4DC' }}>सुरक्षित क्षेत्र</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: -46, marginBottom: 18 }}>
        <div
          onClick={onSOS}
          style={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${COLORS.accent}, ${COLORS.accentDark})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 14px 30px rgba(217,26,122,0.45)',
            border: '5px solid #fff',
            animation: 'sosPulse 2.2s infinite',
          }}
        >
          <Icon name="bell" size={36} color="#fff" strokeWidth={2.2} />
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 17, marginTop: 4, letterSpacing: 0.5 }}>SOS</span>
        </div>
        <span style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 10, fontWeight: 500, textAlign: 'center', padding: '0 30px' }}>
          दबाएँ और तुरंत सहायता पाएं · Tap for instant help
        </span>
      </div>

      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {QUICK_ACTIONS.map((qa) => (
            <div
              key={qa.key}
              onClick={() => onQuickAction(qa.key)}
              style={{
                background: COLORS.card,
                borderRadius: 16,
                padding: '14px 14px',
                border: `1px solid ${COLORS.border}`,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,16,53,0.04)',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `${qa.color}1A`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Icon name={qa.icon} size={18} color={qa.color} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{qa.label}</div>
              <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 }}>{qa.hi}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: COLORS.card,
            borderRadius: 16,
            padding: 16,
            border: `1px solid ${COLORS.border}`,
            marginBottom: 20,
            boxShadow: '0 2px 8px rgba(26,16,53,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Icon name="navigation" size={16} color={COLORS.primary} />
            <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Journey Sharing</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12 }}>यात्रा के दौरान लाइव लोकेशन शेयर करें</div>

          {!journey.active ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[15, 30, 60].map((d) => (
                  <div
                    key={d}
                    onClick={() => setSelectedDuration(d)}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      padding: '8px 0',
                      borderRadius: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: selectedDuration === d ? COLORS.primary : '#F1ECFA',
                      color: selectedDuration === d ? '#fff' : COLORS.primary,
                    }}
                  >
                    {d} min
                  </div>
                ))}
              </div>
              <div
                onClick={startJourney}
                style={{
                  background: COLORS.primary,
                  color: '#fff',
                  textAlign: 'center',
                  padding: '11px 0',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Start Sharing
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: '#E9F9F2',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 12,
                }}
              >
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS.success, animation: 'dotPulse 1.6s infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.success }}>Sharing live · {fmtClock(journey.seconds)}</span>
                <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 'auto' }}>of {selectedDuration} min</span>
              </div>
              <div
                onClick={endJourney}
                style={{
                  background: COLORS.success,
                  color: '#fff',
                  textAlign: 'center',
                  padding: '11px 0',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                I've Arrived Safely
              </div>
            </>
          )}
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Trusted Contacts · विश्वसनीय संपर्क</div>
          {contacts.slice(0, 4).map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 14,
                padding: '10px 12px',
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: COLORS.primaryLight,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {c.name.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: COLORS.textMuted }}>{c.phone}</div>
              </div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#E9F9F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="phone" size={15} color={COLORS.success} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- SAFETY MAP --------------------------- */

function MapScreen({ mapFilter, setMapFilter, expandedPlace, setExpandedPlace, showToast }) {
  const filters = ['All', 'Police', 'Hospital', 'Shelter', 'Shops'];
  const catColor = { Police: COLORS.police, Hospital: COLORS.hospital, Shelter: COLORS.shelter, Shops: COLORS.shops };
  const catIcon = { Police: 'shield', Hospital: 'hospital', Shelter: 'home', Shops: 'store' };
  const filtered = mapFilter === 'All' ? PLACES : PLACES.filter((p) => p.category === mapFilter);

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ padding: '16px 18px 10px' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text }}>Safety Map</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>आस-पास सुरक्षित स्थान खोजें</div>
      </div>

      <div
        style={{
          margin: '8px 18px 14px',
          height: 230,
          borderRadius: 18,
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg,#CFE8D6 0%,#BFE0DB 35%,#D9E7C8 70%,#CFE0CF 100%)',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(26,16,53,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(26,16,53,0.06) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div style={{ position: 'absolute', top: '46%', left: 0, right: 0, height: 6, background: 'rgba(255,255,255,0.65)' }} />
        <div style={{ position: 'absolute', left: '40%', top: 0, bottom: 0, width: 6, background: 'rgba(255,255,255,0.65)' }} />

        <div style={{ position: 'absolute', left: '45%', top: '48%', transform: 'translate(-50%,-50%)' }}>
          <div
            style={{
              position: 'absolute',
              inset: -9,
              borderRadius: '50%',
              border: `2px solid ${COLORS.primary}`,
              animation: 'ringPulse 1.8s infinite',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: COLORS.primary,
              border: '3px solid #fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            }}
          />
        </div>

        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => setExpandedPlace(p.id)}
            style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%,-100%)', cursor: 'pointer' }}
          >
            <svg width="26" height="32" viewBox="0 0 24 30">
              <path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.5 12 30 12 30s12-9.5 12-18.2C24 5.3 18.6 0 12 0Z" fill={catColor[p.category]} />
              <circle cx="12" cy="11.5" r="5" fill="#fff" />
            </svg>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '0 18px 14px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {filters.map((f) => (
          <div
            key={f}
            onClick={() => setMapFilter(f)}
            style={{
              flexShrink: 0,
              padding: '7px 16px',
              borderRadius: 18,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: mapFilter === f ? COLORS.primary : '#fff',
              color: mapFilter === f ? '#fff' : COLORS.textMuted,
              border: `1px solid ${mapFilter === f ? COLORS.primary : COLORS.border}`,
            }}
          >
            {f}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 18px' }}>
        {filtered.map((p) => {
          const expanded = expandedPlace === p.id;
          return (
            <div key={p.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div onClick={() => setExpandedPlace(expanded ? null : p.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${catColor[p.category]}1A`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={catIcon[p.category]} size={17} color={catColor[p.category]} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 }}>{p.address}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: 11, color: COLORS.textMuted }}>{p.distance}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.success, background: '#E9F9F2', padding: '2px 8px', borderRadius: 10 }}>
                      ✓ Safe
                    </span>
                  </div>
                </div>
                <div style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  <Icon name="chevronDown" size={16} color={COLORS.textFaint} />
                </div>
              </div>
              {expanded && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                  <div
                    onClick={() => showToast(`Calling ${p.name}...`)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: COLORS.success,
                      color: '#fff',
                      padding: '9px 0',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="phone" size={14} color="#fff" /> Call Now
                  </div>
                  <div
                    onClick={() => showToast(`Navigating to ${p.name}...`)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: COLORS.primary,
                      color: '#fff',
                      padding: '9px 0',
                      borderRadius: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name="navigation" size={14} color="#fff" /> Navigate
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------- KNOW YOUR RIGHTS -------------------------- */

function RightsScreen({ rightsLang, setRightsLang, expandedRight, setExpandedRight, showToast }) {
  const numbers = [
    { label: 'Police', hi: 'पुलिस', num: '100' },
    { label: 'Women Helpline', hi: 'महिला हेल्पलाइन', num: '1091' },
    { label: 'Childline', hi: 'चाइल्डलाइन', num: '1098' },
  ];
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.police}, #173A8C)`, padding: '18px 18px 24px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>अपने अधिकार जानें</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Know Your Rights</div>
          </div>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: 3 }}>
            {['EN', 'HI'].map((l) => (
              <div
                key={l}
                onClick={() => setRightsLang(l)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 16,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: rightsLang === l ? '#fff' : 'transparent',
                  color: rightsLang === l ? COLORS.police : '#fff',
                }}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {numbers.map((n) => (
            <div
              key={n.num}
              onClick={() => showToast(`Calling ${n.num}...`)}
              style={{
                flex: 1,
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.accent }}>{n.num}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: COLORS.text, marginTop: 2 }}>{n.label}</div>
              <div style={{ fontSize: 9.5, color: COLORS.textMuted }}>{n.hi}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Legal Protections · कानूनी सुरक्षा</div>

        {RIGHTS.map((r) => {
          const expanded = expandedRight === r.id;
          return (
            <div key={r.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 10 }}>
              <div onClick={() => setExpandedRight(expanded ? null : r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${r.color}1A`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={r.icon} size={18} color={r.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>{r.subtitle}</div>
                </div>
                <div style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                  <Icon name="chevronDown" size={16} color={COLORS.textFaint} />
                </div>
              </div>
              {expanded && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 12.5, color: COLORS.text, lineHeight: 1.6, marginBottom: 12 }}>
                    {rightsLang === 'EN' ? r.en : r.hi}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: r.color, marginBottom: 8 }}>Steps to take · क्या करें</div>
                  {r.steps.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: `${r.color}1A`,
                          color: r.color,
                          fontSize: 10.5,
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{s}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- PROFILE ----------------------------- */

function ProfileScreen({ notifOn, setNotifOn, bgLocOn, setBgLocOn, profileLang, setProfileLang, showToast }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`, padding: '22px 18px 28px', color: '#fff', textAlign: 'center' }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            margin: '0 auto 10px',
          }}
        >
          A
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Ananya Rao</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>+91 98765 12345</div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255,255,255,0.18)',
            padding: '5px 12px',
            borderRadius: 16,
            marginTop: 10,
          }}
        >
          <Icon name="crown" size={13} color="#FFD66B" />
          <span style={{ fontSize: 11.5, fontWeight: 700 }}>Premium Member</span>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Settings
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, marginBottom: 18, overflow: 'hidden' }}>
          <Row icon="bell" label="Notifications" hi="सूचनाएं" right={<ToggleSwitch on={notifOn} onChange={setNotifOn} />} />
          <Divider />
          <Row icon="mapPin" label="Background Location" hi="बैकग्राउंड लोकेशन" right={<ToggleSwitch on={bgLocOn} onChange={setBgLocOn} />} />
          <Divider />
          <Row
            icon="globe"
            label="App Language"
            hi="भाषा"
            right={
              <select
                value={profileLang}
                onChange={(e) => setProfileLang(e.target.value)}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: '5px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.text,
                  background: '#fff',
                }}
              >
                {['Hindi', 'English', 'Tamil', 'Telugu', 'Bengali'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            }
          />
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Account
        </div>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, marginBottom: 18, overflow: 'hidden' }}>
          <Row icon="lock" label="Privacy Policy" onClick={() => showToast('Opening Privacy Policy...')} right={<Icon name="chevronRight" size={15} color={COLORS.textFaint} />} />
          <Divider />
          <Row icon="info" label="About Suraksha" onClick={() => showToast('Suraksha v2.4.0')} right={<Icon name="chevronRight" size={15} color={COLORS.textFaint} />} />
          <Divider />
          <Row icon="helpCircle" label="Contact Support" onClick={() => showToast('Connecting you to support...')} right={<Icon name="chevronRight" size={15} color={COLORS.textFaint} />} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- CONTACTS ---------------------------- */

function ContactsScreen({ contacts, newName, setNewName, newPhone, setNewPhone, addContact, deleteContact, onBack, showToast }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <BackHeader title="Trusted Contacts" subtitle="विश्वसनीय संपर्क" onBack={onBack} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Add a new contact</div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone number" style={{ ...inputStyle, marginTop: 8 }} />
          <div
            onClick={addContact}
            style={{
              marginTop: 10,
              background: COLORS.success,
              color: '#fff',
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="plus" size={15} color="#fff" /> Add Contact
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, background: '#EFEAFA', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <Icon name="info" size={16} color={COLORS.primary} />
          <div style={{ fontSize: 11.5, color: COLORS.text, lineHeight: 1.5 }}>
            When you trigger SOS, every contact below instantly gets your live location by SMS and a call alert.
          </div>
        </div>

        {contacts.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              padding: '10px 12px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: COLORS.primaryLight,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {c.name.charAt(0)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{c.name}</div>
              <div style={{ fontSize: 11.5, color: COLORS.textMuted }}>{c.phone}</div>
            </div>
            <div
              onClick={() => showToast(`Calling ${c.name}...`)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#E9F9F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="phone" size={14} color={COLORS.success} />
            </div>
            <div
              onClick={() => deleteContact(c.id)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#FBEAF1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={14} color={COLORS.accent} />
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <div style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: 12.5, marginTop: 20 }}>
            No contacts yet — add someone you trust.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- HELPLINE ---------------------------- */

function HelplineScreen({ onBack, showToast }) {
  return (
    <div style={{ paddingBottom: 24 }}>
      <BackHeader title="Emergency Helplines" subtitle="आपातकालीन हेल्पलाइन" onBack={onBack} />
      <div style={{ padding: '16px 18px' }}>
        {HELPLINES.map((h) => (
          <div
            key={h.number}
            onClick={() => showToast(`Calling ${h.number}...`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: `${h.color}1A`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="phone" size={20} color={h.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text }}>{h.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{h.hi}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{h.desc}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: h.color, flexShrink: 0 }}>{h.number}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- SOS MODAL ----------------------------- */

function SOSModal({ sosSeconds, contacts, onCancel }) {
  const delivered = Math.min(contacts.length, Math.floor(sosSeconds / 1.4) + 1);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(180deg, ${COLORS.accentDark}, #2A0B30)`,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 22px 26px',
        color: '#fff',
        animation: 'modalIn .25s ease-out',
        overflowY: 'auto',
      }}
    >
      <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', animation: 'ringPulse 1.6s infinite' }} />
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="alert" size={36} color="#fff" />
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>SOS Alert Sent!</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>सहायता आपकी ओर आ रही है</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 14, letterSpacing: 1 }}>{fmtClock(sosSeconds)}</div>
      <div style={{ fontSize: 11.5, opacity: 0.75, marginBottom: 20 }}>Elapsed time · बीता हुआ समय</div>

      <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Icon name="mapPin" size={15} color="#fff" />
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Live location shared</span>
        </div>
        <div style={{ fontSize: 11.5, opacity: 0.8, lineHeight: 1.5 }}>
          Near Forum Mall, Koramangala, Bengaluru — accuracy 8m. Updating every 10 seconds.
        </div>
      </div>

      <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginBottom: 20 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Alerted contacts · सूचित संपर्क</div>
        {contacts.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 0',
              borderBottom: i < contacts.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {c.name.charAt(0)}
            </div>
            <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
            {i < delivered ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7CF0B5', flexShrink: 0 }}>
                <Icon name="check" size={13} color="#7CF0B5" />
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>SMS Delivered</span>
              </div>
            ) : (
              <span style={{ fontSize: 10.5, opacity: 0.6, flexShrink: 0 }}>Sending…</span>
            )}
          </div>
        ))}
      </div>

      <div
        onClick={onCancel}
        style={{
          width: '100%',
          background: COLORS.success,
          color: '#fff',
          textAlign: 'center',
          padding: '13px 0',
          borderRadius: 12,
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
          marginTop: 'auto',
          flexShrink: 0,
        }}
      >
        I'm Safe — Cancel Alert
      </div>
    </div>
  );
}

/* ------------------------------- APP ------------------------------- */

export default function SurakshaApp() {
  const [tab, setTab] = useState('home');
  const [subScreen, setSubScreen] = useState(null);
  const [sosActive, setSosActive] = useState(false);
  const [sosSeconds, setSosSeconds] = useState(0);
  const [contacts, setContacts] = useState([
    { id: 1, name: 'Priya Sharma', phone: '+91 98765 43210' },
    { id: 2, name: 'Anita Reddy', phone: '+91 91234 56789' },
    { id: 3, name: 'Mom (Lakshmi)', phone: '+91 99887 76655' },
  ]);
  const [journey, setJourney] = useState({ active: false, seconds: 0 });
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [mapFilter, setMapFilter] = useState('All');
  const [expandedPlace, setExpandedPlace] = useState(null);
  const [expandedRight, setExpandedRight] = useState(null);
  const [rightsLang, setRightsLang] = useState('EN');
  const [notifOn, setNotifOn] = useState(true);
  const [bgLocOn, setBgLocOn] = useState(true);
  const [profileLang, setProfileLang] = useState('Hindi');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!sosActive) {
      setSosSeconds(0);
      return;
    }
    const id = setInterval(() => setSosSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [sosActive]);

  useEffect(() => {
    if (!journey.active) return;
    const id = setInterval(() => setJourney((j) => ({ ...j, seconds: j.seconds + 1 })), 1000);
    return () => clearInterval(id);
  }, [journey.active]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  const startJourney = () => {
    setJourney({ active: true, seconds: 0 });
    showToast('Journey sharing started');
  };
  const endJourney = () => {
    setJourney({ active: false, seconds: 0 });
    showToast("You're marked safe ✓");
  };
  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setContacts((c) => [...c, { id: Date.now(), name: newName.trim(), phone: newPhone.trim() }]);
    setNewName('');
    setNewPhone('');
    showToast('Contact added ✓');
  };
  const deleteContact = (id) => setContacts((c) => c.filter((x) => x.id !== id));
  const handleQuickAction = (key) => {
    if (key === 'safe') setTab('map');
    else if (key === 'rights') setTab('rights');
    else if (key === 'addcontact') setSubScreen('contacts');
    else if (key === 'helpline') setSubScreen('helpline');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'radial-gradient(circle at 30% 15%, #2a1854 0%, #140a28 45%, #0a0614 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: "'Segoe UI', Roboto, 'Noto Sans Devanagari', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes sosPulse {
          0% { box-shadow: 0 0 0 0 rgba(217,26,122,0.5), 0 14px 30px rgba(217,26,122,0.45); }
          70% { box-shadow: 0 0 0 22px rgba(217,26,122,0), 0 14px 30px rgba(217,26,122,0.45); }
          100% { box-shadow: 0 0 0 0 rgba(217,26,122,0), 0 14px 30px rgba(217,26,122,0.45); }
        }
        @keyframes ringPulse {
          0% { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes dotPulse {
          0% { box-shadow: 0 0 0 0 rgba(14,155,107,0.5); }
          70% { box-shadow: 0 0 0 8px rgba(14,155,107,0); }
          100% { box-shadow: 0 0 0 0 rgba(14,155,107,0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes modalIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div
        style={{
          width: 375,
          height: 780,
          borderRadius: 44,
          background: COLORS.bg,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 10px #1c1730, 0 0 0 12px #000',
          border: '2px solid #2a2440',
        }}
      >
        <StatusBar />

        <div style={{ position: 'absolute', top: 34, left: 0, right: 0, bottom: subScreen ? 0 : 64, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {subScreen === 'contacts' && (
            <ContactsScreen
              contacts={contacts}
              newName={newName}
              setNewName={setNewName}
              newPhone={newPhone}
              setNewPhone={setNewPhone}
              addContact={addContact}
              deleteContact={deleteContact}
              onBack={() => setSubScreen(null)}
              showToast={showToast}
            />
          )}
          {subScreen === 'helpline' && <HelplineScreen onBack={() => setSubScreen(null)} showToast={showToast} />}

          {!subScreen && tab === 'home' && (
            <HomeScreen
              contacts={contacts}
              journey={journey}
              selectedDuration={selectedDuration}
              setSelectedDuration={setSelectedDuration}
              startJourney={startJourney}
              endJourney={endJourney}
              onSOS={() => setSosActive(true)}
              onQuickAction={handleQuickAction}
            />
          )}
          {!subScreen && tab === 'map' && (
            <MapScreen mapFilter={mapFilter} setMapFilter={setMapFilter} expandedPlace={expandedPlace} setExpandedPlace={setExpandedPlace} showToast={showToast} />
          )}
          {!subScreen && tab === 'rights' && (
            <RightsScreen rightsLang={rightsLang} setRightsLang={setRightsLang} expandedRight={expandedRight} setExpandedRight={setExpandedRight} showToast={showToast} />
          )}
          {!subScreen && tab === 'profile' && (
            <ProfileScreen
              notifOn={notifOn}
              setNotifOn={setNotifOn}
              bgLocOn={bgLocOn}
              setBgLocOn={setBgLocOn}
              profileLang={profileLang}
              setProfileLang={setProfileLang}
              showToast={showToast}
            />
          )}
        </div>

        {!subScreen && <BottomNav tab={tab} setTab={setTab} />}

        {sosActive && <SOSModal sosSeconds={sosSeconds} contacts={contacts} onCancel={() => setSosActive(false)} />}

        {toast && (
          <div
            style={{
              position: 'absolute',
              bottom: subScreen ? 24 : 84,
              left: '50%',
              transform: 'translateX(-50%)',
              background: COLORS.text,
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
              animation: 'toastIn .25s ease-out',
              zIndex: 90,
              whiteSpace: 'nowrap',
              maxWidth: '85%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {toast}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 140,
            height: 26,
            background: '#000',
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            zIndex: 70,
          }}
        />
      </div>
    </div>
  );
}
