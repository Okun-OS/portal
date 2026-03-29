// Google Research Service
// Uses: Google Places API (ratings/reviews) + Custom Search API (competitors)

function getKeys() {
  return {
    apiKey: process.env.GOOGLE_API_KEY,
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
  };
}

// Fetch helper with timeout
async function gFetch(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res.json();
}

// ── 1. Google Places: Rating & Reviews ──────────────────────────────────────
async function getPlaceInfo(company, region) {
  const { apiKey } = getKeys();
  if (!apiKey || !company) return null;

  try {
    const query = encodeURIComponent(`${company} ${region || ''}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=de&key=${apiKey}`;
    const searchData = await gFetch(searchUrl);

    if (!searchData.results || !searchData.results.length) return null;

    const place = searchData.results[0];
    const placeId = place.place_id;

    // Get details with reviews
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,formatted_address&language=de&key=${apiKey}`;
    const detailData = await gFetch(detailUrl);
    const detail = detailData.result;

    if (!detail) return null;

    const reviews = (detail.reviews || []).slice(0, 3).map(r => ({
      rating: r.rating,
      text: r.text ? r.text.slice(0, 200) : '',
      time: r.relative_time_description,
    }));

    return {
      name: detail.name || company,
      rating: detail.rating || null,
      reviewCount: detail.user_ratings_total || 0,
      address: detail.formatted_address || '',
      topReviews: reviews,
    };
  } catch {
    return null;
  }
}

// ── 2. Google Custom Search: Competitors ────────────────────────────────────
async function searchCompetitors(industry, region) {
  const { apiKey, searchEngineId } = getKeys();
  if (!apiKey || !searchEngineId || !industry) return null;

  try {
    const query = encodeURIComponent(`${industry} ${region || ''} Anbieter Dienstleister`);
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${query}&num=5&lr=lang_de`;
    const data = await gFetch(url);

    if (!data.items || !data.items.length) return null;

    return data.items.map(item => ({
      title: item.title,
      snippet: item.snippet ? item.snippet.slice(0, 150) : '',
      url: item.link,
    }));
  } catch {
    return null;
  }
}

// ── 3. Combined Brand Insights ───────────────────────────────────────────────
async function getBrandInsights(company, industry, region) {
  const [placeInfo, competitors] = await Promise.all([
    getPlaceInfo(company, region),
    searchCompetitors(industry, region),
  ]);

  if (!placeInfo && !competitors) return null;

  let summary = '';

  if (placeInfo) {
    summary += `**Google-Bewertung:** ${placeInfo.rating ? placeInfo.rating + '/5 (aus ' + placeInfo.reviewCount + ' Bewertungen)' : 'nicht gefunden'}\n`;
    if (placeInfo.topReviews && placeInfo.topReviews.length) {
      summary += `**Beispiel-Bewertungen:**\n`;
      placeInfo.topReviews.forEach(r => {
        summary += `- (${r.rating}★) "${r.text}"\n`;
      });
    }
  }

  if (competitors && competitors.length) {
    summary += `\n**Gefundene Wettbewerber/Marktumfeld:**\n`;
    competitors.slice(0, 4).forEach(c => {
      summary += `- ${c.title}: ${c.snippet}\n`;
    });
  }

  return {
    placeInfo,
    competitors,
    summary,
  };
}

module.exports = { getBrandInsights, getPlaceInfo, searchCompetitors };
