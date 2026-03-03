// CONFIG SUPABASE
const SUPABASE_URL = 'https://ucbtlovcinjkqmkobmxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g0UnsYuXG-mHe3gCH_lj5A__jlAqD7q';

// Inizializza Supabase (CDN UMD espone window.supabase)
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stato in memoria
let allStories = [];
let selectedStory = null;

// Stato filtri
const filterState = {
  category: 'ALL',     // ALL | IT | CYBER | COMPLIANCE
  search: '',
  timeframe: '24h',    // '24h' | '48h' | '72h' | '1week' | 'all'
  topicChip: null      // es. 'NIS2', 'Cybersecurity Act', 'ransomware', ...
};

// Elementi DOM
const heroRowEl = document.getElementById('hero-row');
const storyGridEl = document.getElementById('story-grid');
const detailPanelEl = document.getElementById('detail-panel');
const linkedinBoxEl = document.getElementById('linkedin-box');
const loadingEl = document.getElementById('loading');
const lastUpdateEl = document.getElementById('last-update');
const searchInputEl = document.getElementById('search-input');

// Helpers selettori
const categoryButtons = document.querySelectorAll('.pill-btn[data-category]');
const timeframeRadios = document.querySelectorAll('input[name="tf"]');
const topicChipsTop = document.querySelectorAll('.top-chips .chip');
const resetFiltersBtn = document.getElementById('reset-filters');

// ---------- FUNZIONI DI UTILITÀ ----------

function formatCategoryBadgeClass(category) {
  if (!category) return 'badge-cat badge-cyber';
  const up = category.toUpperCase();
  if (up === 'COMPLIANCE') return 'badge-cat badge-compliance';
  if (up === 'IT') return 'badge-cat badge-cyber';
  return 'badge-cat badge-cyber';
}

function mapCategoryLabel(cat) {
  if (!cat) return 'CYBER';
  const up = cat.toUpperCase();
  if (up === 'IT') return 'IT & Tech';
  if (up === 'COMPLIANCE') return 'Compliance';
  return 'Cyber';
}

function matchesTimeframe(story, timeframe) {
  if (timeframe === 'all') return true;
  if (!story.created_at && !story.published_at) return true;

  const refStr = story.published_at || story.created_at;
  const refDate = new Date(refStr);
  const now = new Date();
  const diffMs = now - refDate;
  const diffHours = diffMs / (1000 * 60 * 60);

  switch (timeframe) {
    case '24h':
      return diffHours <= 24;
    case '48h':
      return diffHours <= 48;
    case '72h':
      return diffHours <= 72;
    case '1week':
      return diffHours <= 24 * 7;
    default:
      return true;
  }
}

// Applica filtri in memoria
function getFilteredStories() {
  let filtered = [...allStories];

  // Categoria
  if (filterState.category !== 'ALL') {
    filtered = filtered.filter((s) => {
      if (!s.main_category) return false;
      const up = s.main_category.toUpperCase();
      if (filterState.category === 'CYBER') return up === 'CYBER';
      if (filterState.category === 'COMPLIANCE') return up === 'COMPLIANCE';
      if (filterState.category === 'IT') return up === 'IT';
      return true;
    });
  }

  // Timeframe
  filtered = filtered.filter((s) => matchesTimeframe(s, filterState.timeframe));

  // Search + topicChip
  const q = filterState.search.trim().toLowerCase();
  const topic = (filterState.topicChip || '').toLowerCase();

  if (q || topic) {
    filtered = filtered.filter((s) => {
      const title = (s.title_it || '').toLowerCase();
      const summary = (s.summary_it || '').toLowerCase();
      const tags = (s.main_tags || []).map((t) => (t || '').toLowerCase());
      const source = (s.main_source_name || '').toLowerCase();

      const searchMatch = q
        ? title.includes(q) ||
          summary.includes(q) ||
          tags.some((t) => t.includes(q)) ||
          source.includes(q)
        : true;

      const topicMatch = topic
        ? title.includes(topic) ||
          summary.includes(topic) ||
          tags.some((t) => t.includes(topic))
        : true;

      return searchMatch && topicMatch;
    });
  }

  return filtered;
}

// ---------- GENERAZIONE POST LINKEDIN (BOZZA) ----------

function generateLinkedInDraft(story) {
  const title = story.title_it || 'Aggiornamento cybersecurity';
  const summary = story.summary_it || '';
  const source = story.main_source_name || '';
  const link = story.main_source_url || '';

  const shortSummary = summary.length > 280 ? summary.slice(0, 277) + '...' : summary;

  return (
    '🔐 ' + title + '\n\n' +
    (shortSummary ? shortSummary + '\n\n' : '') +
    'Punti chiave:\n' +
    '• Contesto: ' + (story.main_category || 'Cybersecurity') + '\n' +
    '• Fonte: ' + (source || 'varie fonti affidabili') + '\n' +
    '• Timeframe: ' + (story.timeframe_label || 'ultime ore') + '\n\n' +
    (link ? 'Approfondimento: ' + link + '\n\n' : '') +
    '#cybersecurity #IT #compliance #DiblaNewsRadar'
  );
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
    const tags = hero1.main_tags || [];
    const div = document.createElement('article');
    div.className = 'hero-card';
    div.onclick = () => selectStory(hero1);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(hero1.main_category)}">
        ${mapCategoryLabel(hero1.main_category)}
      </div>
      <h2 class="hero-title">${hero1.title_it}</h2>
      <p class="hero-summary">${hero1.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.map((t) => `<div class="chip">${t}</div>`).join('')}
      </div>
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
    const tags = hero2.main_tags || [];
    const div = document.createElement('article');
    div.className = 'hero-card';
    div.onclick = () => selectStory(hero2);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(hero2.main_category)}">
        ${mapCategoryLabel(hero2.main_category)}
      </div>
      <h2 class="hero-title">${hero2.title_it}</h2>
      <p class="hero-summary">${hero2.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.map((t) => `<div class="chip">${t}</div>`).join('')}
      </div>
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
      '<p style="font-size:12px; color:#9ca3af;">Nessuna storia per i filtri selezionati.</p>';
    return;
  }

  stories.forEach((story) => {
    const tags = story.main_tags || [];
    const div = document.createElement('article');
    div.className = 'story-card';
    div.onclick = () => selectStory(story);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(story.main_category)}" style="margin-bottom:4px;">
        ${mapCategoryLabel(story.main_category)}
      </div>
      <h3 class="story-title">${story.title_it}</h3>
      <p class="story-summary">${story.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.slice(0, 3).map((t) => `<div class="chip">${t}</div>`).join('')}
      </div>
      <div class="story-footer">
        <span>
          ${(story.main_source_name || 'Fonte sconosciuta')} • ${(story.timeframe_label || filterState.timeframe)}
        </span>
        <span class="badge-sources-small">+X fonti correlate</span>
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
        Seleziona una storia per vedere i dettagli e le correlazioni.
      </p>
    `;
    if (linkedinBoxEl) {
      linkedinBoxEl.style.display = 'none';
      linkedinBoxEl.textContent = '';
    }
    return;
  }

  const tags = selectedStory.main_tags || [];

  detailPanelEl.innerHTML = `
    <h2 class="detail-title">${selectedStory.title_it}</h2>
    <p class="detail-sub">
      Panoramica da più fonti (demo). Timeframe: ${selectedStory.timeframe_label || filterState.timeframe}.
    </p>

    <div class="detail-box">
      ${selectedStory.summary_it || 'Nessun riassunto disponibile.'}
    </div>

    <div class="section-title">Timeline eventi</div>
    <div class="timeline">
      <div class="timeline-item">
        <div class="timeline-meta">Ieri 09:15 • Fonte A • IT</div>
        <div class="timeline-title">
          Notizia correlata di esempio (demo statica).
        </div>
      </div>
      <div class="timeline-item">
        <div class="timeline-meta">Ieri 10:40 • Fonte B • US</div>
        <div class="timeline-title">
          Altra notizia correlata di esempio (demo).
        </div>
      </div>
      <div class="timeline-item">
        <div class="timeline-meta">Oggi 08:05 • Fonte C • EU</div>
        <div class="timeline-title">
          Nuovo update su stesso argomento (demo).
        </div>
      </div>
    </div>

    <div class="section-title">Tag principali</div>
    <div class="detail-tags">
      ${tags.map((t) => `<div class="detail-tag">${t}</div>`).join('')}
    </div>

    <div class="section-title">Fonte principale</div>
    <div class="detail-box">
      <strong style="font-size:11px;">
        ${selectedStory.main_source_name || 'Non specificata'}
      </strong><br />
      ${
        selectedStory.main_source_url
          ? `<a href="${selectedStory.main_source_url}" target="_blank" style="font-size:10px; color:#38bdf8; text-decoration:underline;">Apri articolo originale</a>`
          : '<span style="font-size:10px; color:var(--text-muted);">Nessun link disponibile.</span>'
      }
    </div>

    <button id="generate-linkedin" class="pill-btn" style="margin:8px 0;">
      <span>Genera bozza post LinkedIn</span>
      <span>✎</span>
    </button>
  `;

  if (linkedinBoxEl) {
    detailPanelEl.appendChild(linkedinBoxEl);
  }

  const btn = document.getElementById('generate-linkedin');
  if (btn && linkedinBoxEl) {
    btn.addEventListener('click', () => {
      const draft = generateLinkedInDraft(selectedStory);
      linkedinBoxEl.style.display = 'block';
      linkedinBoxEl.textContent = draft;
    });
  }
}

// Rendering in base ai filtri correnti
function applyFiltersAndRender() {
  const filtered = getFilteredStories();
  const hero = filtered.slice(0, 2);
  const others = filtered.slice(2);

  renderHero(hero);
  renderGrid(others);

  if (!selectedStory && filtered.length) {
    selectedStory = hero[1] || hero[0] || others[0] || null;
  }
  renderDetail();
}

// ---------- EVENTI UI (FILTRI) ----------

// Categorie sidebar
categoryButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    categoryButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const cat = btn.getAttribute('data-category');
    filterState.category = cat || 'ALL';

    applyFiltersAndRender();
  });
});

// Timeframe radio
timeframeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      filterState.timeframe = radio.value; // '24h', '48h', '72h', '1week', 'all'
      applyFiltersAndRender();
    }
  });
});

// Search bar
searchInputEl.addEventListener('input', () => {
  filterState.search = searchInputEl.value || '';
  applyFiltersAndRender();
});

// Chip topic in alto
topicChipsTop.forEach((chip) => {
  chip.addEventListener('click', () => {
    const alreadyActive = chip.classList.contains('active');
    topicChipsTop.forEach((c) => c.classList.remove('active'));

    if (alreadyActive) {
      filterState.topicChip = null;
    } else {
      chip.classList.add('active');
      filterState.topicChip = chip.textContent.trim();
    }

    applyFiltersAndRender();
  });
});

// Reset filtri
if (resetFiltersBtn) {
  resetFiltersBtn.addEventListener('click', () => {
    filterState.category = 'ALL';
    filterState.search = '';
    filterState.timeframe = '24h';
    filterState.topicChip = null;

    categoryButtons.forEach((b) => b.classList.remove('active'));
    const firstBtn = document.querySelector('.pill-btn[data-category="ALL"]');
    if (firstBtn) firstBtn.classList.add('active');

    timeframeRadios.forEach((r) => {
      r.checked = r.value === '24h';
    });

    searchInputEl.value = '';
    topicChipsTop.forEach((c) => c.classList.remove('active'));

    applyFiltersAndRender();
  });
}

// ---------- CARICAMENTO INIZIALE DA SUPABASE ----------

async function loadStories() {
  loadingEl.textContent = 'Caricamento storie da Supabase…';

  const { data, error } = await client
    .from('stories')
    .select('*')
    .order('impact_score', { ascending: false })
    .limit(100);

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
