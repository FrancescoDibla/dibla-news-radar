// api/fetch-news.js
import Parser from 'rss-parser';

const parser = new Parser();

// Helper: chiama Supabase REST usando fetch nativo (Node 18 su Vercel)
async function supabaseRequest(path, method, body) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }

  return res;
}

// Legge le sorgenti RSS dalla tabella "sources"
async function loadSources() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/sources?enabled=eq.true`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (loadSources): ${res.status} ${text}`);
  }

  const data = await res.json();
  return data || [];
}

// Normalizzazione semplice, adattata a "sources"
function normalizeItem(item, source) {
  const published = item.isoDate || item.pubDate || new Date().toISOString();
  const link = item.link || item.guid || source.main_site_url || source.rss_url;

  // default lingua: se nella tabella hai "language", usala, altrimenti fallback
  const language = source.language || 'en';

  // categoria principale: uso source.type se presente, altrimenti 'CYBER'
  let mainCategory = 'CYBER';
  if (source.type === 'vendor_it') mainCategory = 'IT';
  if (source.type === 'cert') mainCategory = 'CYBER';
  if (source.type === 'news_portal') mainCategory = 'CYBER';
  if (source.type === 'vendor_security') mainCategory = 'CYBER';

  return {
    source_name: source.name,
    source_url: source.main_site_url || source.rss_url,
    title: item.title?.slice(0, 500) || 'Senza titolo',
    description: item.contentSnippet?.slice(0, 2000) || null,
    language,
    link,
    published_at: published,
    category: mainCategory,
    tags: []
  };
}

// Inserisce in news_raw se non esiste già (stessa fonte+link)
// Assumo UNIQUE (source_name, link) già definita su news_raw
async function upsertNewsRaw(items) {
  if (!items.length) return;
  await supabaseRequest('news_raw?on_conflict=source_name,link', 'POST', items);
}

// Crea/aggiorna storie base: una story per ogni news (per ora 1:1)
async function upsertStoriesFromNews(items) {
  if (!items.length) return;

  const stories = items.map((n) => ({
    title_it: n.title,
    summary_it: n.description,
    main_category: n.category || 'CYBER',
    main_tags: [],
    timeframe_label: '24h',
    impact_score: 1,
    main_source_name: n.source_name,
    main_source_url: n.link
  }));

  await supabaseRequest('stories', 'POST', stories);
}

// Handler Vercel
export default async function handler(req, res) {
  try {
    // 1. Carico le sorgenti abilitate dalla tabella "sources"
    const sources = await loadSources();

    if (!sources.length) {
      return res.status(200).json({
        message: 'Nessuna sorgente abilitata in sources',
        inserted: 0
      });
    }

    const allNormalized = [];

    // 2. Per ogni sorgente, scarico e parse l’RSS
    for (const source of sources) {
      if (!source.rss_url) continue;

      try {
        const parsed = await parser.parseURL(source.rss_url);
        const items = (parsed.items || []).slice(0, 10).map((it) =>
          normalizeItem(it, source)
        );
        allNormalized.push(...items);
      } catch (e) {
        console.error('Errore parsing feed', source.rss_url, e);
      }
    }

    // 3. Se non ho trovato nulla, esco
    if (!allNormalized.length) {
      return res.status(200).json({ message: 'Nessun item trovato', inserted: 0 });
    }

    // 4. Upsert su news_raw e stories (1:1 per ora)
    await upsertNewsRaw(allNormalized);
    await upsertStoriesFromNews(allNormalized);

    return res.status(200).json({
      message: 'News aggiornate',
      inserted: allNormalized.length
    });
  } catch (err) {
    console.error('Errore fetch-news:', err);
    return res.status(500).json({ error: err.message });
  }
}
