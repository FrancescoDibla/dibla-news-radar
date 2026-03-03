// CONFIG SUPABASE
const SUPABASE_URL = 'https://ucbtlovcinjkqmkobmxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g0UnsYuXG-mHe3gCH_lj5A__jlAqD7q';

// Inizializza Supabase
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stato in memoria
let allStories = [];
let selectedStory = null;

// Stato filtri (solo timeframe + search)
const filterState = {
  timeframe: '24h',    // '3h' | '24h' | '48h' | '72h' | '1week' | 'all'
  search: ''
};

// Elementi DOM
const heroRowEl = document.getElementById('hero-row');
const storyGridEl = document.getElementById('story-grid');
const detailPanelEl = document.getElementById('detail-panel');
const linkedinBoxEl = document.getElementById('linkedin-box');
const linkedinSummaryBoxEl = document.getElementById('linkedin-summary-box');
const loadingEl = document.getElementById('loading');
const lastUpdateEl = document.getElementById('last-update');
const searchInputEl = document.getElementById('search-input');

// Selettori filtri
const timeframeRadios = document.querySelectorAll('input[name="tf"]');
const resetFiltersBtn = document.getElementById('reset-filters');

// ---------- UTILITIES ----------

function formatCategoryBadgeClass(category) {
  if (!category) return 'badge-cat badge-cyber';
  const up = category.toUpperCase();
  if (up === 'COMPLIANCE') return 'badge-cat badge-compliance';
  return 'badge-cat badge-cyber';
}

function mapCategoryLabel(cat) {
  if (!cat) return 'CYBER';
  const up = cat.toUpperCase();
  if (up === 'COMPLIANCE') return 'Compliance';
  return 'Cyber';
}

function matchesTimeframe(story, timeframe) {
  if (timeframe === 'all') return true;

  const refStr = story.published_at || story.created_at;
  if (!refStr) return true;

  const refDate = new Date(refStr);
  const now = new Date();
  const diffMs = now - refDate;
  const diffHours = diffMs / (1000 * 60 * 60);

  switch (timeframe) {
    case '3h':
      return diffHours <= 3;
    case '24h':
      return diffHours <= 24;
    case '48h':
      return diffHours <= 48;
    case '72h':
      return diffHours <= 72;
    case '1week':
      return diffHours <= 7 * 24;
    default:
      return true;
  }
}

// Hotness semplice: più score = più “hot”
function computeHotScore(story) {
  let score = Number(story.impact_score || 0);

  const title = (story.title_it || '').toLowerCase();
  const summary = (story.summary_it || '').toLowerCase();
  const text = title + ' ' + summary;

  const now = new Date();
  const refStr = story.published_at || story.created_at;
  if (refStr) {
    const ageHours = (now - new Date(refStr)) / (1000 * 60 * 60);
    if (ageHours <= 3) score += 5;
    else if (ageHours <= 24) score += 3;
    else if (ageHours <= 48) score += 1;
  }

  const keywords = [
    { k: 'ransomware', w: 5 },
    { k: 'zero-day', w: 4 },
    { k: 'zero day', w: 4 },
    { k: 'supply chain', w: 3 },
    { k: 'nis2', w: 3 },
    { k: 'critical vulnerability', w: 3 },
    { k: 'cve-', w: 2 }
  ];
  keywords.forEach(({ k, w }) => {
    if (text.includes(k)) score += w;
  });

  const source = (story.main_source_name || '').toLowerCase();
  if (source.includes('securityinfo')) score += 2;
  if (source.includes('csirt') || source.includes('cert')) score += 3;

  return score;
}

function getFilteredStories() {
  let filtered = [...allStories];

  filtered = filtered.filter((s) => matchesTimeframe(s, filterState.timeframe));

  const q = filterState.search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((s) => {
      const title = (s.title_it || '').toLowerCase();
      const summary = (s.summary_it || '').toLowerCase();
      const source = (s.main_source_name || '').toLowerCase();
      return (
        title.includes(q) ||
        summary.includes(q) ||
        source.includes(q)
      );
    });
  }

  filtered.sort((a, b) => computeHotScore(b) - computeHotScore(a));
  return filtered;
}

// ---------- GENERAZIONE POST LINKEDIN ----------

function generateLinkedInDraft(story) {
  const title = story.title_it || 'Aggiornamento cybersecurity';
  const summary = story.summary_it || '';
  const source = story.main_source_name || '';
  const link = story.main_source_url || '';
  const shortSummary = summary.length > 320 ? summary.slice(0, 317) + '…' : summary;

  let text = '🔐 ' + title + '\n\n';
  if (shortSummary) text += shortSummary + '\n\n';

  text += 'Punti chiave:\n';
  text += '• Contesto: ' + (story.main_category || 'Cybersecurity') + '\n';
  text += '• Fonte: ' + (source || 'fonti affidabili') + '\n';
  text += '• Timeframe: ' + (story.timeframe_label || 'ultime ore') + '\n\n';

  if (link) text += 'Approfondimento: ' + link + '\n\n';
  text += '#cybersecurity #infosec #DiblaNewsRadar';

  return text;
}

function generateLinkedInSummary(stories, timeframeLabel) {
  if (!stories.length) {
    return 'Nessuna hot news disponibile per il periodo selezionato.';
  }

  const top = stories.slice(0, 5);

  let header = '🧭 Hot cyber & compliance news ' + timeframeLabel + '\n\n';
  let body = '';

  top.forEach((s, idx) => {
    const title = s.title_it || 'Notizia';
    const source = s.main_source_name || 'Fonte';
    const link = s.main_source_url || '';
    const summary = s.summary_it || '';
    const shortSummary = summary.length > 200 ? summary.slice(0, 197) + '…' : summary;

    body += (idx + 1) + ') ' + title + '\n';
    if (shortSummary) body += '   ' + shortSummary + '\n';
    body += '   Fonte: ' + source;
    if (link) body += ' | ' + link;
    body += '\n\n';
  });

  const footer =
    'Come stai adattando la tua strategia a queste evoluzioni?\n\n' +
    '#cybersecurity #threatintel #DiblaNewsRadar';

  return header + body + footer;
}

// ---------- RENDER UI ----------

function renderHero(stories) {
  heroRowEl.innerHTML = '';
  if (!stories.length) {
    heroRowEl.style.display = 'none';
    return;
  }
  heroRowEl.style.display = 'grid';

  const hero1 = stories[0];
  const hero2 = stories[1];

  if (hero1) {
    const div = document.createElement('article');
    div.className = 'hero-card';
    div.onclick = () => selectStory(hero1);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(hero1.main_category)}">
        ${mapCategoryLabel(hero1.main_category)}
      </div>
      <h2 class="hero-title">${hero1.title_it}</h2>
      <p class="hero-summary">${hero1.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="hero-footer">
        <span class="badge-sources">
          ${hero1.main_source_name || 'Fonte sconosciuta'}
        </span>
        <span>${hero1.timeframe_label || filterState.timeframe}</span>
      </div>
    `;
    heroRowEl.appendChild(div);
  }

  if (hero2) {
    const div = document.createElement('article');
    div.className = 'hero-card';
    div.onclick = () => selectStory(hero2);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(hero2.main_category)}">
        ${mapCategoryLabel(hero2.main_category)}
      </div>
      <h2 class="hero-title">${hero2.title_it}</h2>
      <p class="hero-summary">${hero2.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="hero-footer">
        <span class="badge-sources">
          ${hero2.main_source_name || 'Fonte sconosciuta'}
        </span>
        <span>${hero2.timeframe_label || filterState.timeframe}</span>
      </div>
    `;
    heroRowEl.appendChild(div);
  }
}

function renderGrid(stories) {
  storyGridEl.innerHTML = '';
  if (!stories.length) {
    storyGridEl.innerHTML =
      '<p style="font-size:12px; color:#9ca3af;">Nessuna storia per il timeframe selezionato.</p>';
    return;
  }

  stories.forEach((story) => {
    const div = document.createElement('article');
    div.className = 'story-card';
    div.onclick = () => selectStory(story);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(story.main_category)}" style="margin-bottom:4px;">
        ${mapCategoryLabel(story.main_category)}
      </div>
      <h3 class="story-title">${story.title_it}</h3>
      <p class="story-summary">${story.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="story-footer">
        <span>
          ${(story.main_source_name || 'Fonte sconosciuta')} • ${(story.timeframe_label || filterState.timeframe)}
        </span>
        <span class="badge-sources-small">HOT score: ${computeHotScore(story)}</span>
      </div>
    `;
    storyGridEl.appendChild(div);
  });
}

function selectStory(story) {
  selectedStory = story;
  renderDetail();
}

function renderDetail() {
  if (!selectedStory) {
    detailPanelEl.innerHTML = `
      <p style="font-size: 12px; color: #9ca3af;">
        Seleziona una storia per vedere i dettagli e generare una bozza LinkedIn.
      </p>
    `;
    linkedinBoxEl.style.display = 'none';
    linkedinSummaryBoxEl.style.display = 'none';
    return;
  }

  const story = selectedStory;

  detailPanelEl.innerHTML = `
    <h2 class="detail-title">${story.title_it}</h2>
    <p class="detail-sub">
      Timeframe: ${story.timeframe_label || filterState.timeframe} • Fonte: ${story.main_source_name || 'n/d'}
    </p>

    <div class="detail-box">
      ${story.summary_it || 'Nessun riassunto disponibile.'}
    </div>

    <div class="section-title">Fonte principale</div>
    <div class="detail-box">
      <strong style="font-size:11px;">
        ${story.main_source_name || 'Non specificata'}
      </strong><br />
      ${
        story.main_source_url
          ? `<a href="${story.main_source_url}" target="_blank" style="font-size:10px; color:#38bdf8; text-decoration:underline;">Apri articolo originale</a>`
          : '<span style="font-size:10px; color:var(--text-muted);">Nessun link disponibile.</span>'
      }
    </div>

    <button id="generate-linkedin" class="pill-btn" style="margin:8px 0;">
      <span>Bozza LinkedIn (singola news)</span>
      <span>✎</span>
    </button>

    <button id="generate-linkedin-summary" class="pill-btn" style="margin:0 0 4px 0;">
      <span>Riepilogo LinkedIn (${getTimeframeLabel(filterState.timeframe)})</span>
      <span>🧾</span>
    </button>
  `;

  detailPanelEl.appendChild(linkedinBoxEl);
  detailPanelEl.appendChild(linkedinSummaryBoxEl);

  const btnSingle = document.getElementById('generate-linkedin');
  const btnSummary = document.getElementById('generate-linkedin-summary');

  btnSingle.addEventListener('click', () => {
    const draft = generateLinkedInDraft(story);
    linkedinBoxEl.style.display = 'block';
    linkedinBoxEl.textContent = draft;
  });

  btnSummary.addEventListener('click', () => {
    const currentStories = getFilteredStories();
    const draftSummary = generateLinkedInSummary(
      currentStories,
      getTimeframeLabel(filterState.timeframe)
    );
    linkedinSummaryBoxEl.style.display = 'block';
    linkedinSummaryBoxEl.textContent = draftSummary;
  });
}

function getTimeframeLabel(tf) {
  switch (tf) {
    case '3h':
      return 'ultime 3 ore';
    case '24h':
      return 'ultime 24 ore';
    case '48h':
      return 'ultime 48 ore';
    case '72h':
      return 'ultimi 3 giorni';
    case '1week':
      return 'ultima settimana';
    case 'all':
      return 'periodo completo';
    default:
      return tf;
  }
}

// Rendering in base a filtri
function applyFiltersAndRender() {
  const filtered = getFilteredStories();
  const hero = filtered.slice(0, 2);
  const others = filtered.slice(2);

  renderHero(hero);
  renderGrid(others);

  if (!selectedStory && filtered.length) {
    selectedStory = hero[0] || others[0] || null;
  }
  renderDetail();
}

// ---------- EVENTI UI ----------

// Timeframe radio
timeframeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      filterState.timeframe = radio.value;
      selectedStory = null;
      linkedinBoxEl.style.display = 'none';
      linkedinSummaryBoxEl.style.display = 'none';
      applyFiltersAndRender();
    }
  });
});

// Reset timeframe
resetFiltersBtn.addEventListener('click', () => {
  filterState.timeframe = '24h';
  timeframeRadios.forEach((r) => {
    r.checked = r.value === '24h';
  });
  selectedStory = null;
  linkedinBoxEl.style.display = 'none';
  linkedinSummaryBoxEl.style.display = 'none';
  applyFiltersAndRender();
});

// Search bar (facoltativa ma utile)
searchInputEl.addEventListener('input', () => {
  filterState.search = searchInputEl.value || '';
  selectedStory = null;
  linkedinBoxEl.style.display = 'none';
  linkedinSummaryBoxEl.style.display = 'none';
  applyFiltersAndRender();
});

// ---------- CARICAMENTO INIZIALE ----------

async function loadStories() {
  loadingEl.textContent = 'Caricamento storie da Supabase…';

  const { data, error } = await client
    .from('stories')
    .select('*')
    .order('impact_score', { ascending: false })
    .limit(150);

  if (error) {
    console.error('Errore Supabase:', error);
    loadingEl.textContent = 'Errore nel caricamento delle storie.';
    return;
  }

  allStories = data || [];

  const now = new Date();
  lastUpdateEl.textContent = now.toLocaleTimeString('it-IT');
  loadingEl.style.display = 'none';

  if (!allStories.length) {
    heroRowEl.style.display = 'none';
    storyGridEl.innerHTML =
      '<p style="font-size:12px; color:#9ca3af;">Nessuna storia presente nella tabella "stories".</p>';
    return;
  }

  selectedStory = null;
  applyFiltersAndRender();
}

// Avvio
loadStories();
