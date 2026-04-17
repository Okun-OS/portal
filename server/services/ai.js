const Anthropic = require('@anthropic-ai/sdk');
const googleResearch = require('./googleResearch');

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert. Bitte in der .env-Datei eintragen.');
  return new Anthropic({ apiKey, timeout: 90000 }); // 90s – fails before Express kills the socket
}

const MODEL = 'claude-sonnet-4-6';

async function generate(systemPrompt, userPrompt, maxTokens = 2048) {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  return msg.content[0].text;
}

// Website scraper – extract meaningful text from a URL
async function scrapeWebsite(url) {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadPortalBot/1.0)' }
    });
    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim()
      .slice(0, 3000);
    return text || null;
  } catch {
    return null;
  }
}

// 1. Strategy Analysis – returns { result, campaignContext }
async function analyzeStrategy(context) {
  const [websiteContent, brandInsights] = await Promise.all([
    context.website ? scrapeWebsite(context.website) : Promise.resolve(null),
    (context.company || context.offer) ? googleResearch.getBrandInsights(context.company || context.offer, context.industry || context.offer, context.region) : Promise.resolve(null),
  ]);

  const budgetConstraint = context.budget
    ? ` Das Monatsbudget beträgt ${context.budget}€ – das ist ein absolutes Limit. Empfehle niemals Ausgaben die darüber liegen.`
    : '';

  const system = `Du bist ein erfahrener Performance-Marketing-Stratege für Lead-Generierung.
Du analysierst Kunden-Setups tiefgründig und gibst konkrete, umsetzbare Empfehlungen auf Deutsch.
Du erkennst automatisch Zielgruppen, Pain Points, USPs und Marktchancen – auch wenn der User wenig Input liefert.
Antworte strukturiert mit Markdown. Am Ende IMMER den JSON-Block im vorgegebenen Format ausgeben.${budgetConstraint}`;

  const websiteSection = websiteContent
    ? `\n\n**Analysierter Website-Inhalt:**\n${websiteContent}`
    : '';

  const brandSection = brandInsights && brandInsights.summary
    ? `\n\n**Google-Recherche (Live-Daten):**\n${brandInsights.summary}`
    : '';

  const prompt = `Analysiere folgendes Setup und erstelle eine vollständige Marketing-Strategie-Analyse:

**Kunde/Branche:** ${context.company || context.industry || 'nicht angegeben'}
**Angebot/Dienstleistung:** ${context.offer || 'nicht angegeben'}
**Website:** ${context.website || 'keine'}
**Zielregion:** ${context.region || 'nicht angegeben'}
**Monatliches Budget:** ${context.budget ? context.budget + '€' : 'nicht angegeben'}
**Bisherige Erfahrungen:** ${context.notes || 'keine'}${websiteSection}${brandSection}

PFLICHT: Das Monatsbudget von ${context.budget ? context.budget + '€' : 'nicht angegeben'} ist ein HARTES LIMIT. Schlage NIEMALS Maßnahmen vor die mehr kosten. Alle Budgetaufteilungen, Kanal-Empfehlungen und Strategien müssen innerhalb dieses Budgets bleiben. Kein höheres Budget empfehlen.

Erstelle eine tiefgründige Analyse in diesen Abschnitten:

## 1. Markt & Zielgruppen-Analyse
Wer sind die idealen Kunden? Demographisch UND psychographisch. Typische Pain Points, Kaufmotive, Einwände.

## 2. Angebots-Bewertung & USP
Wie klar ist das Angebot? Was macht es einzigartig? Was fehlt?${websiteContent ? '\nWebsite-Einschätzung: Professionalität, Vertrauen, Conversion-Schwächen.' : ''}

## 3. Empfohlene Kanäle & Formate
Welche Plattformen, welche Anzeigenformate, welche Budgetverteilung?

## 4. Sofortige Prioritäten (Top 3)
Die 3 wichtigsten Maßnahmen mit konkreten nächsten Schritten.

## 5. Erwartete Ergebnisse
Realistische KPI-Erwartungen für die ersten 30/60/90 Tage.

---CONTEXT_JSON---
{
  "angebot": "kurze Beschreibung des Angebots",
  "zielgruppe": "Beschreibung der idealen Zielgruppe",
  "branche": "Branche/Industrie",
  "region": "Zielregion",
  "usp": "wichtigstes Alleinstellungsmerkmal",
  "website": "${context.website || ''}",
  "analyseInsights": "wichtigste Erkenntnis der Analyse in 1-2 Sätzen",
  "websiteInsights": "Einschätzung der Website: Professionalität, Tonalität, Conversion-Stärken/-Schwächen (oder 'keine Website angegeben')",
  "marketInsights": "Marktkontext und Wettbewerbssituation",
  "trustLevel": "hoch|mittel|niedrig",
  "conversionIssues": "wichtigste Conversion-Hürden",
  "recommendedPlatform": "empfohlene Hauptplattform",
  "targetAudience": "präzise Zielgruppenbeschreibung für Anzeigen",
  "budget": ${context.budget ? context.budget : 'null'}
}
---END_JSON---`;

  const raw = await generate(system, prompt, 3000);

  // Extract JSON context
  const jsonMatch = raw.match(/---CONTEXT_JSON---\s*([\s\S]*?)\s*---END_JSON---/);
  let campaignContext = null;
  let analysisText = raw.replace(/---CONTEXT_JSON---[\s\S]*?---END_JSON---/, '').trim();

  if (jsonMatch) {
    try {
      campaignContext = JSON.parse(jsonMatch[1]);
    } catch {
      // JSON parse failed, context stays null
    }
  }

  return { result: analysisText, campaignContext };
}

// 2. Generate Ad Copy – uses campaignContext if available
async function generateAdCopy(context) {
  const budgetNote = context.budget ? ` Budget: ${context.budget}€/Monat – keine teureren Maßnahmen vorschlagen.` : '';
  const system = `Du bist ein erstklassiger Texter für bezahlte Werbung (Facebook, Instagram, Google Ads).
Deine Texte sind präzise, wirkungsvoll und auf Konversion ausgelegt.
Antworte ausschließlich auf Deutsch. Nutze psychologische Trigger und klare CTAs.${budgetNote}`;

  const contextBlock = context.analyseInsights
    ? `\n**Erkenntnisse aus der Strategie-Analyse:** ${context.analyseInsights}`
    : '';

  const prompt = `Erstelle hochwertige Werbetexte für folgendes Setup:

**Branche:** ${context.branche || context.industry || 'nicht angegeben'}
**Angebot:** ${context.angebot || context.offer || 'nicht angegeben'}
**USP:** ${context.usp || 'nicht angegeben'}
**Zielgruppe:** ${context.targetAudience || context.zielgruppe || 'nicht angegeben'}
**Region:** ${context.region || 'nicht angegeben'}
**Plattform:** ${context.platform || 'Facebook/Instagram'}
**Ton:** ${context.tone || 'professionell, vertrauenswürdig'}
**Budget/Monat:** ${context.budget ? context.budget + '€' : 'nicht angegeben'}${contextBlock}

Liefere:
### 5 Hook-Varianten (erster Satz der Anzeige)
### 3 vollständige Anzeigentexte (Hook + Body + CTA)
### 3 Headline-Varianten
### 2 CTA-Formulierungen`;

  return generate(system, prompt);
}

// 3. Landing Page Concept – uses campaignContext if available
async function generateFunnelConcept(context) {
  const budgetNote = context.budget ? ` Budget: ${context.budget}€/Monat – alle Empfehlungen müssen darin umsetzbar sein.` : '';
  const system = `Du bist ein Conversion-Rate-Optimierungs-Experte für Lead-Generierungs-Landingpages.
Erstelle detaillierte, umsetzbare Konzepte. Antworte auf Deutsch.${budgetNote}`;

  const contextBlock = context.analyseInsights
    ? `\n**Erkenntnisse aus der Strategie-Analyse:** ${context.analyseInsights}
**Conversion-Hürden:** ${context.conversionIssues || 'nicht analysiert'}`
    : '';

  const prompt = `Erstelle ein detailliertes Landingpage-Konzept für:

**Branche:** ${context.branche || context.industry || 'nicht angegeben'}
**Angebot:** ${context.angebot || context.offer || 'nicht angegeben'}
**USP:** ${context.usp || 'nicht angegeben'}
**Zielgruppe:** ${context.targetAudience || context.zielgruppe || 'Interessenten'}
**Region:** ${context.region || 'nicht angegeben'}
**Ziel:** Lead-Formular ausfüllen (Name, Telefon, E-Mail)${contextBlock}

Liefere:
### Headline & Subheadline (3 Varianten)
### Above-the-fold Aufbau
### Vertrauenselemente (Social Proof, Trust-Signale)
### Formular-Design & Felder
### Fließtext-Struktur (alle Sections mit Inhalt)
### Häufige Einwände & Antworten
### Mobile-Optimierung Hinweise`;

  return generate(system, prompt);
}

// 4. Campaign Optimization
async function generateOptimizationTasks(context) {
  const budgetNote = context.budget ? ` Das Budget beträgt ${context.budget}€/Monat – schlage nur Maßnahmen vor die darin passen.` : '';
  const system = `Du bist ein Performance-Marketing-Analyst.
Analysiere Kampagnendaten und erstelle konkrete, priorisierte Optimierungs-Tasks.
Gib immer JSON zurück – kein zusätzlicher Text außerhalb des JSON.${budgetNote}`;

  const prompt = `Analysiere diese Kampagnendaten und erstelle Optimierungs-Tasks:

**Kampagne:** ${context.campaignName || context.angebot || 'nicht angegeben'}
**Plattform:** ${context.platform || 'nicht angegeben'}
**Monatliches Budget:** ${context.budget ? context.budget + '€' : 'nicht angegeben'}
**Metriken der letzten 30 Tage:**
- Impressionen: ${context.impressions || 0}
- Klicks: ${context.clicks || 0}
- CTR: ${context.ctr || 'unbekannt'}%
- CPC: ${context.cpc || 'unbekannt'}€
- Leads: ${context.leads || 0}
- CPL: ${context.cpl || 'unbekannt'}€
- Budget/Monat: ${context.budget || 0}€
**Angebot/Branche:** ${context.angebot || context.branche || 'nicht angegeben'}
**Zielgruppe:** ${context.zielgruppe || 'nicht angegeben'}
**Kontext:** ${context.notes || 'keine weiteren Infos'}

Antworte NUR mit gültigem JSON:
{
  "tasks": [
    {
      "title": "Aufgabe",
      "description": "Detaillierte Beschreibung",
      "priority": "high|medium|low",
      "category": "Creative|Targeting|Budget|Landing Page|Kampagnenstruktur"
    }
  ],
  "summary": "Kurze Zusammenfassung der wichtigsten Erkenntnisse"
}`;

  const raw = await generate(system, prompt);
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { tasks: [], summary: raw };
  }
}

// 5. Campaign Structure – budget split, timeline, platform setup
async function generateCampaignStructure(context) {
  const budgetNote = context.budget ? ` Das verfügbare Monatsbudget ist ${context.budget}€ – halte alle Empfehlungen strikt darin.` : '';
  const system = `Du bist ein Performance-Marketing-Experte.
Erstelle eine konkrete, umsetzbare Kampagnenstruktur auf Deutsch. Nutze Markdown.${budgetNote}`;

  const prompt = `Erstelle eine vollständige Kampagnenstruktur für:

**Angebot:** ${context.angebot || context.offer || 'nicht angegeben'}
**Zielgruppe:** ${context.targetAudience || context.zielgruppe || 'nicht angegeben'}
**Branche:** ${context.branche || 'nicht angegeben'}
**Region:** ${context.region || 'nicht angegeben'}
**Empfohlene Plattform:** ${context.recommendedPlatform || 'Facebook/Instagram'}
**USP:** ${context.usp || 'nicht angegeben'}
**Monatliches Budget:** ${context.budget ? context.budget + '€ (HARTES LIMIT – nicht überschreiten)' : 'nicht angegeben'}

Liefere:
### Budget-Aufteilung
Aufteilung des vorhandenen Budgets (Awareness/Retargeting/Testing) – kein höheres Budget empfehlen.

### Kampagnen-Struktur
Kampagnen → Anzeigengruppen → Anzeigen Hierarchie mit konkreten Namen.

### Zielgruppen-Setup
Genaue Targeting-Einstellungen (Alter, Interessen, Custom Audiences).

### Zeitplan (erste 90 Tage)
Woche 1–4: Testing-Phase, Woche 5–8: Skalierung, Woche 9–12: Optimierung.

### KPI-Ziele
Konkrete Zielwerte für CTR, CPL, Conversion Rate.

### Sofort-Checkliste
Die 10 wichtigsten Setup-Schritte vor dem Launch.`;

  return generate(system, prompt, 2000);
}

// 6. Complete Campaign – runs strategy + ads + funnel + structure in sequence
async function createCompleteCampaign(context) {
  // Step 1: Strategy + context extraction
  const { result: strategy, campaignContext } = await analyzeStrategy(context);

  // Step 2: Use extracted context for all modules in parallel
  const mergedContext = { ...context, ...(campaignContext || {}) };
  const [adCopy, funnel, structure] = await Promise.all([
    generateAdCopy(mergedContext),
    generateFunnelConcept(mergedContext),
    generateCampaignStructure(mergedContext),
  ]);

  return { strategy, adCopy, funnel, structure, campaignContext: mergedContext };
}

// 6. Client-friendly explanation
async function explainForClient(context) {
  const system = `Du erklärst Marketing-Ergebnisse für Unternehmer ohne Marketing-Erfahrung.
Deine Sprache ist freundlich, einfach und verständlich – kein Fachjargon.
Keine CTR, CPC, CPL oder andere technische Begriffe.
Fokus auf: Was hat der Kunde gewonnen? Was kommt als nächstes?
Antworte in 3-5 Sätzen auf Deutsch.`;

  const prompt = `Erkläre diese Ergebnisse für den Kunden:

**Firma:** ${context.company}
**Zeitraum:** Diese Woche / Dieser Monat
**Neue Anfragen (Leads):** ${context.newLeads}
**Anfragen gesamt:** ${context.totalLeads}
**Davon bearbeitet:** ${context.contacted}
**Davon abgeschlossen:** ${context.closed}
**Kampagnenstatus:** ${context.campaignStatus}
**Vergleich Vorwoche:** ${context.weeklyChange}

Schreibe eine kurze, positive und motivierende Erklärung für den Kunden.`;

  return generate(system, prompt);
}

// 7. Immobilienmakler Campaign Planner – full structured plan
async function generateCampaignPlan({ stadt, budget, templateDescriptions }) {
  const system = `Du bist ein Performance Marketing System für Immobilienmakler.
Deine Aufgabe ist es, basierend auf den gegebenen Informationen eine komplette
Leadgenerierungs-Kampagne zu erstellen. Antworte AUSSCHLIESSLICH mit gültigem JSON –
kein Text außerhalb des JSON-Blocks.`;

  const prompt = `Erstelle eine vollständige Leadgenerierungs-Kampagne für einen Immobilienmakler.

INPUT:
- Stadt: ${stadt}
- Budget: ${budget}€/Monat
- Ziel: Eigentümer-Anfragen generieren

Verfügbare Templates:
${templateDescriptions}

Antworte NUR mit diesem JSON (keine Erklärungen außerhalb):
{
  "ad_creatives": [
    {
      "headline": "max 40 Zeichen",
      "primary_text": "2-4 Sätze Anzeigentext",
      "cta": "Button-Text z.B. Mehr erfahren"
    }
  ],
  "template_recommendation": {
    "template_id": "eine der template_ids aus der Liste",
    "template_name": "Name des Templates",
    "reason": "Kurze Begründung warum dieses Template"
  },
  "meta_campaign": {
    "objective": "Kampagnenziel",
    "audience_description": "Zielgruppenbeschreibung",
    "ad_sets": [
      { "name": "Ad Set Name", "targeting": "Targeting-Details", "budget_eur": 0 }
    ],
    "total_budget_eur": 0
  },
  "google_campaign": {
    "keywords": ["keyword1", "keyword2"],
    "campaign_type": "Search",
    "structure": "Kampagnenstruktur Beschreibung",
    "total_budget_eur": 0
  },
  "budget_allocation": {
    "meta_eur": 0,
    "google_eur": 0,
    "reserve_eur": 0,
    "reasoning": "Begründung der Aufteilung"
  },
  "implementation_steps": [
    { "step": 1, "title": "Schritt-Titel", "description": "Details", "timeframe": "Tag/Woche X" }
  ]
}

Erstelle 4 verschiedene Anzeigen-Varianten (ad_creatives).
Budget-Aufteilung muss genau ${budget}€ ergeben (meta + google + reserve = ${budget}).
Alle Texte auf Deutsch. Fokus auf Conversion und Eigentümer-Leads.`;

  const raw = await generate(system, prompt, 3000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('KI hat kein gültiges JSON zurückgegeben');
  return JSON.parse(match[0]);
}

// 8. Auto-Setup: one AI call generates everything for a campaign
async function generateAutoSetup({ company, industry, city, budget, platform, description, targetAudience, templateTextSlots }) {
  const system = `Du bist ein Performance-Marketing-Experte der vollständige Kampagnen für lokale Unternehmen erstellt.
Antworte AUSSCHLIESSLICH mit gültigem JSON – kein Text außerhalb des JSON-Blocks.`;

  const slotList = (templateTextSlots || []).map(s =>
    `    "${s.key}": "${s.label} (max ${s.max_chars || 100} Zeichen)"`
  ).join(',\n');

  const prompt = `Erstelle eine komplette Performance-Marketing-Kampagne auf Deutsch.

UNTERNEHMEN: ${company}
BRANCHE: ${industry || 'Nicht angegeben'}
STANDORT: ${city || 'Nicht angegeben'}
BUDGET: ${budget || 0}€/Monat
PLATTFORM: ${platform || 'Meta/Google'}
AKTUELLE SITUATION: ${description || 'Nicht angegeben'}
ZIELGRUPPE: ${targetAudience || 'Nicht angegeben'}

Antworte MIT GENAU diesem JSON (alle Felder ausfüllen):
{
  "strategy": "Strategie-Text 300-400 Wörter – konkrete Empfehlungen für diese Kampagne",
  "usp": "Einzigartiger Vorteil max 80 Zeichen",
  "target_audience": "Zielgruppe präzise max 100 Zeichen",
  "text_slots": {
${slotList || '    "headline": "Hauptüberschrift"'}
  },
  "ad_creatives": [
    {"type": "hook", "title": "Hook 1", "content": "Aufmerksamkeitsstarker Einstieg 2-3 Sätze"},
    {"type": "hook", "title": "Hook 2", "content": "Alternativer Einstieg 2-3 Sätze"},
    {"type": "headline", "title": "Headline 1", "content": "Anzeigentitel max 40 Zeichen"},
    {"type": "headline", "title": "Headline 2", "content": "Alternativer Titel max 40 Zeichen"},
    {"type": "body", "title": "Anzeigentext", "content": "Anzeigentext 3-4 Sätze überzeugend"},
    {"type": "cta", "title": "Call to Action", "content": "Button-Text max 25 Zeichen"}
  ],
  "qualification_questions": [
    {"question": "Vorqualifizierungsfrage 1", "type": "radio", "options": ["Option A", "Option B", "Option C"]},
    {"question": "Vorqualifizierungsfrage 2", "type": "radio", "options": ["Ja", "Nein"]},
    {"question": "Vorqualifizierungsfrage 3", "type": "radio", "options": ["Option A", "Option B", "Option C"]},
    {"question": "Vorqualifizierungsfrage 4", "type": "radio", "options": ["Option A", "Option B"]},
    {"question": "Vorqualifizierungsfrage 5", "type": "radio", "options": ["Ja", "Nein", "Unsicher"]}
  ]
}`;

  const text = await generate(system, prompt, 4096);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('KI-Antwort enthielt kein JSON');
  return JSON.parse(match[0]);
}

module.exports = { analyzeStrategy, generateAdCopy, generateFunnelConcept, generateOptimizationTasks, createCompleteCampaign, explainForClient, generateCampaignPlan, generateAutoSetup };
