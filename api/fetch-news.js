// api/fetch-news.js
import Parser from 'rss-parser';

const parser = new Parser();

// Feed RSS di test (puoi aggiungerne altri)
const FEEDS = [
  {
    source_name: 'Securityinfo.it',
    source_url: 'https://www.securityinfo.it',
    rss: 'https://www.securityinfo.it/feed/',
    category: 'CYBER'
  },
  {
    source_name: 'Security Magazine',
    source_url: 'https://www.securitymagazine.com',
    rss: 'https://www.securitymagazine.com/rss/all',
    category: 'CYBER'
  }
];

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

// Normalizzazione semplice
function normalizeItem(item, feedConfig) {
  const published = item.isoDate || item.pubDate || new Date().toISOString();
  const link = item.link || item.guid || feedConfig.source_url;

  return {
    source_name: feedConfig.source_name,
    source_url: feedConfig.source_url,
    title: item.title?.slice(0, 500) || 'Senza titolo',
    description: item.contentSnippet?.slice(0, 2000) || null,
    language: 'it',
    link,
    published_at: published,
    category: feedConfig.category,
    tags: []
  };
}

// Inserisce in news_raw se non esiste già (stessa fonte+link)
async function upsertNewsRaw(items) {
  if (!items.length) return;

  // usa la UNIQUE (source_name, link)
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
    const allNormalized = [];

    for (const feed of FEEDS) {
      try {
        const parsed = await parser.parseURL(feed.rss);
        const items = (parsed.items || []).slice(0, 10).map((it) =>
          normalizeItem(it, feed)
        );
        allNormalized.push(...items);
      } catch (e) {
        console.error('Errore parsing feed', feed.rss, e);
      }
    }

    if (!allNormalized.length) {
      return res.status(200).json({ message: 'Nessun item trovato' });
    }

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
