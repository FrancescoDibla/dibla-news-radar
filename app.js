// CONFIG SUPABASE
const SUPABASE_URL = 'https://ucbtlovcinjkqmkobmxb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_g0UnsYuXG-mHe3gCH_lj5A__jlAqD7q';

// Inizializza Supabase (CDN UMD espone window.supabase)
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Stato in memoria
let allStories = [];
let selectedStory = null;

// Elementi DOM
const heroRowEl = document.getElementById('hero-row');
const storyGridEl = document.getElementById('story-grid');
const detailPanelEl = document.getElementById('detail-panel');
const loadingEl = document.getElementById('loading');
const lastUpdateEl = document.getElementById('last-update');
const searchInputEl = document.getElementById('search-input');

function formatCategoryBadgeClass(category) {
  if (!category) return 'badge-cat badge-cyber';
  if (category.toUpperCase() === 'COMPLIANCE') return 'badge-cat badge-compliance';
  return 'badge-cat badge-cyber';
}

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
        ${hero1.main_category || 'Categoria'}
      </div>
      <h2 class="hero-title">${hero1.title_it}</h2>
      <p class="hero-summary">${hero1.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.map(t => `<div class="chip">${t}</div>`).join('')}
      </div>
      <div class="hero-footer">
        <span class="badge-sources">8 fonti correlate</span>
        <span>${hero1.timeframe_label || 'recenti'}</span>
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
        ${hero2.main_category || 'Categoria'}
      </div>
      <h2 class="hero-title">${hero2.title_it}</h2>
      <p class="hero-summary">${hero2.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.map(t => `<div class="chip">${t}</div>`).join('')}
      </div>
      <div class="hero-footer">
        <span class="badge-sources">12 fonti correlate</span>
        <span>${hero2.timeframe_label || 'recenti'}</span>
      </div>
    `;
    heroRowEl.appendChild(div);
  }
}

function renderGrid(stories) {
  storyGridEl.innerHTML = '';
  stories.forEach(story => {
    const tags = story.main_tags || [];
    const div = document.createElement('article');
    div.className = 'story-card';
    div.onclick = () => selectStory(story);

    div.innerHTML = `
      <div class="${formatCategoryBadgeClass(story.main_category)}" style="margin-bottom:4px;">
        ${story.main_category || 'Categoria'}
      </div>
      <h3 class="story-title">${story.title_it}</h3>
      <p class="story-summary">${story.summary_it || 'Nessun riassunto disponibile.'}</p>
      <div class="pill-chip-row">
        ${tags.slice(0, 3).map(t => `<div class="chip">${t}</div>`).join('')}
      </div>
      <div class="story-footer">
        <span>${story.timeframe_label || 'recenti'}</span>
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
    return;
  }

  const tags = selectedStory.main_tags || [];

  detailPanelEl.innerHTML = `
    <h2 class="detail-title">${selectedStory.title_it}</h2>
    <p class="detail-sub">
      Panoramica da più fonti (demo). Timeframe: ${selectedStory.timeframe_label || 'recenti'}.
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
      ${tags.map(t => `<div class="detail-tag">${t}</div>`).join('')}
    </div>

    <div class="section-title">Fonti correlate</div>
    <div class="detail-box">
      <strong style="font-size:11px;">Securityinfo.it (IT)</strong><br />
      <span style="font-size:10px;">“Titolo notizia correlata di esempio”</span><br />
      <span style="font-size:10px; color:var(--text-muted);">
        Breve snippet tradotto in italiano per illustrare la fonte correlata.
      </span>
    </div>
    <div class="detail-box">
      <strong style="font-size:11px;">SecurityWeek (US)</strong><br />
      <span style="font-size:10px;">“Titolo notizia correlata di esempio”</span><br />
      <span style="font-size:10px; color:var(--text-muted);">
        Altro snippet tradotto in italiano (demo statica).
      </span>
    </div>
  `;
}

function applySearchFilter() {
  const q = (searchInputEl.value || '').toLowerCase();
  let filtered = [...allStories];
  if (q) {
    filtered = filtered.filter(story =>
      story.title_it.toLowerCase().includes(q) ||
      (story.summary_it || '').toLowerCase().includes(q) ||
      (story.main_tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  const hero = filtered.slice(0, 2);
  const others = filtered.slice(2);

  renderHero(hero);
  renderGrid(others);
}

// Carica stories da Supabase
async function loadStories() {
  loadingEl.textContent = 'Caricamento storie da Supabase…';

  const { data, error } = await client
    .from('stories')
    .select('*')
    .order('impact_score', { ascending: false })
    .limit(30);

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

  const hero = allStories.slice(0, 2);
  const others = allStories.slice(2);

  renderHero(hero);
  renderGrid(others);

  if (!selectedStory) {
    selectedStory = hero[1] || hero[0] || others[0] || null;
  }
  renderDetail();
}

// Event listeners
searchInputEl.addEventListener('input', () => {
  applySearchFilter();
});

// Avvio
loadStories();
