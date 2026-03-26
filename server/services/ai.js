const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY nicht konfiguriert. Bitte in der .env-Datei eintragen.');
  return new Anthropic({ apiKey });
}

const MODEL = 'claude-sonnet-4-6';

// Generic text generation
async function generate(systemPrompt, userPrompt) {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });
  return msg.content[0].text;
}

// 1. Strategy Analysis – internal admin view
async function analyzeStrategy(context) {
  const system = `Du bist ein erfahrener Performance-Marketing-Experte für Lead-Generierung.
Du analysierst Kunden-Setups und gibst konkrete, umsetzbare Empfehlungen auf Deutsch.
Antworte strukturiert mit klaren Abschnitten. Nutze Markdown-Formatierung.`;

  const prompt = `Analysiere folgendes Setup und gib eine vollständige Strategie-Analyse:

**Kunde:** ${context.company} (Branche: ${context.industry || 'unbekannt'})
**Aktuelles Angebot/Dienstleistung:** ${context.offer || 'nicht angegeben'}
**Website:** ${context.website || 'nicht angegeben'}
**Zielregion:** ${context.region || 'nicht angegeben'}
**Bisherige Kampagnen:** ${context.campaigns || 'keine Daten'}
**Zusätzliche Infos:** ${context.notes || 'keine'}

Bitte analysiere und strukturiere deine Antwort in folgende Abschnitte:
1. **Stärken & Chancen**
2. **Schwächen & Risiken**
3. **Zielgruppen-Empfehlung** (demographisch & psychographisch)
4. **Empfohlene Kanäle** (Plattformen & Formate)
5. **Budget-Empfehlung** (Aufteilung & Erwartungen)
6. **Sofortige Handlungsempfehlungen** (Top 3 Prioritäten)`;

  return generate(system, prompt);
}

// 2. Generate Ad Hooks & Copy
async function generateAdCopy(context) {
  const system = `Du bist ein erstklassiger Texter für bezahlte Werbung (Facebook, Instagram, Google Ads).
Deine Texte sind präzise, wirkungsvoll und auf Konversion ausgelegt.
Antworte ausschließlich auf Deutsch. Nutze psychologische Trigger und klare CTAs.`;

  const prompt = `Erstelle Werbetexte für folgendes Setup:

**Branche:** ${context.industry}
**Angebot:** ${context.offer}
**Zielgruppe:** ${context.targetAudience || 'nicht angegeben'}
**Plattform:** ${context.platform || 'Facebook/Instagram'}
**Ton:** ${context.tone || 'professionell, vertrauenswürdig'}

Liefere:
### 5 Hook-Varianten (erster Satz der Anzeige)
### 3 vollständige Anzeigentexte (Hook + Body + CTA)
### 3 Headline-Varianten (für die Überschrift)
### 2 CTA-Formulierungen`;

  return generate(system, prompt);
}

// 3. Landing Page Concept
async function generateFunnelConcept(context) {
  const system = `Du bist ein Conversion-Rate-Optimierungs-Experte für Lead-Generierungs-Landingpages.
Erstelle detaillierte, umsetzbare Konzepte. Antworte auf Deutsch.`;

  const prompt = `Erstelle ein Landingpage-Konzept für:

**Branche:** ${context.industry}
**Angebot:** ${context.offer}
**Zielgruppe:** ${context.targetAudience || 'Interessenten'}
**Ziel der Page:** Lead-Formular ausfüllen (Name, Telefon, E-Mail)

Liefere:
### Headline & Subheadline (3 Varianten)
### Above-the-fold Aufbau
### Vertrauenselemente (Social Proof, Trust-Signale)
### Formular-Design & Felder
### Fließtext-Struktur (Sections)
### Häufige Einwände & wie sie adressiert werden
### Mobile-Optimierung Hinweise`;

  return generate(system, prompt);
}

// 4. Campaign Optimization Suggestions
async function generateOptimizationTasks(context) {
  const system = `Du bist ein Performance-Marketing-Analyst.
Analysiere Kampagnendaten und erstelle konkrete, priorisierte Optimierungs-Tasks.
Gib immer JSON zurück – kein zusätzlicher Text außerhalb des JSON.`;

  const prompt = `Analysiere diese Kampagnendaten und erstelle Optimierungs-Tasks:

**Kampagne:** ${context.campaignName}
**Plattform:** ${context.platform || 'nicht angegeben'}
**Metriken der letzten 30 Tage:**
- Impressionen: ${context.impressions || 0}
- Klicks: ${context.clicks || 0}
- CTR: ${context.ctr || 'unbekannt'}%
- CPC: ${context.cpc || 'unbekannt'}€
- Leads: ${context.leads || 0}
- CPL: ${context.cpl || 'unbekannt'}€
- Budget/Monat: ${context.budget || 0}€

**Kontext:** ${context.notes || 'keine weiteren Infos'}

Antworte NUR mit gültigem JSON in diesem Format:
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
    // extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { tasks: [], summary: raw };
  }
}

// 5. Client-friendly explanation (simplified, no jargon)
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

module.exports = { analyzeStrategy, generateAdCopy, generateFunnelConcept, generateOptimizationTasks, explainForClient };
