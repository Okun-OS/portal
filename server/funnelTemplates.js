/**
 * FUNNEL TEMPLATE REGISTRY
 *
 * To add a new template:
 * 1. Define it here following the same structure
 * 2. Create the HTML file at public/templates/[template_id].html
 * 3. No other code changes needed – the system reads this dynamically.
 */

const TEMPLATES = {

  makler_v1: {
    template_id: 'makler_v1',
    name: 'Immobilienmakler – Lead Funnel V1',
    description: 'Klassischer Lead-Funnel für Immobilienmakler. Fokus auf kostenlose Immobilienbewertung.',
    category: 'Immobilien',

    required_fields: [
      { key: 'makler_name',  label: 'Name des Maklers',      type: 'text',   placeholder: 'z.B. Thomas Müller' },
      { key: 'firmen_name',  label: 'Firmenname',            type: 'text',   placeholder: 'z.B. Müller Immobilien GmbH' },
      { key: 'stadt',        label: 'Stadt / Region',        type: 'text',   placeholder: 'z.B. Berlin Mitte' },
      { key: 'telefon',      label: 'Telefonnummer',         type: 'text',   placeholder: 'z.B. 030 12345678' },
      { key: 'email',        label: 'E-Mail-Adresse',        type: 'email',  placeholder: 'makler@email.de' },
      { key: 'zielgruppe',   label: 'Zielgruppe (intern)',   type: 'text',   placeholder: 'z.B. Hausbesitzer 50+, Erbschaften' },
      { key: 'usp',          label: 'Alleinstellungsmerkmal',type: 'textarea',placeholder: 'Was macht Sie besonders?' },
    ],

    optional_fields: [
      { key: 'erfahrung_jahre', label: 'Jahre Erfahrung',   type: 'number', placeholder: '15' },
      { key: 'bewertungen',     label: 'Anzahl Bewertungen', type: 'number', placeholder: '47' },
      { key: 'verkaufte_obj',   label: 'Verkaufte Objekte',  type: 'number', placeholder: '200+' },
      { key: 'website_url',     label: 'Website URL',        type: 'url',    placeholder: 'https://...' },
    ],

    image_slots: [
      { key: 'makler_foto', label: 'Foto des Maklers',   description: 'Professionelles Porträtfoto', required: true,  aspect: '1:1' },
      { key: 'logo',        label: 'Firmenlogo',         description: 'Logo als PNG mit Transparenz', required: false, aspect: 'free' },
      { key: 'hero_image',  label: 'Hero-Hintergrundbild', description: 'Immobilie oder Stadt, 1920×1080px', required: false, aspect: '16:9' },
    ],

    text_slots: [
      { key: 'headline',      label: 'Hauptüberschrift',   ai_generated: true,  type: 'text',     max_chars: 80  },
      { key: 'subheadline',   label: 'Unterüberschrift',   ai_generated: true,  type: 'text',     max_chars: 120 },
      { key: 'benefit_1',     label: 'Vorteil 1',          ai_generated: true,  type: 'text',     max_chars: 60  },
      { key: 'benefit_2',     label: 'Vorteil 2',          ai_generated: true,  type: 'text',     max_chars: 60  },
      { key: 'benefit_3',     label: 'Vorteil 3',          ai_generated: true,  type: 'text',     max_chars: 60  },
      { key: 'vertrauen_text',label: 'Vertrauenstext',     ai_generated: true,  type: 'textarea', max_chars: 200 },
      { key: 'cta_text',      label: 'Button-Text (CTA)',  ai_generated: true,  type: 'text',     max_chars: 40  },
      { key: 'form_headline', label: 'Formular-Überschrift', ai_generated: true, type: 'text',    max_chars: 60  },
      { key: 'danke_text',    label: 'Dankeschön-Text',    ai_generated: true,  type: 'textarea', max_chars: 150 },
    ],

    form_definition: {
      headline: 'Jetzt kostenlose Bewertung anfragen',
      fields: [
        { name: 'name',    label: 'Ihr Name',          type: 'text',  required: true,  placeholder: 'Max Mustermann' },
        { name: 'phone',   label: 'Telefonnummer',     type: 'tel',   required: true,  placeholder: '+49 ...' },
        { name: 'email',   label: 'E-Mail-Adresse',    type: 'email', required: true,  placeholder: 'ihre@email.de' },
        { name: 'message', label: 'Kurze Nachricht',   type: 'textarea', required: false, placeholder: 'Objekt, Lage...' },
      ],
      submit_label: 'Kostenlose Bewertung anfordern',
      privacy_text: 'Ihre Daten werden vertraulich behandelt und nicht weitergegeben.',
    },

    thank_you_page: {
      headline: 'Vielen Dank für Ihre Anfrage!',
      text: 'Wir melden uns innerhalb von 24 Stunden bei Ihnen.',
    },

    ai_prompt_hint: 'Immobilienmakler in {{stadt}}. Zielgruppe: {{zielgruppe}}. USP: {{usp}}. Erstelle überzeugende, seriöse Texte die Immobilienbesitzer ansprechen die verkaufen wollen.',
  },

  solar_v1: {
    template_id: 'solar_v1',
    name: 'Solaranlage – Lead Funnel V1',
    description: 'Lead-Funnel für Solaranlagen-Anbieter. Fokus auf kostenloses Angebot.',
    category: 'Solar / Energie',

    required_fields: [
      { key: 'firmen_name', label: 'Firmenname',        type: 'text',    placeholder: 'z.B. SunPower GmbH' },
      { key: 'region',      label: 'Einsatzregion',     type: 'text',    placeholder: 'z.B. Bayern, BW' },
      { key: 'telefon',     label: 'Telefonnummer',     type: 'text',    placeholder: '...' },
      { key: 'email',       label: 'E-Mail',            type: 'email',   placeholder: '...' },
      { key: 'zielgruppe',  label: 'Zielgruppe',        type: 'text',    placeholder: 'z.B. Eigenheimbesitzer 40-65' },
      { key: 'usp',         label: 'USP',               type: 'textarea',placeholder: 'Was macht Sie besonders?' },
    ],

    optional_fields: [
      { key: 'installierte_anlagen', label: 'Installierte Anlagen', type: 'number', placeholder: '500+' },
      { key: 'garantie_jahre',       label: 'Garantie in Jahren',   type: 'number', placeholder: '25' },
      { key: 'website_url',          label: 'Website URL',          type: 'url',    placeholder: 'https://...' },
    ],

    image_slots: [
      { key: 'hero_image', label: 'Hero-Bild (Haus mit Solar)', description: 'Haus mit Solaranlage auf dem Dach', required: true,  aspect: '16:9' },
      { key: 'logo',       label: 'Firmenlogo',                  description: 'PNG mit Transparenz',              required: false, aspect: 'free' },
    ],

    text_slots: [
      { key: 'headline',      label: 'Hauptüberschrift',    ai_generated: true, type: 'text',     max_chars: 80  },
      { key: 'subheadline',   label: 'Unterüberschrift',    ai_generated: true, type: 'text',     max_chars: 120 },
      { key: 'benefit_1',     label: 'Vorteil 1',           ai_generated: true, type: 'text',     max_chars: 60  },
      { key: 'benefit_2',     label: 'Vorteil 2',           ai_generated: true, type: 'text',     max_chars: 60  },
      { key: 'benefit_3',     label: 'Vorteil 3',           ai_generated: true, type: 'text',     max_chars: 60  },
      { key: 'vertrauen_text',label: 'Vertrauenstext',      ai_generated: true, type: 'textarea', max_chars: 200 },
      { key: 'cta_text',      label: 'Button-Text (CTA)',   ai_generated: true, type: 'text',     max_chars: 40  },
      { key: 'form_headline', label: 'Formular-Überschrift',ai_generated: true, type: 'text',     max_chars: 60  },
      { key: 'danke_text',    label: 'Dankeschön-Text',     ai_generated: true, type: 'textarea', max_chars: 150 },
    ],

    form_definition: {
      headline: 'Jetzt kostenloses Solar-Angebot anfordern',
      fields: [
        { name: 'name',      label: 'Ihr Name',       type: 'text',     required: true,  placeholder: 'Max Mustermann' },
        { name: 'phone',     label: 'Telefon',        type: 'tel',      required: true,  placeholder: '+49 ...' },
        { name: 'email',     label: 'E-Mail',         type: 'email',    required: true,  placeholder: 'ihre@email.de' },
        { name: 'dachflaeche', label: 'Dachfläche ca.', type: 'text',  required: false, placeholder: 'z.B. 80m²' },
      ],
      submit_label: 'Kostenloses Angebot anfordern',
      privacy_text: 'Ihre Daten werden vertraulich behandelt.',
    },

    thank_you_page: {
      headline: 'Vielen Dank!',
      text: 'Wir erstellen Ihr persönliches Angebot und melden uns in Kürze.',
    },

    ai_prompt_hint: 'Solar-Unternehmen in {{region}}. Zielgruppe: {{zielgruppe}}. USP: {{usp}}. Erstelle überzeugende Texte die Eigenheimbesitzer ansprechen.',
  },

};

/**
 * Get all templates as array (for listing)
 */
function getAllTemplates() {
  return Object.values(TEMPLATES).map(t => ({
    template_id: t.template_id,
    name: t.name,
    description: t.description,
    category: t.category,
  }));
}

/**
 * Get a single template by ID
 */
function getTemplate(template_id) {
  return TEMPLATES[template_id] || null;
}

module.exports = { getAllTemplates, getTemplate, TEMPLATES };
