/* KHARIS & ALETHEIA — site configuration (shared across every page)
   Anything the owner must actually supply before launch is listed in
   KA_CONFIG.placeholders — tools/preflight.mjs fails the build while it's non-empty. */
window.KA_CONFIG = {
  brand: 'KHARIS & ALETHEIA',
  currency: 'GBP',
  currencySymbol: '£',

  /* PLACEHOLDER — owner's real inbox. mailto: fallback + order notices go here. */
  contactEmail: 'hello@kharisandaletheia.com',

  /* POST JSON endpoint for kaForms.submit (Formspree-style). '' => mailto: fallback.
     Must be HTTPS — app.js's kaForms.submit refuses any non-https:// endpoint and
     falls back to mailto: rather than send form PII in cleartext. */
  formEndpoint: '',

  /* PLACEHOLDER — 'request' ships every order to contactEmail for manual processing.
     Switch to 'paystack' + a real public key once a payment account exists. */
  payment: { provider: 'request', paystackPublicKey: '' },

  /* PLACEHOLDER — real rates/carriers/free thresholds belong to the owner, not a guess.
     zoneFor() falls back to ROW for any country code not listed under UK/EU/AFRICA. */
  shipping: {
    zones: {
      UK: {
        label: 'United Kingdom',
        countries: ['GB'],
        methods: [
          { id: 'standard', label: 'Standard', price: 4.95, days: '2–4' },
          { id: 'express', label: 'Express', price: 9.95, days: '1–2' }
        ],
        freeOver: 75
      },
      EU: {
        label: 'European Union',
        countries: [
          'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT',
          'LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'
        ],
        methods: [
          { id: 'standard', label: 'Standard', price: 14.95, days: '5–8' },
          { id: 'express', label: 'Express', price: 24.95, days: '3–5' }
        ],
        freeOver: 120
      },
      AFRICA: {
        label: 'Africa',
        countries: [
          'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ',
          'EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG',
          'MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO',
          'ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW'
        ],
        methods: [
          { id: 'standard', label: 'Standard', price: 18.95, days: '7–14' },
          { id: 'express', label: 'Express', price: 34.95, days: '4–7' }
        ],
        freeOver: 150
      },
      ROW: {
        label: 'Rest of world',
        countries: [],
        methods: [
          { id: 'standard', label: 'Standard', price: 22.95, days: '8–16' },
          { id: 'express', label: 'Express', price: 39.95, days: '5–9' }
        ],
        freeOver: 150
      }
    }
  },

  /* PLACEHOLDER — a real launch code (or none) belongs to the owner. */
  promos: {
    WELCOME10: { type: 'percent', value: 10, label: '10% off your first order' }
  },

  bulkTiers: [
    { min: 10, off: 0.10 },
    { min: 25, off: 0.15 },
    { min: 50, off: 0.20 },
    { min: 100, off: 0.25 }
  ],

  giftAmounts: [25, 50, 75, 100, 150],

  /* Tee Studio catalog — garments, colours and placements the studio/lab builders render. */
  studio: {
    garments: [
      { id: 'tee', name: 'Heavyweight Tee', base: 38 },
      { id: 'longsleeve', name: 'Long-Sleeve Tee', base: 42 },
      { id: 'crew', name: 'Fleece Crewneck', base: 60 },
      { id: 'hoodie', name: 'Heavyweight Hoodie', base: 66 }
    ],
    colours: [
      { id: 'white', name: 'White', hex: '#f4f1ea' },
      { id: 'black', name: 'Black', hex: '#121013' },
      { id: 'burgundy', name: 'Burgundy', hex: '#5a1029' },
      { id: 'navy', name: 'Navy', hex: '#14213d' },
      { id: 'olive', name: 'Olive', hex: '#4a5232' },
      { id: 'cream', name: 'Cream', hex: '#e9dfc8' },
      { id: 'mauve', name: 'Mauve', hex: '#8a6a78' },
      { id: 'cobalt', name: 'Cobalt', hex: '#1f4fa8' }
    ],
    placements: [
      { id: 'chest', name: 'Chest panel', surcharge: 0 },
      { id: 'diagonal', name: 'Diagonal sweep', surcharge: 4 },
      { id: 'stripe', name: 'Side stripe', surcharge: 0 },
      { id: 'pocket', name: 'Pocket', surcharge: 0 },
      { id: 'sleeves', name: 'Sleeves', surcharge: 4 },
      { id: 'allover', name: 'All-over', surcharge: 8 }
    ],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
  },

  leadTime: '7–10 working days',

  /* PLACEHOLDER — used for JSON-LD / canonical URLs / share links. */
  siteUrl: 'https://www.kharisandaletheia.com',

  /* Anything listed here still needs the owner's real value before launch. */
  placeholders: ['contactEmail', 'promos', 'shipping.zones', 'payment', 'siteUrl']
};
