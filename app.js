/* ============================================================
   国博讲解手册 — application
   Vanilla JS, no build step, data stays on the device.
   ============================================================ */
(function () {
  'use strict';

  const APP_NAME = '国博讲解手册';
  const LS_KEY = 'guobo-guide-v1';
  const LAST_KEY = 'guobo-guide-last';
  const DB_NAME = 'guobo-guide';
  const DB_STORE = 'kv';
  const READER_SIZES = [22, 26, 30, 34];
  const THEME_KEY = 'guobo-theme';
  const THEMES = [
    { id: 'paper', name: '宣纸' },
    { id: 'white', name: '纯白' },
    { id: 'ink', name: '墨色' },
    { id: 'slate', name: '青灰' }
  ];

  const state = {
    data: null,
    ui: {
      route: { name: 'home' },
      query: '',
      sortMode: false,
      modal: null,
      editor: null,
      manager: null,
      ai: null,
      cardMenu: null,
      reader: null,
      review: { galleryId: 'all', artifactId: null, revealed: false, count: 0 },
      lastArtifact: null
    }
  };

  let dbPromise = null;
  let saveTimer = null;
  let toastTimer = null;
  let readerTimer = null;
  let wakeLock = null;
  let deferredInstall = null;
  let storageWarned = false;
  let dragId = null;
  let dropTarget = null;
  let lastDragAt = 0;

  /* ---------------- icons ---------------- */
  const ICONS = {
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8 7h8"/>',
    shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7L11.5 5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.5 19"/>',
    alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  };
  function icon(name, cls) {
    const p = ICONS[name] || ICONS.info;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ---------------- utils ---------------- */
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const nl2br = (value) => esc(value).replace(/\n/g, '<br>');
  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowISO = () => new Date().toISOString();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const firstChar = (s) => (String(s || '').trim()[0] || '器');
  const colorSafe = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c || '')) ? c : '#8a6a4f';

  function clone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  function findGallery(id) {
    return (state.data.galleries || []).find((g) => g.id === id) || null;
  }
  function findArtifact(id) {
    return (state.data.artifacts || []).find((a) => a.id === id) || null;
  }
  function galleryArtifacts(gid) {
    return state.data.artifacts.filter((a) => a.galleryId === gid);
  }
  function galleryName(gid) {
    const g = findGallery(gid);
    return g ? g.name : '未分类';
  }
  function catalogItems() {
    return (window.CATALOG_DATA && Array.isArray(window.CATALOG_DATA.items)) ? window.CATALOG_DATA.items : [];
  }
  function catalogUnitName(gid) {
    const u = ((window.CATALOG_DATA && window.CATALOG_DATA.units) || []).find((x) => x.id === gid);
    return u ? u.name : galleryName(gid);
  }
  function contentForCatalog(item) {
    const data = window.CONTENT_DATA;
    if (!data || typeof data !== 'object' || !item) return null;
    return data[item.g + '|' + item.n] || null;
  }
  function inferCategory(item) {
    const s = String(item.n || '') + ' ' + String(item.m || '');
    if (/俑/.test(s)) return '陶俑';
    if (/瓷/.test(s)) return '瓷器';
    if (/玉/.test(s)) return '玉器';
    if (/陶/.test(s)) return '陶器';
    if (/青铜|鼎|尊|簋|簠|壶|鉴|爵|觥|甗|鬲|卣|彝|盘|匜|钟|镈|戈|剑|矛|斧|镜|符|印/.test(s)) return '青铜器';
    if (/冠|衣|袍|绣|丝|绢|帛|锦/.test(s)) return '织绣';
    if (/简|纸|卷|图|册|书/.test(s)) return '文献';
    return '';
  }
  function inferMaterial(item) {
    if (item.m) return item.m;
    const s = String(item.n || '');
    if (/青瓷/.test(s)) return '青瓷';
    if (/白瓷/.test(s)) return '白瓷';
    if (/青花/.test(s)) return '青花瓷';
    if (/彩陶/.test(s)) return '彩陶';
    if (/陶/.test(s)) return '陶';
    if (/玉/.test(s)) return '玉';
    if (/青铜|鼎|尊|簋|簠|壶|鉴|爵|觥|甗|鬲|卣|彝|盘|匜|钟|镈|戈|剑|矛|斧|镜|符|印/.test(s)) return '青铜';
    if (/银/.test(s)) return '银';
    if (/金/.test(s)) return '金';
    return '';
  }
  function totalMinutes() {
    return state.data.artifacts.reduce((sum, a) => sum + (Number(a.duration) || 0), 0);
  }
  function colorLabel(cc) {
    return cc === 'green' ? '要讲' : cc === 'yellow' ? '不熟' : cc === 'red' ? '以后讲' : '未标记';
  }
  function normalizeTheme(id) {
    return THEMES.some((t) => t.id === id) ? id : 'paper';
  }
  function currentTheme() {
    try { return normalizeTheme(localStorage.getItem(THEME_KEY)); } catch (e) { return 'paper'; }
  }
  function applyTheme(id, persist) {
    const theme = normalizeTheme(id);
    document.documentElement.dataset.theme = theme;
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    }
    return theme;
  }
  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
  function dateLabel(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (e) { return ''; }
  }
  function safeUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    if (/^(https?:\/\/|\/|assets\/|data:image\/|\.\/)/i.test(u)) return u;
    return '';
  }
  function storyText(a) {
    const override = window.STORY_OVERRIDES && window.STORY_OVERRIDES[a.name];
    if (override && String(override).trim()) return String(override).trim();
    const s = String(a.story || '').trim();
    if (s) return s;
    const sc = a.script || {};
    return [sc.opening, sc.body, sc.highlight, sc.closing].filter((x) => x && String(x).trim()).join('\n\n');
  }
  function storyBeats(a) {
    const text = storyText(a);
    if (!text) return [{ label: '讲解故事', text: a.summary || a.name }];
    const beats = [];
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    for (const p of paragraphs) {
      if (p.length <= 240) { beats.push({ label: '讲解故事', text: p }); continue; }
      const sentences = p.match(/[^。！？!?；;\n]+[。！？!?；;]?/g) || [p];
      let buf = '';
      for (const sentence of sentences) {
        if (buf && (buf + sentence).length > 220) {
          beats.push({ label: '讲解故事', text: buf.trim() });
          buf = '';
        }
        buf += sentence;
      }
      if (buf.trim()) beats.push({ label: '讲解故事', text: buf.trim() });
    }
    return beats.length ? beats : [{ label: '讲解故事', text }];
  }
  function metaLine(a) {
    return [a.era, a.size, a.weight].filter(Boolean).join(' · ');
  }
  function imageTag(a, extraClass) {
    const src = safeUrl(a.image);
    if (!src) {
      return '<div class="no-img ' + esc(extraClass || '') + '">' + esc(firstChar(a.name)) + '</div>';
    }
    return '<img class="' + esc(extraClass || '') + '" src="' + esc(src) + '" alt="' + esc(a.name) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'img-missing\')">';
  }

  /* ---------------- persistence ---------------- */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb error'));
    });
    return dbPromise;
  }
  function idbGet(key) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }
  function idbPut(key, value) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }
  async function loadStored() {
    try {
      const fromDb = await idbGet('state');
      if (fromDb && fromDb.galleries) return fromDb;
    } catch (e) { /* fall through */ }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }
  function defaultApiBase() {
    return 'https://api.deepseek.com/chat/completions';
  }
  function defaultSettings() {
    return {
      apiBase: defaultApiBase(),
      apiKey: '',
      model: 'deepseek-flash',
      thinking: false
    };
  }
  function freshSeed() {
    const d = clone(window.SEED_DATA);
    d.settings = defaultSettings();
    const now = nowISO();
    d.artifacts.forEach((a) => {
      a.createdAt = a.createdAt || now;
      a.updatedAt = a.updatedAt || now;
      delete a.status;
      a.notes = a.notes || '';
      a.tags = a.tags || [];
      a.facts = a.facts || [];
      a.sources = a.sources || [];
    });
    return d;
  }
  function normalizeData(input) {
    if (!input || !Array.isArray(input.galleries) || !Array.isArray(input.artifacts)) {
      throw new Error('文件格式不对：需要 galleries 和 artifacts 两个数组。');
    }
    const galleries = input.galleries
      .filter((g) => g && g.id && g.name)
      .map((g) => ({
        id: String(g.id),
        name: String(g.name),
        period: String(g.period || ''),
        description: String(g.description || ''),
        color: colorSafe(g.color)
      }));
    if (!galleries.length) throw new Error('至少需要一个单元。');
    const ids = new Set(galleries.map((g) => g.id));
    const storyOf = (a) => {
      const override = window.STORY_OVERRIDES && window.STORY_OVERRIDES[a.name];
      if (override && String(override).trim()) return String(override).trim();
      if (a.story && String(a.story).trim()) return String(a.story).trim();
      const sc = a.script || {};
      return [sc.opening, sc.body, sc.highlight, sc.closing].filter((x) => x && String(x).trim()).join('\n\n');
    };
    const artifacts = input.artifacts
      .filter((a) => a && a.id && a.name)
      .map((a) => ({
        ...a,
        id: String(a.id),
        galleryId: ids.has(a.galleryId) ? a.galleryId : galleries[0].id,
        name: String(a.name),
        alias: String(a.alias || ''),
        era: String(a.era || a.date || ''),
        date: String(a.date || ''),
        material: String(a.material || ''),
        category: String(a.category || ''),
        size: String(a.size || ''),
        weight: String(a.weight || ''),
        unearthed: String(a.unearthed || ''),
        museum: String(a.museum || '中国国家博物馆'),
        image: String(a.image || ''),
        imageCredit: String(a.imageCredit || ''),
        summary: String(a.summary || ''),
        story: storyOf(a),
        facts: Array.isArray(a.facts) ? a.facts.map(String) : [],
        script: {
          opening: String((a.script && a.script.opening) || ''),
          body: String((a.script && a.script.body) || ''),
          highlight: String((a.script && a.script.highlight) || ''),
          closing: String((a.script && a.script.closing) || '')
        },
        tags: Array.isArray(a.tags) ? a.tags.map(String) : [],
        duration: Number(a.duration) || 3,
        colorCode: ['green', 'yellow', 'red'].includes(a.colorCode) ? a.colorCode : '',
        notes: String(a.notes || ''),
        sources: Array.isArray(a.sources) ? a.sources.filter((s) => s && s.title).map((s) => ({ title: String(s.title), url: String(s.url || '') })) : [],
        createdAt: a.createdAt || nowISO(),
        updatedAt: a.updatedAt || nowISO()
      }));
    artifacts.forEach((a) => { delete a.status; });
    const settings = Object.assign(defaultSettings(), input.settings || {});
    if (!settings.apiBase || settings.apiBase === '/api/ai') settings.apiBase = 'https://api.deepseek.com/chat/completions';
    if (settings.model === 'deepseek-chat') settings.model = 'deepseek-flash';
    settings.thinking = !!settings.thinking;
    return { version: 1, app: 'guobo-guide', galleries, artifacts, settings };
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 180);
  }
  async function saveNow() {
    if (!state.data) return;
    // 先同步写 localStorage：页面被关闭时，这一步最不容易丢。
    try {
      const raw = JSON.stringify(state.data);
      if (raw.length < 4.4 * 1024 * 1024) {
        localStorage.setItem(LS_KEY, raw);
      } else if (!storageWarned) {
        storageWarned = true;
        toast('数据较大，已写入浏览器数据库；建议定期导出备份。');
      }
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        toast('本地存储空间不足，请导出备份后清理图片。');
      }
    }
    try {
      await idbPut('state', state.data);
    } catch (e) { /* localStorage 已经兜底 */ }
  }

  /* ---------------- routing ---------------- */
  const isSplitView = () => window.innerWidth >= 760 && window.innerHeight >= 600;
  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { name: 'home' };
    if (parts[0] === 'g' && parts[1] && parts[2] === 'a' && parts[3]) return { name: 'gallery', id: parts[1], selectedId: parts[3] };
    if (parts[0] === 'g' && parts[1]) return { name: 'gallery', id: parts[1] };
    if (parts[0] === 'a' && parts[1]) return { name: 'artifact', id: parts[1] };
    if (parts[0] === 'review') return { name: 'review' };
    if (parts[0] === 'settings') return { name: 'settings' };
    return { name: 'home' };
  }
  function navigate(hash) {
    if (location.hash === hash) {
      onRoute();
    } else {
      location.hash = hash;
    }
  }
  function replaceRoute(hash) {
    if (location.hash === hash) {
      onRoute();
      return;
    }
    history.replaceState(null, '', hash);
    onRoute();
  }
  function goBack() {
    const r = state.ui.route;
    if (r.name === 'gallery' && r.selectedId) {
      navigate('#/g/' + encodeURIComponent(r.id));
    } else if (r.name === 'artifact') {
      const a = findArtifact(r.id);
      navigate(a ? '#/g/' + encodeURIComponent(a.galleryId) : '#/');
    } else {
      navigate('#/');
    }
  }

  /* ---------------- shell ---------------- */
  function header(route) {
    const active = (name) => route.name === name ? 'active' : '';
    const isHome = route.name === 'home';
    return '<header class="app-header"><div class="header-inner">' +
      (isHome ? '' : '<button class="icon-btn" data-action="go-back" aria-label="返回">' + icon('arrowLeft') + '</button>') +
      '<a class="brand" href="#/" aria-label="回到目录">' +
        '<span class="seal">国</span>' +
        '<span class="brand-copy"><strong>国博讲解手册</strong><small>古代中国 · 基本陈列</small></span>' +
      '</a>' +
      '<div class="header-spacer"></div>' +
      '<nav class="top-nav" aria-label="主导航">' +
        '<a href="#/" class="' + active('home') + '">目录</a>' +
        '<a href="#/review" class="' + active('review') + '">复习</a>' +
        '<a href="#/settings" class="' + active('settings') + '">设置</a>' +
      '</nav>' +
      (!isHome ? '<div class="theme-switch header-theme" role="group" aria-label="底色">' + THEMES.map((t) => '<button type="button" class="theme-swatch theme-' + t.id + (currentTheme() === t.id ? ' active' : '') + '" data-action="set-theme" data-theme="' + t.id + '" title="' + t.name + '" aria-label="' + t.name + '" aria-pressed="' + (currentTheme() === t.id ? 'true' : 'false') + '"></button>').join('') + '</div>' : '') +
      '<button class="icon-btn" data-action="focus-search" aria-label="搜索文物">' + icon('search') + '</button>' +
      '<button class="icon-btn" data-action="go-settings" aria-label="设置">' + icon('settings') + '</button>' +
    '</div></header>';
  }
  function bottomNav(route) {
    if (route.name === 'artifact') return '';
    const active = (name) => route.name === name ? 'active' : '';
    return '<nav class="bottom-nav" aria-label="底部导航">' +
      '<a href="#/" class="' + active('home') + '">' + icon('book') + '目录</a>' +
      '<a href="#/review" class="' + active('review') + '">' + icon('shuffle') + '复习</a>' +
      '<a href="#/settings" class="' + active('settings') + '">' + icon('settings') + '设置</a>' +
    '</nav>';
  }
  function renderApp() {
    const route = state.ui.route || parseRoute();
    const view = route.name === 'gallery' ? galleryView(route.id, route.selectedId)
      : route.name === 'artifact' ? artifactView(route.id)
      : route.name === 'review' ? reviewView()
      : route.name === 'settings' ? settingsView()
      : homeView();
    document.getElementById('app').innerHTML = header(route) + view + bottomNav(route);
    const selected = route.name === 'artifact' ? findArtifact(route.id) : route.name === 'gallery' && route.selectedId ? findArtifact(route.selectedId) : null;
    document.title = selected
      ? selected.name + ' · ' + APP_NAME
      : route.name === 'review' ? '复习 · ' + APP_NAME
      : route.name === 'settings' ? '设置 · ' + APP_NAME
      : route.name === 'gallery' ? (findGallery(route.id) ? findGallery(route.id).name : '目录') + ' · ' + APP_NAME
      : APP_NAME + ' · 古代中国';
  }
  function onRoute() {
    const prev = state.ui.route;
    const route = parseRoute();
    if (route.name === 'gallery' && route.selectedId && !isSplitView()) {
      replaceRoute('#/a/' + encodeURIComponent(route.selectedId));
      return;
    }
    if (route.name === 'gallery' && route.selectedId && !findArtifact(route.selectedId)) {
      replaceRoute('#/g/' + encodeURIComponent(route.id));
      return;
    }
    const sameGallery = prev && prev.name === 'gallery' && route.name === 'gallery' && prev.id === route.id;
    state.ui.route = route;
    state.ui.query = '';
    state.ui.modal = null;
    state.ui.editor = null;
    state.ui.ai = null;
    state.ui.manager = null;
    if (!sameGallery) state.ui.sortMode = false;
    closeReader(true);
    renderModal();
    const focusId = route.name === 'artifact' ? route.id : (route.name === 'gallery' ? route.selectedId : null);
    const focus = focusId ? findArtifact(focusId) : null;
    if (focus) {
      state.ui.lastArtifact = focus.id;
      try { localStorage.setItem(LAST_KEY, focus.id); } catch (e) { /* ignore */ }
    }
    if (route.name === 'review') {
      initReview(true);
    }
    renderApp();
    if (!sameGallery) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------------- home ---------------- */
  function homeView() {
    const data = state.data;
    const galleries = data.galleries;
    const artifacts = data.artifacts;
    const minutes = totalMinutes();
    const theme = currentTheme();
    const lastId = (() => { try { return localStorage.getItem(LAST_KEY); } catch (e) { return null; } })();
    const last = findArtifact(lastId);
    const next = last || artifacts[0];
    const q = state.ui.query || '';

    return '<main class="page home">' +
      '<div class="shell">' +
      '<section class="home-hero">' +
        (next ? '<a class="btn btn-primary" href="#/a/' + encodeURIComponent(next.id) + '">' + icon('play') + (last ? '继续上一件' : '开始准备') + '</a>' : '<button class="btn btn-primary" data-action="add-artifact">' + icon('plus') + '添加第一件文物</button>') +
        '<p class="hero-hint">' +
          (last ? '<span>上次：' + esc(last.name) + '</span><span class="sep">·</span>' : '') +
          '<span class="hero-stats" aria-label="手册统计">' + galleries.length + ' 单元 · ' + artifacts.length + ' 件文物 · 约 ' + minutes + ' 分钟</span>' +
        '</p>' +
        '<div class="theme-switch" role="group" aria-label="底色">' +
          '<span class="theme-label">底色</span>' +
          THEMES.map((t) => '<button type="button" class="theme-swatch theme-' + t.id + (theme === t.id ? ' active' : '') + '" data-action="set-theme" data-theme="' + t.id + '" title="' + t.name + '" aria-label="' + t.name + '" aria-pressed="' + (theme === t.id ? 'true' : 'false') + '"></button>').join('') +
        '</div>' +
      '</section>' +

      '<section class="section">' +
        '<div class="section-head">' +
          '<div><p class="kicker">目录</p><h2>按单元，走一条中国史</h2></div>' +
          '<div class="head-actions"><button class="text-btn" data-action="add-artifact">＋ 新文物</button><button class="text-btn" data-action="manage-galleries">管理单元</button></div>' +
        '</div>' +
        '<div class="search-box">' + icon('search') +
          '<input id="home-search" type="search" placeholder="搜文物、朝代、关键词……" value="' + esc(q) + '" autocomplete="off" aria-label="搜索文物">' +
          '<kbd>Ctrl K</kbd>' +
        '</div>' +
        '<div id="search-results" class="search-results ' + (q ? '' : 'hidden') + '">' + (q ? searchResultsHTML(q) : '') + '</div>' +
        '<div id="timeline" class="timeline ' + (q ? 'hidden' : '') + '">' +
          (galleries.length ? galleries.map((g, i) => galleryCard(g, i)).join('') :
            '<div class="empty-state"><div class="glyph">册</div><h3>还没有单元</h3><p>先建立一个单元，比如“远古”或“专题：丝绸之路”。</p><button class="btn btn-primary btn-sm" data-action="manage-galleries">建立第一个单元</button></div>') +
        '</div>' +
      '</section>' +
      '</div>' +
    '</main>';
  }
  function galleryCard(g, index) {
    const items = galleryArtifacts(g.id);
    const thumbs = items.slice(0, 3).map((a) => {
      const src = safeUrl(a.image);
      return src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<span class="chip">' + esc(firstChar(a.name)) + '</span>';
    }).join('');
    return '<a class="era-row" href="#/g/' + encodeURIComponent(g.id) + '" style="--era-color:' + colorSafe(g.color) + '" aria-label="' + esc(g.name) + '，' + items.length + ' 件文物">' +
      '<span class="era-rail"><span class="era-num">' + String(index + 1).padStart(2, '0') + '</span></span>' +
      '<div class="era-card">' +
        '<div class="era-main">' +
          '<span class="era-period">' + esc(g.period) + '</span>' +
          '<h3>' + esc(g.name) + '</h3>' +
          '<p>' + esc(g.description) + '</p>' +
          '<span class="era-thumbs">' + (thumbs || '<span class="tiny muted">还没有条目，点进来添加第一件</span>') + (items.length > 3 ? '<span class="more">+' + (items.length - 3) + '</span>' : '') + '</span>' +
        '</div>' +
        '<div class="era-side">' +
          '<span class="count">' + items.length + '</span>' +
          '<span class="count-label">件文物</span>' +
          '<span class="arrow" aria-hidden="true">↗</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }
  function searchResultsHTML(q) {
    const needle = q.toLowerCase();
    const hits = state.data.artifacts.filter((a) => {
      const hay = [a.name, a.alias, a.era, a.date, a.summary, a.museum, (a.tags || []).join(' '), galleryName(a.galleryId)].join(' ').toLowerCase();
      return hay.indexOf(needle) >= 0;
    }).slice(0, 8);
    if (!hits.length) {
      return '<div class="search-empty">没有找到“' + esc(q) + '”。可以到对应单元里新增一件。</div>';
    }
    return hits.map((a) => '<a class="search-hit" href="#/a/' + encodeURIComponent(a.id) + '">' +
      '<div class="artifact-thumb" style="width:54px;min-height:54px;height:54px">' + imageTag(a) + '</div>' +
      '<div><h4>' + esc(a.name) + '</h4><p>' + esc(galleryName(a.galleryId)) + ' · ' + esc(a.era) + '</p></div>' +
    '</a>').join('');
  }

  /* ---------------- gallery ---------------- */
  function galleryView(id, selectedId) {
    const g = findGallery(id);
    if (!g) return notFound('找不到这个单元');
    const all = galleryArtifacts(g.id);
    const list = all;
    const sortMode = !!state.ui.sortMode;
    const selected = selectedId ? findArtifact(selectedId) : null;
    const active = selected && selected.galleryId === g.id ? selected : null;
    const head =
      '<div class="subpage-head"><div class="breadcrumb"><a href="#/">目录</a><span class="sep">/</span><span>' + esc(g.name) + '</span></div></div>' +
      '<section class="gallery-hero" style="--era-color:' + colorSafe(g.color) + '">' +
        '<div class="gallery-hero-top">' +
          '<div class="gallery-index">' + esc(g.name.slice(0, 1)) + '</div>' +
          '<div><p class="kicker">' + esc(g.period) + '</p><h1>' + esc(g.name) + '</h1><p class="desc">' + esc(g.description) + '</p></div>' +
        '</div>' +
      '</section>';
    const listBlock =
      '<div class="gallery-toolbar">' +
        '<h2>文物 <span class="muted small" style="font-family:var(--sans);font-weight:400">' + all.length + ' 件</span></h2>' +
        '<div class="filter-row">' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="add-artifact" data-gallery="' + esc(g.id) + '">' + icon('plus') + '添加文物</button>' +
          '<button class="chip chip-btn sort-toggle ' + (sortMode ? 'active' : '') + '" data-action="toggle-sort">' + (sortMode ? '完成排序' : '排序') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="color-legend">' +
        '<span><i class="cc-dot green"></i>要讲</span>' +
        '<span><i class="cc-dot yellow"></i>不熟</span>' +
        '<span><i class="cc-dot red"></i>以后讲</span>' +
        '<span class="legend-hint">' + (sortMode ? '点 ↑↓ 调整顺序，完成后点“完成排序”' : '拖动卡片排序 · 点圆点改颜色') + '</span>' +
      '</div>' +
      (list.length ? '<div class="artifact-list">' + list.map((a) => artifactRow(a, active && active.id === a.id, sortMode)).join('') + '</div>' :
        '<div class="empty-state"><div class="glyph">器</div><h3>这个单元还没有文物</h3><p>想到哪件，就先把名字记下来；内容可以稍后让 AI 起草。</p><button class="btn btn-primary btn-sm" data-action="add-artifact" data-gallery="' + esc(g.id) + '">' + icon('plus') + '添加文物</button></div>') +
      '<button class="add-row" data-action="add-artifact" data-gallery="' + esc(g.id) + '">' + icon('plus') + '在这个单元里添加文物</button>';

    if (!isSplitView()) {
      return '<main class="page"><div class="shell">' + head + listBlock + '</div></main>';
    }
    const detail = active
      ? '<div class="split-detail-inner">' + artifactDetailHTML(active, true) + '</div>'
      : '<div class="split-empty"><div class="glyph">器</div><h3>从左边选一件文物</h3><p>简介、讲解故事和档案会显示在这里，不用离开当前单元。</p></div>';
    return '<main class="page split-page"><div class="shell">' + head +
      '<div class="split-layout"><section class="split-list">' + listBlock + '</section>' +
      '<aside class="split-detail" aria-label="文物详情">' + detail + '</aside></div>' +
      '</div></main>';
  }
  function artifactRow(a, active, sortMode) {
    const cc = a.colorCode || '';
    const canDrag = !sortMode && !('ontouchstart' in window) && window.matchMedia('(pointer: fine)').matches;
    return '<div class="artifact-row' + (cc ? ' cc-' + cc : '') + (active ? ' active' : '') + (sortMode ? ' sorting' : '') + '" data-action="open-artifact" data-id="' + esc(a.id) + '" draggable="' + (canDrag ? 'true' : 'false') + '" role="link" tabindex="0" aria-current="' + (active ? 'true' : 'false') + '" aria-label="' + esc(a.name) + '，' + colorLabel(cc) + '">' +
      '<div class="artifact-thumb">' + imageTag(a) + '</div>' +
      '<div class="artifact-row-main">' +
        '<span class="meta">' + esc(a.era) + ' · ' + esc(a.category || '文物') + '</span>' +
        '<h3>' + esc(a.name) + '</h3>' +
        '<span class="summary">' + esc(a.summary) + '</span>' +
        '<span class="chip-row">' + (a.tags || []).slice(0, 3).map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</span>' +
      '</div>' +
      '<div class="artifact-row-side">' +
        '<button type="button" class="color-dot ' + (cc ? 'on ' + cc : '') + '" data-action="cycle-color" data-id="' + esc(a.id) + '" title="点击切换：绿=要讲，黄=不熟，红=以后讲" aria-label="颜色标记：' + colorLabel(cc) + '"></button>' +
        '<span class="duration">' + icon('clock') + (a.duration || 3) + '′</span>' +
        (sortMode
          ? '<span class="sort-controls"><button type="button" data-action="move-up" data-id="' + esc(a.id) + '" aria-label="上移" title="上移">↑</button><button type="button" data-action="move-down" data-id="' + esc(a.id) + '" aria-label="下移" title="下移">↓</button></span>'
          : '<button type="button" class="card-menu-btn" data-action="card-menu" data-id="' + esc(a.id) + '" aria-label="更多操作" aria-haspopup="dialog" title="更多操作">⋯</button>') +
      '</div>' +
    '</div>';
  }
  function notFound(msg) {
    return '<main class="page"><div class="shell" style="padding-top:60px"><div class="empty-state"><div class="glyph">？</div><h3>' + esc(msg) + '</h3><p>可能已被删除，或者链接不完整。</p><a class="btn btn-primary btn-sm" href="#/">回到目录</a></div></div></main>';
  }
  function reorderArtifact(fromId, targetId, after) {
    const arr = state.data.artifacts;
    const from = arr.findIndex((a) => a.id === fromId);
    if (from < 0 || fromId === targetId) return false;
    const item = arr[from];
    arr.splice(from, 1);
    let to = arr.findIndex((a) => a.id === targetId);
    if (to < 0) { arr.splice(from, 0, item); return false; }
    if (after) to += 1;
    arr.splice(to, 0, item);
    scheduleSave();
    return true;
  }
  function cleanupDrag() {
    document.querySelectorAll('.artifact-row.dragging, .artifact-row.drag-over, .artifact-row.after')
      .forEach((el) => el.classList.remove('dragging', 'drag-over', 'after'));
    dragId = null;
    dropTarget = null;
  }
  function moveArtifact(id, dir) {
    const a = findArtifact(id);
    if (!a) return;
    const list = galleryArtifacts(a.galleryId);
    const pos = list.findIndex((x) => x.id === id);
    const other = list[pos + dir];
    if (!other) return;
    const arr = state.data.artifacts;
    const i = arr.findIndex((x) => x.id === id);
    const j = arr.findIndex((x) => x.id === other.id);
    if (i < 0 || j < 0) return;
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    scheduleSave();
    renderApp();
  }
  function deleteArtifact(id) {
    const a = findArtifact(id);
    if (!a) return;
    const index = state.data.artifacts.findIndex((x) => x.id === id);
    if (index < 0) return;
    const snapshot = clone(a);
    state.data.artifacts.splice(index, 1);
    scheduleSave();
    closeModal();
    const route = state.ui.route;
    if ((route.name === 'artifact' && route.id === id) || (route.name === 'gallery' && route.selectedId === id)) {
      navigate('#/g/' + encodeURIComponent(a.galleryId));
    } else {
      renderApp();
    }
    toast('已删除“' + a.name + '”', {
      label: '撤销',
      duration: 3000,
      onClick: () => restoreArtifact(snapshot, index)
    });
  }
  function restoreArtifact(a, index) {
    if (!a || findArtifact(a.id)) return;
    const pos = Math.min(Math.max(Number(index) || 0, 0), state.data.artifacts.length);
    state.data.artifacts.splice(pos, 0, a);
    scheduleSave();
    renderApp();
    toast('已恢复“' + a.name + '”');
  }

  /* ---------------- artifact detail ---------------- */
  function artifactDetailHTML(a, embedded) {
    const g = findGallery(a.galleryId);
    const src = safeUrl(a.image);
    return '<div class="detail-top">' +
      (embedded
        ? '<button class="icon-btn split-close" data-action="close-split" aria-label="关闭详情">' + icon('close') + '</button>'
        : '<a class="back-link" href="#/g/' + encodeURIComponent(a.galleryId) + '">' + icon('arrowLeft') + esc(galleryName(a.galleryId)) + '</a>') +
      '<div class="detail-top-right">' +
            '<button class="icon-btn" data-action="open-ai" data-id="' + esc(a.id) + '" aria-label="AI 起草">' + icon('sparkle') + '</button>' +
            '<button class="icon-btn" data-action="edit-artifact" data-id="' + esc(a.id) + '" aria-label="编辑">' + icon('edit') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="detail-layout">' +
          '<aside class="detail-figure-wrap">' +
            '<figure class="artifact-figure">' +
              (src ? '<img src="' + esc(src) + '" alt="' + esc(a.name) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\';this.parentElement.classList.add(\'img-missing\')">' : '<div class="no-img" style="aspect-ratio:1/1.04;display:grid;place-items:center;font-family:var(--serif);font-size:64px;color:var(--faint)">' + esc(firstChar(a.name)) + '</div>') +
              '<figcaption>' +
                '<span>' + (a.imageCredit ? '图片来源：' + esc(a.imageCredit) : '还没有配图') + '</span>' +
                '<span class="figure-tools">' +
                  '<button type="button" data-action="official-image" data-id="' + esc(a.id) + '">官网找图</button>' +
                  '<button type="button" data-action="edit-artifact" data-id="' + esc(a.id) + '">换图</button>' +
                '</span>' +
              '</figcaption>' +
            '</figure>' +
          '</aside>' +
          '<div class="detail-main">' +
            '<header class="artifact-title">' +
              '<p class="kicker">' + esc(g ? g.name : '未分类') + ' · ' + esc(a.category || '文物') + '</p>' +
              '<h1>' + esc(a.name) + '</h1>' +
              (a.alias ? '<p class="alias">又名：' + esc(a.alias) + '</p>' : '') +
              '<p class="meta-line">' + esc(metaLine(a) || a.era) + '</p>' +
              '<div class="chip-row"><span class="chip">' + icon('clock') + (a.duration || 3) + ' 分钟</span></div>' +
            '</header>' +
            '<div class="detail-actions-bar">' +
              '<button class="btn btn-primary" data-action="open-reader" data-id="' + esc(a.id) + '">' + icon('play') + '讲解模式</button>' +
              '<button class="btn btn-ghost" data-action="open-ai" data-id="' + esc(a.id) + '">' + icon('sparkle') + '<span class="wide-label">AI 起草</span></button>' +
              '<button class="btn btn-ghost" data-action="edit-artifact" data-id="' + esc(a.id) + '">' + icon('edit') + '<span class="wide-label">编辑</span></button>' +
            '</div>' +
            '<section class="panel summary-panel"><span class="label kicker">一句话简介</span><p>' + esc(a.summary || '还没有简介。点“编辑”或“AI 起草”补上。') + '</p></section>' +
            '<section class="panel">' +
              '<div class="panel-head"><h2>讲解故事</h2><button class="btn btn-sm btn-ghost copy-script" data-action="copy-script" data-id="' + esc(a.id) + '">' + icon('copy') + '复制全篇</button></div>' +
              (storyText(a) ? '<div class="story-text">' + nl2br(storyText(a)) + '</div>' : '<p class="small muted">还没有讲解故事。点“编辑”或“AI 起草”补上。</p>') +
            '</section>' +
            '<section class="panel">' +
              '<div class="panel-head"><h2>文物档案</h2><span class="label">ARCHIVE</span></div>' +
              '<dl class="archive-grid">' +
                '<dt>年代</dt><dd>' + esc(a.era || a.date) + '</dd>' +
                '<dt>材质</dt><dd>' + esc(a.material || '待补充') + '</dd>' +
                '<dt>类别</dt><dd>' + esc(a.category || '待补充') + '</dd>' +
                (a.size ? '<dt>尺寸</dt><dd>' + esc(a.size) + '</dd>' : '') +
                (a.weight ? '<dt>重量</dt><dd>' + esc(a.weight) + '</dd>' : '') +
                (a.unearthed ? '<dt>出土</dt><dd>' + esc(a.unearthed) + '</dd>' : '') +
                '<dt>馆藏</dt><dd>' + esc(a.museum || '中国国家博物馆') + '</dd>' +
                '<dt>更新</dt><dd>' + esc(dateLabel(a.updatedAt)) + '</dd>' +
              '</dl>' +
            '</section>' +
            '<section class="panel">' +
              '<div class="panel-head"><h2>我的笔记</h2><button class="text-btn" data-action="edit-artifact" data-id="' + esc(a.id) + '">写笔记</button></div>' +
              '<div class="notes-box">' + esc(a.notes || '') + '</div>' +
            '</section>' +
            '<p class="detail-footnote">本页为讲解练习草稿，请以展厅说明牌、中国国家博物馆官网及最新研究为准。文物图片版权归中国国家博物馆所有，仅限个人学习使用。</p>' +
          '</div>' +
        '</div>';
  }
  function artifactView(id) {
    const a = findArtifact(id);
    if (!a) return notFound('找不到这件文物');
    return '<main class="page detail-page"><div class="shell">' + artifactDetailHTML(a, false) + '</div></main>';
  }
  /* ---------------- review ---------------- */
  function reviewPool() {
    const gid = state.ui.review.galleryId || 'all';
    return state.data.artifacts.filter((a) => gid === 'all' ? true : a.galleryId === gid);
  }
  function initReview(force) {
    const pool = reviewPool();
    const current = findArtifact(state.ui.review.artifactId);
    if (force || !current || pool.indexOf(current) < 0) {
      state.ui.review.artifactId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
      state.ui.review.revealed = false;
    }
  }
  function reviewView() {
    const pool = reviewPool();
    const gid = state.ui.review.galleryId || 'all';
    const a = findArtifact(state.ui.review.artifactId) || pool[0];
    if (!a) {
      return '<main class="page"><div class="shell"><div class="review-head"><p class="kicker">复习</p><h1>还没有可复习的文物</h1><p>先到目录里添加几件，或者换一个单元。</p></div><div class="empty-state"><div class="glyph">空</div><h3>这个单元是空的</h3><p>添加文物后，这里会随机抽题，帮你在上台前快速过一遍。</p><a class="btn btn-primary btn-sm" href="#/">回目录</a></div></div></main>';
    }
    if (state.ui.review.artifactId !== a.id) {
      state.ui.review.artifactId = a.id;
      state.ui.review.revealed = false;
    }
    const g = findGallery(a.galleryId);
    const revealed = state.ui.review.revealed;
    return '<main class="page">' +
      '<div class="shell">' +
        '<div class="review-head">' +
          '<p class="kicker">上台前，过一遍</p>' +
          '<h1>随堂复习</h1>' +
          '<p>先看图片和名字，试着用 30 秒讲出三个关键词；再翻开讲解故事，对照一下哪里漏了。</p>' +
        '</div>' +
        '<div class="review-controls">' +
          '<div class="filter-row">' +
            '<button class="chip chip-btn ' + (gid === 'all' ? 'active' : '') + '" data-action="review-filter" data-gallery="all">全部</button>' +
            state.data.galleries.map((gg) => '<button class="chip chip-btn ' + (gid === gg.id ? 'active' : '') + '" data-action="review-filter" data-gallery="' + esc(gg.id) + '">' + esc(gg.name) + '</button>').join('') +
          '</div>' +
          '<span class="tiny muted">本轮已复习 ' + state.ui.review.count + ' 件</span>' +
        '</div>' +
        '<div class="review-card">' +
          '<div class="review-visual">' +
            (safeUrl(a.image) ? '<img src="' + esc(safeUrl(a.image)) + '" alt="' + esc(a.name) + '" referrerpolicy="no-referrer">' : '<div class="no-img" style="font-family:var(--serif);font-size:64px;color:var(--faint)">' + esc(firstChar(a.name)) + '</div>') +
            '<div class="veil"></div>' +
            '<div class="review-caption"><p class="era">' + esc(g ? g.name : '') + ' · ' + esc(a.era) + '</p><h2>' + esc(a.name) + '</h2></div>' +
          '</div>' +
          '<div class="review-body">' +
            (revealed ?
              '<div class="review-reveal">' +
                '<p class="review-prompt">对照一下</p>' +
                '<p class="summary">' + esc(a.summary) + '</p>' +
                (storyText(a) ? '<p class="small muted">' + esc(storyText(a).slice(0, 180)) + (storyText(a).length > 180 ? '…' : '') + '</p>' : '') +
                '<div class="review-meta-line"><span>' + icon('clock') + ' ' + (a.duration || 3) + ' 分钟</span></div>' +
                '<div class="review-actions">' +
                  '<button class="btn btn-primary" data-action="review-next">' + icon('shuffle') + '换一件</button>' +
                  '<a class="btn btn-ghost" href="#/a/' + encodeURIComponent(a.id) + '">看完整讲解</a>' +
                  '<button class="btn btn-quiet" data-action="review-again">再想一次</button>' +
                '</div>' +
              '</div>' :
              '<p class="review-prompt">先别翻。试着讲出：</p>' +
              '<p class="review-question">它是什么？它特别在哪？<br>它和这个时代有什么关系？</p>' +
              '<div class="review-actions">' +
                '<button class="btn btn-primary" data-action="review-reveal">' + icon('book') + '翻开讲解故事</button>' +
                '<button class="btn btn-ghost" data-action="review-next">' + icon('shuffle') + '换一件</button>' +
              '</div>'
            ) +
          '</div>' +
          '<div class="review-progress"><span style="width:' + (pool.length ? Math.round(((state.ui.review.count % Math.max(pool.length, 1)) / pool.length) * 100) : 0) + '%"></span></div>' +
        '</div>' +
      '</div>' +
    '</main>';
  }

  /* ---------------- settings ---------------- */
  function settingsView() {
    const s = state.data.settings;
    const bytes = new Blob([JSON.stringify(state.data)]).size;
    const imageCount = state.data.artifacts.filter((a) => a.image).length;
    return '<main class="page settings-page">' +
      '<div class="shell">' +
        '<div class="settings-head"><p class="kicker">设置</p><h1>把这本手册，变成你的。</h1><p>数据默认只存在这台设备里。AI 负责起草，判断和改写仍然由你完成。</p></div>' +
        '<section class="settings-section">' +
          '<h2>AI 起草</h2><p class="section-desc">直接调用 DeepSeek 官方接口。Key 只保存在本机浏览器，电脑和手机都能用；有网就能生成。</p>' +
          '<form id="settings-form">' +
            '<div class="ai-preset-row">' +
              '<button class="btn btn-ghost btn-sm" type="button" data-action="use-deepseek">' + icon('sparkle') + '用 DeepSeek 官方</button>' +
              '<a class="text-btn" href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">创建 Key' + icon('external') + '</a>' +
            '</div>' +
            '<div class="field"><label for="apiBase">接口地址</label><input id="apiBase" name="apiBase" class="input mono" value="' + esc(s.apiBase) + '" placeholder="https://api.deepseek.com/chat/completions" autocomplete="off"><span class="hint">默认：<code>https://api.deepseek.com/chat/completions</code>。</span></div>' +
            '<div class="field-row">' +
              '<div class="field"><label for="apiKey">DeepSeek API Key</label><input id="apiKey" name="apiKey" type="password" class="input" value="' + esc(s.apiKey) + '" placeholder="sk-..." autocomplete="off"><span class="hint">只保存在本机浏览器；导出备份会自动去掉。</span></div>' +
              '<div class="field"><label for="model">模型</label><input id="model" name="model" class="input mono" value="' + esc(s.model) + '" placeholder="deepseek-flash" list="model-options" autocomplete="off"><datalist id="model-options"><option value="deepseek-flash"></option><option value="deepseek-v4-pro"></option></datalist></div>' +
            '</div>' +
            '<label class="check-row"><input type="checkbox" id="thinking" name="thinking" ' + (s.thinking ? 'checked' : '') + '><span>开启思考模式 <small>更慢更贵，复杂推理时再用；日常填空建议关闭</small></span></label>' +
            '<div class="form-actions">' +
              '<button class="btn btn-primary btn-sm" type="submit">保存设置</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-action="test-ai">测试连接</button>' +
              '<button class="btn btn-quiet btn-sm" type="button" data-action="toggle-key">显示 / 隐藏 Key</button>' +
            '</div>' +
          '</form>' +
          '<div class="security-note" style="margin-top:14px">' + icon('info') + '<span>安全提示：Key 只存在本机浏览器；换手机或清缓存时要重新填。不要把 Key 截图、贴到聊天或公开网页里。</span></div>' +
        '</section>' +
        '<section class="settings-section">' +
          '<h2>数据与备份</h2><p class="section-desc">换手机、清缓存前，先导出 JSON。备份包含文字和以本地上传方式保存的图片，但不含 API Key；以 URL 形式保存的图片也不会打包进文件。</p>' +
          '<div class="storage-bar"><span style="width:' + clamp(Math.round(bytes / (5 * 1024 * 1024) * 100), 3, 100) + '%"></span></div>' +
          '<p class="tiny muted" style="margin-bottom:14px">当前数据约 ' + formatBytes(bytes) + ' · ' + state.data.artifacts.length + ' 件文物 · ' + imageCount + ' 张配图</p>' +
          '<div class="settings-actions">' +
            '<button class="btn btn-ghost btn-sm" data-action="export-data">' + icon('download') + '导出备份</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="import-data">' + icon('upload') + '导入备份</button>' +
            '<button class="btn btn-ghost btn-sm" data-action="manage-galleries">' + icon('book') + '管理单元</button>' +
            '<button class="btn btn-quiet btn-sm" data-action="reset-data">重置为示例</button>' +
          '</div>' +
          '<input id="import-file" type="file" accept="application/json,.json" class="hidden">' +
        '</section>' +
        '<section class="settings-section">' +
          '<h2>底色</h2><p class="section-desc">手机顶栏空间小，底色切换放在这里；首页首屏也可以直接切。</p>' +
          '<div class="theme-switch settings-theme" role="group" aria-label="底色"><span class="theme-label">底色</span>' +
            THEMES.map((t) => '<button type="button" class="theme-swatch theme-' + t.id + (currentTheme() === t.id ? ' active' : '') + '" data-action="set-theme" data-theme="' + t.id + '" title="' + t.name + '" aria-label="' + t.name + '" aria-pressed="' + (currentTheme() === t.id ? 'true' : 'false') + '"></button>').join('') +
          '</div>' +
        '</section>' +
        '<section class="settings-section">' +
          '<h2>装到手机上（iPhone / 华为）</h2><p class="section-desc">网页版可以直接用；装到主屏幕后像 App 一样全屏打开。iPhone 的离线缓存和安装需要 HTTPS 地址。</p>' +
          '<ol class="install-steps">' +
            '<li>手机和电脑在同一 Wi-Fi，用手机打开电脑的局域网地址；或把整个文件夹放到一个 HTTPS 静态网站。</li>' +
            '<li>iPhone Safari：点底部<strong>分享</strong> → <strong>添加到主屏幕</strong>；华为浏览器：菜单 → <strong>添加到桌面</strong>；Chrome / Edge：菜单 → <strong>安装应用</strong>。</li>' +
            '<li>首次打开后，页面会缓存到本地；之后在展厅没有网络也能复习。AI 起草需要联网。</li>' +
          '</ol>' +
          (deferredInstall ? '<div class="form-actions"><button class="btn btn-primary btn-sm" data-action="install">现在就安装</button></div>' : '') +
          '<p class="tiny muted" style="margin-top:12px">说明：iPhone 上这是 PWA，不是 App Store 原生应用；Safari 的“添加到主屏幕”只在 HTTPS 或本机地址下支持离线缓存。若要做成原生 App，需要再用 Swift / ArkTS 包一层 WebView。</p>' +
        '</section>' +
        '<section class="settings-section">' +
          '<h2>关于这本手册</h2>' +
          '<div class="about-block"><strong>它是什么：</strong>一个单机优先的讲解员工作台。目录按“单元 → 文物 → 简介 / 讲解故事”组织，内容可随时增删改；AI 只负责按统一格式起草，最终解释权在你。</div>' +
          '<div class="about-block"><strong>示例内容：</strong>13 件文物为讲解练习草稿，依据国博官网公开资料整理，但年代、尺寸、出土地和叙事解释仍应以展厅说明牌与最新研究为准。</div>' +
          '<div class="about-block"><strong>图片版权：</strong>示例图片来自中国国家博物馆官网，版权归原权利人所有，仅用于个人学习与讲解准备，请勿商用或公开再分发。</div>' +
          '<div class="about-block"><strong>技术：</strong>原生 HTML / CSS / JavaScript，无框架、无账号、无云端。数据保存在 IndexedDB，支持导出 JSON。版本 0.8.0 · 可行性原型。</div>' +
        '</section>' +
      '</div>' +
    '</main>';
  }

  /* ---------------- modal shell ---------------- */
  function openModal(type, payload) {
    state.ui.modal = type;
    if (type === 'editor') state.ui.editor = payload;
    if (type === 'galleries') state.ui.manager = payload || { editing: null, form: null };
    if (type === 'ai') state.ui.ai = payload;
    if (type === 'card-menu') state.ui.cardMenu = payload;
    renderModal();
    document.body.classList.add('modal-open');
  }
  function closeModal() {
    state.ui.modal = null;
    state.ui.editor = null;
    state.ui.ai = null;
    state.ui.manager = null;
    state.ui.cardMenu = null;
    renderModal();
    document.body.classList.remove('modal-open');
  }
  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!state.ui.modal) {
      root.innerHTML = '';
      document.body.classList.remove('modal-open');
      return;
    }
    let html = '';
    if (state.ui.modal === 'editor') html = editorModal();
    else if (state.ui.modal === 'galleries') html = galleriesModal();
    else if (state.ui.modal === 'ai') html = aiModal();
    else if (state.ui.modal === 'card-menu') html = cardMenuModal();
    root.innerHTML = html;
    document.body.classList.add('modal-open');
  }

  /* ---------------- editor ---------------- */
  function newArtifactBase(gid) {
    return {
      id: '', galleryId: gid || (state.data.galleries[0] && state.data.galleries[0].id),
      name: '', alias: '', era: '', date: '', material: '', category: '',
      size: '', weight: '', unearthed: '', museum: '中国国家博物馆', image: '', imageCredit: '',
      summary: '', story: '', facts: [], script: { opening: '', body: '', highlight: '', closing: '' },
      tags: [], duration: 3, colorCode: '', notes: '', sources: []
    };
  }
  function openEditor(id, galleryId) {
    if (id) {
      const a = findArtifact(id);
      if (!a) return;
      openModal('editor', { mode: 'edit', picker: false, query: '', scope: 'all', pickerList: [], artifact: clone(a) });
      return;
    }
    const gid = galleryId || (state.ui.route.name === 'gallery' ? state.ui.route.id : '');
    openModal('editor', {
      mode: 'new',
      picker: true,
      query: '',
      scope: state.data.galleries.some((g) => g.id === gid) ? gid : 'all',
      pickerList: [],
      artifact: newArtifactBase(gid)
    });
  }
  function catalogMatches(scope, query) {
    const q = String(query || '').trim().toLowerCase();
    let list = catalogItems().filter((item) => scope === 'all' || item.g === scope);
    if (q) {
      list = list.filter((item) => {
        const hay = [item.n, item.a, item.e, item.m, item.u, item.d, catalogUnitName(item.g)].filter(Boolean).join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      list = list.slice().sort((x, y) => {
        const sx = String(x.n).toLowerCase().indexOf(q);
        const sy = String(y.n).toLowerCase().indexOf(q);
        return (sx < 0 ? 999 : sx) - (sy < 0 ? 999 : sy);
      });
    }
    return list;
  }
  function catalogRowHTML(item, index) {
    const src = safeUrl(item.img);
    const meta = [item.e, inferMaterial(item), catalogUnitName(item.g)].filter(Boolean).join(' · ');
    const note = [item.u, item.d].filter(Boolean).join(' · ');
    const ready = !!contentForCatalog(item);
    return '<button type="button" class="catalog-row" data-action="pick-catalog-item" data-index="' + index + '">' +
      '<span class="catalog-thumb">' + (src ? '<img src="' + esc(src) + '" alt="" loading="lazy">' : '<span class="no-img">' + esc(firstChar(item.n)) + '</span>') + '</span>' +
      '<span class="catalog-main">' +
        '<span class="catalog-name">' + esc(item.n) + '</span>' +
        (meta ? '<span class="catalog-meta">' + esc(meta) + '</span>' : '') +
        (note ? '<span class="catalog-note">' + esc(note) + '</span>' : '') +
      '</span>' +
      '<span class="catalog-side">' + (ready ? '<span class="catalog-ready">已备稿</span>' : '') + '<span class="catalog-add">选择</span></span>' +
    '</button>';
  }
  function catalogListHTML(list) {
    if (!list.length) return '<div class="catalog-empty">没有找到。换个关键字，或直接手动填写。</div>';
    return list.map(catalogRowHTML).join('');
  }
  function renderPickerList() {
    const e = state.ui.editor;
    if (!e) return;
    e.pickerList = catalogMatches(e.scope, e.query);
    const list = document.getElementById('catalog-list');
    if (list) list.innerHTML = catalogListHTML(e.pickerList);
    const count = document.getElementById('catalog-count');
    if (count) count.textContent = e.pickerList.length + ' 件';
  }
  function catalogPickerModal() {
    const e = state.ui.editor;
    e.pickerList = catalogMatches(e.scope, e.query);
    const scopes = [{ id: 'all', name: '全部' }].concat(state.data.galleries.map((g) => ({ id: g.id, name: g.name })));
    return '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal wide picker-modal" role="dialog" aria-modal="true" aria-labelledby="picker-title">' +
      '<div class="modal-head"><div><p class="kicker">添加文物</p><h2 id="picker-title">从名录里选一件</h2><p>共 ' + catalogItems().length + ' 件「古代中国」展品；选中后自动填表。</p></div><button class="icon-btn close" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="picker-search-wrap">' +
        '<div class="catalog-search">' + icon('search') + '<input id="catalog-search" type="search" value="' + esc(e.query) + '" placeholder="搜名称、又名、年代、出土地……" autocomplete="off"></div>' +
        '<div class="scope-row">' + scopes.map((s) => '<button type="button" class="chip chip-btn ' + (e.scope === s.id ? 'active' : '') + '" data-action="catalog-scope" data-scope="' + esc(s.id) + '">' + esc(s.name) + '</button>').join('') + '</div>' +
      '</div>' +
      '<div class="catalog-count" id="catalog-count">' + e.pickerList.length + ' 件</div>' +
      '<div class="catalog-list" id="catalog-list">' + catalogListHTML(e.pickerList) + '</div>' +
      '<div class="modal-foot"><span class="tiny muted">图片来自国博官网，仅限个人学习。</span><div class="right"><button class="btn btn-ghost btn-sm" type="button" data-action="manual-fill">手动填写</button><button class="btn btn-quiet btn-sm" type="button" data-action="close-modal">取消</button></div></div>' +
    '</div></div>';
  }
  function artifactFromCatalog(item, gid) {
    const base = newArtifactBase(gid);
    const content = contentForCatalog(item) || {};
    return Object.assign(base, {
      galleryId: state.data.galleries.some((g) => g.id === item.g) ? item.g : base.galleryId,
      name: item.n,
      alias: item.a || '',
      era: content.era || item.e || '',
      material: content.material || inferMaterial(item),
      category: content.category || inferCategory(item),
      size: content.size || item.d || '',
      weight: content.weight || item.w || '',
      unearthed: content.unearthed || item.u || '',
      summary: content.summary || '',
      story: (window.STORY_OVERRIDES && window.STORY_OVERRIDES[item.n]) || content.story || '',
      duration: content.duration || 3,
      image: item.img || '',
      imageCredit: item.img ? '中国国家博物馆官网' : ''
    });
  }
  function editorModal() {
    const e = state.ui.editor;
    if (e.mode === 'new' && e.picker) return catalogPickerModal();
    return artifactFormModal();
  }
  function artifactFormModal() {
    const e = state.ui.editor;
    const a = e.artifact;
    const isNew = e.mode === 'new';
    return '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="editor-title">' +
      '<div class="modal-head"><div><p class="kicker">' + (isNew ? '新增文物' : '编辑文物') + '</p><h2 id="editor-title">' + (isNew ? esc(a.name || '手动填写') : esc(a.name || '编辑文物')) + '</h2><p>内容会保存在本机。带 * 的是必填。</p>' + (isNew ? '<button class="text-btn" type="button" data-action="back-to-picker" style="margin-top:6px">← 返回名录</button>' : '') + '</div><button class="icon-btn close" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<form id="artifact-form" class="modal-form">' +
        '<div class="modal-body">' +
          '<div class="form-section">' +
            '<h3>基本信息 <span>BASIC</span></h3>' +
            '<div class="field-row">' +
              '<div class="field"><label for="f-name">名称 *</label><input id="f-name" name="name" class="input" value="' + esc(a.name) + '" placeholder="例如：青瓷莲花尊" autocomplete="off" required></div>' +
              '<div class="field"><label for="f-alias">又名 / 别名</label><input id="f-alias" name="alias" class="input" value="' + esc(a.alias) + '" placeholder="司母戊鼎、后母戊鼎……"></div>' +
            '</div>' +
            '<div class="field-row">' +
              '<div class="field"><label for="f-gallery">所属单元 *</label><select id="f-gallery" name="galleryId" class="select">' + state.data.galleries.map((g) => '<option value="' + esc(g.id) + '" ' + (g.id === a.galleryId ? 'selected' : '') + '>' + esc(g.name) + '</option>').join('') + '</select></div>' +
              '<div class="field"><label for="f-era">年代</label><input id="f-era" name="era" class="input" value="' + esc(a.era) + '" placeholder="商后期 / 约公元前14—前11世纪"></div>' +
            '</div>' +
            '<div class="field-row tight">' +
              '<div class="field"><label for="f-category">类别</label><input id="f-category" name="category" class="input" value="' + esc(a.category) + '" placeholder="青铜器 / 陶器 / 玉器……"></div>' +
              '<div class="field"><label for="f-material">材质</label><input id="f-material" name="material" class="input" value="' + esc(a.material) + '" placeholder="青铜、青瓷、夹砂红陶……"></div>' +
            '</div>' +
            '<div class="field-row tight">' +
              '<div class="field"><label for="f-size">尺寸</label><input id="f-size" name="size" class="input" value="' + esc(a.size) + '" placeholder="高 47 厘米，口径 32.7 厘米"></div>' +
              '<div class="field"><label for="f-weight">重量</label><input id="f-weight" name="weight" class="input" value="' + esc(a.weight) + '" placeholder="832.84 千克"></div>' +
            '</div>' +
            '<div class="field"><label for="f-unearthed">出土 / 来源</label><input id="f-unearthed" name="unearthed" class="input" value="' + esc(a.unearthed) + '" placeholder="1978 年河南临汝阎村"></div>' +
          '</div>' +
          '<div class="form-section">' +
            '<details class="image-fold">' +
              '<summary>配图 <span>' + (safeUrl(a.image) ? '已配图' : '可选') + '</span></summary>' +
              '<div class="image-editor" style="margin-top:12px">' +
                '<div class="image-preview" id="image-preview">' + (safeUrl(a.image) ? '<img src="' + esc(safeUrl(a.image)) + '" alt="配图预览">' : '<div class="empty">还没有配图</div>') + '</div>' +
                '<div class="image-fields">' +
                  '<input type="file" id="image-file" accept="image/*" class="hidden">' +
                  '<input id="f-image" name="image" class="input mono" value="' + esc(a.image) + '" placeholder="粘贴图片 URL，或本地上传" style="font-size:11px">' +
                  '<div class="image-buttons">' +
                    '<button class="btn btn-sm btn-ghost" type="button" data-action="pick-image">' + icon('upload') + '上传本地图片</button>' +
                    '<button class="btn btn-sm btn-quiet" type="button" data-action="clear-image">清除</button>' +
                  '</div>' +
                  '<div class="field" style="margin-top:10px"><label for="f-credit">图片来源</label><input id="f-credit" name="imageCredit" class="input" value="' + esc(a.imageCredit) + '" placeholder="中国国家博物馆官网 / 本人拍摄"></div>' +
                  '<p class="editor-help">上传的图片会自动压缩后存在本机。官网图片有版权，建议只用于个人讲解准备。</p>' +
                '</div>' +
              '</div>' +
            '</details>' +
          '</div>' +
          (isNew ? '<div class="form-section">' +
            '<h3>AI 起草 <span>OPTIONAL</span></h3>' +
            '<div class="field"><label for="f-ai-instruction">给 AI 的补充提示（可选）</label><textarea id="f-ai-instruction" name="aiInstruction" class="textarea" rows="3" placeholder="例如：观众是小学生；重点讲铸造工艺；不要用‘首先、其次’。"></textarea><span class="hint">只用于这次 AI 起草；AI 会自动补齐空着的年代、材质、尺寸、重量等，未知会写“未知”。保存后可在 AI 面板里修改。</span></div>' +
          '</div>' : '') +
          '<div class="form-section">' +
            '<h3>内容 <span>CONTENT</span></h3>' +
            '<div class="field"><label for="f-summary">一句话简介</label><textarea id="f-summary" name="summary" class="textarea" rows="3" maxlength="220" placeholder="40–70 字：它是什么，为什么值得停下来看。">' + esc(a.summary) + '</textarea></div>' +
            '<div class="field"><label for="f-story">讲解故事</label><textarea id="f-story" name="story" class="textarea" rows="10" placeholder="直接写一段可以照着讲的生动叙述；不要写“你可以”“注意看”这类提示。">' + esc(storyText(a)) + '</textarea><div class="counter" data-counter-for="f-story"></div></div>' +
            (!isNew ? '<div class="field"><label for="f-duration">讲解时长（分钟）</label><input id="f-duration" name="duration" type="number" min="1" max="30" class="input" value="' + esc(a.duration || 3) + '"></div>' : '') +
          '</div>' +
          (!isNew ? '<div class="form-section">' +
            '<h3>笔记 <span>NOTES</span></h3>' +
            '<div class="field"><label for="f-notes">我的笔记</label><textarea id="f-notes" name="notes" class="textarea" rows="4" placeholder="现场观察、观众反应、下次要补的点……">' + esc(a.notes) + '</textarea></div>' +
          '</div>' : '') +
        '</div>' +
        '<div class="modal-foot">' +
          (isNew ? '<span></span>' : '<button class="btn btn-quiet btn-sm" type="button" data-action="delete-artifact" data-id="' + esc(a.id) + '">' + icon('trash') + '删除</button>') +
          '<div class="right"><button class="btn btn-ghost btn-sm" type="button" data-action="close-modal">取消</button>' +
            (isNew ? '<button class="btn btn-ghost btn-sm" type="button" data-action="save-with-ai">' + icon('sparkle') + '保存并去 AI 起草</button>' : '') +
            '<button class="btn btn-primary btn-sm" type="submit">保存</button></div>' +
        '</div>' +
      '</form>' +
    '</div></div>';
  }
  function cardMenuModal() {
    const menu = state.ui.cardMenu;
    const a = menu && findArtifact(menu.artifactId);
    if (!a) return '';
    return '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal card-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="card-menu-title">' +
      '<div class="modal-head"><div><p class="kicker">文物操作</p><h2 id="card-menu-title">' + esc(a.name) + '</h2><p>' + esc(galleryName(a.galleryId)) + ' · ' + esc(a.era || '年代未填') + '</p></div><button class="icon-btn close" type="button" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="modal-body card-menu-body">' +
        '<button type="button" class="card-menu-item" data-action="edit-artifact" data-id="' + esc(a.id) + '">' + icon('edit') + '<span>编辑这件文物</span></button>' +
        '<button type="button" class="card-menu-item danger" data-action="delete-card" data-id="' + esc(a.id) + '">' + icon('trash') + '<span>删除</span><small>3 秒内可撤销</small></button>' +
        '<button type="button" class="card-menu-item quiet" data-action="close-modal">取消</button>' +
      '</div>' +
    '</div></div>';
  }
  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('没有选择文件')); return; }
      if (!/^image\//.test(file.type)) { reject(new Error('请选择图片文件')); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1400;
          let w = img.width, h = img.height;
          if (w > max || h > max) {
            const ratio = Math.min(max / w, max / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }
  function updateImagePreview(src) {
    const box = document.getElementById('image-preview');
    if (!box) return;
    box.innerHTML = src ? '<img src="' + esc(src) + '" alt="配图预览">' : '<div class="empty">还没有配图</div>';
  }

  /* ---------------- gallery manager ---------------- */
  function openGalleries() {
    openModal('galleries', { editing: null, form: null });
  }
  function galleriesModal() {
    const m = state.ui.manager;
    const rows = state.data.galleries.map((g, i) => {
      const count = galleryArtifacts(g.id).length;
      return '<div class="manager-row">' +
        '<span class="manager-swatch" style="background:' + colorSafe(g.color) + '"></span>' +
        '<span class="manager-info"><strong>' + esc(g.name) + '</strong><span>' + esc(g.period || '未填年代') + ' · ' + count + ' 件</span></span>' +
        '<span class="manager-tools">' +
          '<button type="button" data-action="gallery-move" data-id="' + esc(g.id) + '" data-dir="-1" aria-label="上移" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
          '<button type="button" data-action="gallery-move" data-id="' + esc(g.id) + '" data-dir="1" aria-label="下移" ' + (i === state.data.galleries.length - 1 ? 'disabled' : '') + '>↓</button>' +
          '<button type="button" data-action="gallery-edit" data-id="' + esc(g.id) + '" aria-label="编辑">' + icon('edit') + '</button>' +
          '<button type="button" data-action="gallery-delete" data-id="' + esc(g.id) + '" aria-label="删除">' + icon('trash') + '</button>' +
        '</span>' +
      '</div>';
    }).join('');
    let form = '';
    if (m.form) {
      const f = m.form;
      form = '<form id="gallery-form" style="margin-top:14px;padding-top:16px;border-top:1px solid var(--line)">' +
        '<div class="field"><label for="g-name">单元名称 *</label><input id="g-name" name="name" class="input" value="' + esc(f.name || '') + '" placeholder="例如：专题：丝绸之路" required></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="g-period">年代范围</label><input id="g-period" name="period" class="input" value="' + esc(f.period || '') + '" placeholder="例如：前 2 世纪—14 世纪"></div>' +
          '<div class="field"><label for="g-color">标识色</label><input id="g-color" name="color" type="color" class="input" value="' + colorSafe(f.color) + '" style="padding:5px;height:42px"></div>' +
        '</div>' +
        '<div class="field"><label for="g-desc">一句话说明</label><textarea id="g-desc" name="description" class="textarea" rows="2" placeholder="这个单元讲什么？">' + esc(f.description || '') + '</textarea></div>' +
        '<div class="form-actions"><button class="btn btn-primary btn-sm" type="submit">保存单元</button><button class="btn btn-ghost btn-sm" type="button" data-action="gallery-cancel">取消</button></div>' +
      '</form>';
    }
    return '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal narrow" role="dialog" aria-modal="true" aria-labelledby="galleries-title">' +
      '<div class="modal-head"><div><p class="kicker">目录</p><h2 id="galleries-title">管理单元</h2><p>第一层目录可以随时增加，比如专题展、临展，或你自己的讲解路线。</p></div><button class="icon-btn close" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' +
        '<div class="manager-list">' + rows + '</div>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="gallery-new">' + icon('plus') + '新增单元</button>' +
        form +
        '<p class="tiny muted" style="margin-top:14px;line-height:1.7">删除单元前，需要先清空或移走它下面的文物。排序会同步到首页时间线。</p>' +
      '</div>' +
    '</div></div>';
  }

  /* ---------------- AI ---------------- */
  function openAI(id, opts) {
    const a = findArtifact(id);
    if (!a) return;
    const options = opts || {};
    openModal('ai', {
      artifactId: id,
      mode: options.mode || 'full',
      instruction: options.instruction || '',
      loading: false,
      result: null,
      error: '',
      raw: ''
    });
  }
  function aiModal() {
    const ai = state.ui.ai;
    const a = findArtifact(ai.artifactId);
    if (!a) return '';
    const s = state.data.settings;
    const hasKey = !!s.apiKey;
    const isProxy = s.apiBase.charAt(0) === '/';
    let body = '';
    if (ai.loading) {
      body = '<div class="ai-loading"><span class="spinner"></span><span>正在按统一格式起草……通常需要 10–30 秒。</span></div>';
    } else if (ai.result) {
      const r = ai.result;
      const archive = [['era', '年代'], ['material', '材质'], ['category', '类别'], ['size', '尺寸'], ['weight', '重量'], ['unearthed', '出土/来源']]
        .map(([key, label]) => label + '：' + esc(r[key] || '未知')).join('<br>');
      body = '<div class="ai-result">' +
        (ai.error ? '<div class="error-box">' + esc(ai.error) + '</div>' : '') +
        '<div class="ai-preview-block"><h4>一句话简介</h4><p>' + esc(r.summary || '') + '</p></div>' +
        '<div class="ai-preview-block"><h4>讲解故事</h4><p>' + nl2br(r.story || '') + '</p></div>' +
        '<div class="ai-preview-block"><h4>补齐档案</h4><p>' + archive + '</p></div>' +
      '</div>';
    } else {
      body = '<div class="ai-intro"><span class="glyph">✦</span><span>AI 只负责起草。它会遵守同一套格式，但史实、措辞和现场感需要你把关。生成后可以先预览，再决定要不要覆盖。</span></div>' +
        (!hasKey && !isProxy ? '<div class="error-box" style="margin-bottom:14px">还没有填写 API Key。可以先去设置里填，或使用下面的“离线搭框架 / 粘贴 JSON”。</div>' : '') +
        '<form id="ai-form">' +
          '<div class="field"><label for="ai-mode">生成方式</label><select id="ai-mode" name="mode" class="select">' +
            '<option value="full" ' + (ai.mode === 'full' ? 'selected' : '') + '>完整起草：简介 + 讲解故事</option>' +
            '<option value="summary" ' + (ai.mode === 'summary' ? 'selected' : '') + '>只重写一句话简介</option>' +
            '<option value="story" ' + (ai.mode === 'story' ? 'selected' : '') + '>保留简介，只重写讲解故事</option>' +
          '</select></div>' +
          '<div class="field"><label for="ai-instruction">给 AI 的补充（可选）</label><textarea id="ai-instruction" name="instruction" class="textarea" rows="3" placeholder="例如：观众是小学生；控制在 2 分钟；重点讲铸造过程；不要用“首先、其次”。">' + esc(ai.instruction || '') + '</textarea></div>' +
          '<button class="btn btn-primary btn-block" type="submit">' + icon('sparkle') + '生成草稿</button>' +
        '</form>' +
        '<div class="ai-fallback"><details><summary>没有 API？复制提示词，粘贴到任意 AI</summary>' +
          '<p class="tiny muted" style="margin:8px 0">提示词会带上这件文物的现有内容和你的补充要求。把 AI 返回的 JSON 粘回下面即可预览。</p>' +
          '<div class="form-actions"><button class="btn btn-sm btn-ghost" type="button" data-action="copy-prompt">' + icon('copy') + '复制完整提示词</button><button class="btn btn-sm btn-quiet" type="button" data-action="offline-draft">离线搭框架（非 AI）</button></div>' +
          '<textarea id="ai-paste" class="textarea" placeholder="把 AI 返回的 JSON 粘贴到这里……"></textarea>' +
          '<div class="form-actions"><button class="btn btn-sm btn-ghost" type="button" data-action="parse-ai">解析并预览</button></div>' +
        '</details></div>';
    }
    return '<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="ai-title">' +
      '<div class="modal-head"><div><p class="kicker">AI 起草</p><h2 id="ai-title">' + esc(a.name) + '</h2><p>统一格式，先预览，再应用。不会自动覆盖你没确认的内容。</p></div><button class="icon-btn close" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' + body + '<div id="ai-error">' + (ai.error && !ai.result ? '<div class="error-box" style="margin-top:12px">' + esc(ai.error) + '</div>' : '') + '</div></div>' +
      '<div class="modal-foot">' +
        '<span class="tiny muted">' + (hasKey ? 'Key 已配置' : (isProxy ? '本地代理模式' : '未配置 Key')) + '</span>' +
        '<div class="right">' +
          (ai.result ? '<button class="btn btn-ghost btn-sm" type="button" data-action="ai-back">返回修改</button><button class="btn btn-primary btn-sm" type="button" data-action="apply-ai">应用到这件文物</button>' : '<button class="btn btn-quiet btn-sm" type="button" data-action="go-settings">AI 设置</button>') +
        '</div>' +
      '</div>' +
    '</div></div>';
  }
  function buildPrompt(a, mode, instruction) {
    const modeText = mode === 'summary' ? '只重写“一句话简介”，保留现有讲解故事。'
      : mode === 'story' ? '保留现有“一句话简介”，只重写讲解故事。'
      : '完整起草：一句话简介和一段讲解故事。';
    const system = [
      '你是中国国家博物馆“古代中国”基本陈列的资深讲解员，负责把文物资料写成可以直接照着讲的生动故事。',
      '必须遵守：',
      '1. 只输出一个 JSON 对象，不要 Markdown 代码块，不要任何解释文字。',
      '2. story 是直接讲给观众听的一段叙述，不是讲解技巧或教学提示。不要出现“先别急着看”“你可以”“注意看”“带大家”“我们来看”“接下来”“我讲的时候”这类提示、动作或教学口吻；不要用括号写舞台提示（例如“（指向器腹）”）。直接讲文物本身、历史现场和小故事。',
      '3. story 保持 500–800 字，分 3–5 段，句子短、口语化；不要小标题，不要“开场 / 主体 / 细节 / 收束”这类结构词。',
      '4. summary 40–70 字，直接说它是什么、为什么值得停下来看。',
      '5. 补齐 era、material、category、size、weight、unearthed；已有资料优先，不覆盖；没有把握就写“未知”，不要编造精确数字。',
      '6. 史实不确定时用“一般认为 / 有学者认为”，不要把推测写成定论。',
      '输出 JSON 字段：summary, story, era, material, category, size, weight, unearthed。'
    ].join('\n');
    const existing = [
      '名称：' + a.name,
      '又名：' + (a.alias || '无'),
      '单元：' + galleryName(a.galleryId),
      '年代：' + (a.era || a.date || '未填'),
      '材质：' + (a.material || '未填'),
      '类别：' + (a.category || '未填'),
      '尺寸：' + (a.size || '未填'),
      '重量：' + (a.weight || '未填'),
      '出土/来源：' + (a.unearthed || '未填'),
      '馆藏/场馆：' + (a.museum || '中国国家博物馆'),
      '现有简介：' + (a.summary || '无'),
      '现有讲解故事：' + (storyText(a) || '无'),
      '讲解员补充：' + (instruction || '无')
    ].join('\n');
    const user = '【任务】\n' + modeText + '\n\n【文物资料】\n' + existing + '\n\n【输出】\n严格返回 JSON，不要代码块。只返回 summary, story, era, material, category, size, weight, unearthed。';
    return { system, user };
  }
  function parseAIJSON(raw) {
    let text = String(raw || '').trim();
    if (!text) throw new Error('AI 返回为空。');
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('没有找到 JSON 对象。');
    let obj;
    try {
      obj = JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      throw new Error('JSON 解析失败：' + e.message);
    }
    if (typeof obj !== 'object' || obj === null) throw new Error('AI 返回的不是对象。');
    const asString = (v) => typeof v === 'string' ? v : '';
    const script = obj.script && typeof obj.script === 'object' ? obj.script : {};
    const story = asString(obj.story) || asString(obj.text) ||
      [script.opening, script.body, script.highlight, script.closing].filter(Boolean).join('\n\n');
    const result = {
      summary: asString(obj.summary),
      story,
      era: asString(obj.era),
      material: asString(obj.material),
      category: asString(obj.category),
      size: asString(obj.size),
      weight: asString(obj.weight),
      unearthed: asString(obj.unearthed)
    };
    if (!result.summary && !result.story) throw new Error('返回内容里没有 summary 或 story，无法应用。');
    return result;
  }
  async function chatCompletion(messages, maxTokens) {
    const s = state.data.settings;
    if (!s.apiBase) throw new Error('还没有设置接口地址。');
    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers.Authorization = 'Bearer ' + s.apiKey;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    let res;
    const isDeepSeek = /deepseek\.com/i.test(s.apiBase) || s.apiBase.charAt(0) === '/';
    const body = {
      model: s.model || 'deepseek-flash',
      messages,
      temperature: 0.65,
      max_tokens: maxTokens || 1800
    };
    if (isDeepSeek) {
      body.thinking = { type: s.thinking ? 'enabled' : 'disabled' };
      body.response_format = { type: 'json_object' };
      if (s.thinking) body.max_tokens = Math.max(body.max_tokens, 4000);
    }
    try {
      res = await fetch(s.apiBase, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('请求超时（90 秒）。可以重试，或把模型换成更快的。');
      throw new Error('网络请求失败：' + e.message + '。如果直接调用 DeepSeek 被浏览器拦截，请用本地 server.mjs 的 /api/ai 代理。');
    }
    clearTimeout(timer);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* keep text */ }
    if (!res.ok) {
      const msg = json && json.error && (json.error.message || json.error) ? (json.error.message || json.error) : text.slice(0, 300);
      throw new Error('接口返回 ' + res.status + '：' + msg);
    }
    if (!json) throw new Error('接口返回的不是 JSON：' + text.slice(0, 200));
    if (json.error) throw new Error(json.error.message || String(json.error));
    const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!content) throw new Error('接口没有返回 choices[0].message.content。');
    return content;
  }
  async function generateAI() {
    const ai = state.ui.ai;
    if (!ai) return;
    const a = findArtifact(ai.artifactId);
    if (!a) return;
    ai.loading = true;
    ai.error = '';
    renderModal();
    try {
      const p = buildPrompt(a, ai.mode, ai.instruction);
      const content = await chatCompletion([
        { role: 'system', content: p.system },
        { role: 'user', content: p.user }
      ], 3000);
      ai.result = parseAIJSON(content);
      ai.raw = content;
      ai.loading = false;
      renderModal();
      toast('草稿已生成，先预览再应用。');
    } catch (e) {
      ai.loading = false;
      ai.error = e.message || String(e);
      renderModal();
    }
  }
  function applyAI() {
    const ai = state.ui.ai;
    if (!ai || !ai.result) return;
    const a = findArtifact(ai.artifactId);
    if (!a) return;
    const r = ai.result;
    if (ai.mode !== 'story' && r.summary) a.summary = r.summary;
    if (ai.mode !== 'summary' && r.story) a.story = r.story;
    const archiveFields = ['era', 'material', 'category', 'size', 'weight', 'unearthed'];
    const missing = (v) => !String(v || '').trim() || /^[（(]?待核对[）)]?$/.test(String(v || '').trim());
    const unknown = (v) => {
      const s = String(v || '').trim();
      return !s || /^[（(]?待核对[）)]?$/.test(s) ? '未知' : s;
    };
    archiveFields.forEach((key) => {
      if (missing(a[key])) a[key] = unknown(r[key]);
    });
    a.updatedAt = nowISO();
    scheduleSave();
    closeModal();
    renderApp();
    toast('已应用。记得改成自己的话，并标注待核对的信息。');
  }
  function offlineDraft() {
    const ai = state.ui.ai;
    if (!ai) return;
    const a = findArtifact(ai.artifactId);
    if (!a) return;
    const summary = a.summary || (a.name + '，' + (a.era || '年代待补') + '。先用一句话说清它为什么重要：____。');
    const story = a.name + '，' + (a.era || '年代待补') + '。它最打动人的地方，是____。\n\n' +
      '它的用途是____，工艺上____，背后是____。\n\n' +
      '器身上有一个细节：____。这个细节说明____。\n\n' +
      '这件器物让人看到____。';
    state.ui.ai.result = { summary, story };
    state.ui.ai.error = '';
    renderModal();
    toast('已搭好框架。填上横线里的内容，就是你的讲解故事。');
  }
  async function copyPrompt() {
    const ai = state.ui.ai;
    if (!ai) return;
    const a = findArtifact(ai.artifactId);
    if (!a) return;
    const modeEl = document.getElementById('ai-mode');
    const insEl = document.getElementById('ai-instruction');
    const mode = modeEl ? modeEl.value : ai.mode;
    const instruction = insEl ? insEl.value : ai.instruction;
    const p = buildPrompt(a, mode, instruction);
    await copyText('===== SYSTEM =====\n' + p.system + '\n\n===== USER =====\n' + p.user, '提示词已复制。粘贴到任意 AI，再把 JSON 带回来。');
  }

  /* ---------------- reader ---------------- */
  function openReader(id) {
    const a = findArtifact(id);
    if (!a) return;
    closeModal();
    const beats = storyBeats(a);
    state.ui.reader = {
      artifactId: id,
      index: 0,
      size: 26,
      startedAt: Date.now(),
      beats
    };
    document.body.classList.add('reader-open');
    renderReader();
    startReaderTimer();
    requestWakeLock();
  }
  function renderReader() {
    const r = state.ui.reader;
    const old = document.getElementById('reader-root');
    if (old) old.remove();
    if (!r) return;
    const a = findArtifact(r.artifactId);
    if (!a) { closeReader(); return; }
    const beat = r.beats[r.index];
    const total = r.beats.length;
    const text = esc(beat.text || '').replace(/（([^）]{1,50})）/g, '<span class="cue">（$1）</span>');
    const root = document.createElement('div');
    root.id = 'reader-root';
    root.innerHTML = '<div class="reader" role="dialog" aria-modal="true" aria-label="讲解模式">' +
      '<div class="reader-head">' +
        '<button class="icon-btn" data-action="close-reader" aria-label="退出讲解模式">' + icon('close') + '</button>' +
        '<div class="reader-title"><strong>' + esc(a.name) + '</strong><span>' + esc(galleryName(a.galleryId)) + ' · ' + esc(a.era) + '</span></div>' +
        '<span class="reader-timer" id="reader-timer">00:00</span>' +
        '<button class="icon-btn" data-action="reader-font" data-delta="-1" aria-label="缩小字号" style="font-size:13px">A−</button>' +
        '<button class="icon-btn" data-action="reader-font" data-delta="1" aria-label="放大字号" style="font-size:16px">A+</button>' +
      '</div>' +
      '<div class="reader-body">' +
        '<p class="reader-eyebrow">' + esc(beat.label) + ' · ' + String(r.index + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0') + '</p>' +
        '<p class="reader-text" style="--reader-size:' + r.size + 'px">' + text + '</p>' +
      '</div>' +
      '<div class="reader-foot">' +
        '<div class="reader-nav"><button data-action="reader-prev" ' + (r.index === 0 ? 'disabled' : '') + '>上一步</button></div>' +
        '<span class="progress">' + (r.index + 1) + ' / ' + total + ' · 约 ' + (a.duration || 3) + ' 分钟</span>' +
        '<div class="reader-nav">' +
          (r.index < total - 1 ? '<button class="primary" data-action="reader-next">下一步</button>' : '<button class="primary" data-action="close-reader">完成</button>') +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(root);
    updateReaderTimer();
  }
  function startReaderTimer() {
    clearInterval(readerTimer);
    readerTimer = setInterval(updateReaderTimer, 1000);
  }
  function updateReaderTimer() {
    const el = document.getElementById('reader-timer');
    const r = state.ui.reader;
    if (!el || !r) return;
    const sec = Math.max(0, Math.floor((Date.now() - r.startedAt) / 1000));
    el.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }
  function closeReader(silent) {
    if (readerTimer) { clearInterval(readerTimer); readerTimer = null; }
    if (wakeLock && wakeLock.release) { try { wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
    state.ui.reader = null;
    const root = document.getElementById('reader-root');
    if (root) root.remove();
    document.body.classList.remove('reader-open');
    if (!silent) renderApp();
  }
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && navigator.wakeLock.request) {
        wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* not critical */ }
  }

  /* ---------------- actions ---------------- */
  function toast(message, options) {
    const el = document.getElementById('toast');
    if (!el) return;
    const opts = options || {};
    el.textContent = '';
    const text = document.createElement('span');
    text.textContent = message;
    el.appendChild(text);
    el.classList.toggle('has-action', !!(opts.label && typeof opts.onClick === 'function'));
    if (opts.label && typeof opts.onClick === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = opts.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideToast();
        opts.onClick();
      });
      el.appendChild(btn);
    }
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || 3000);
  }
  function hideToast() {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    toastTimer = null;
    el.classList.remove('show', 'has-action');
  }
  async function copyText(text, message) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      toast(message || '已复制');
    } catch (e) {
      toast('复制失败，请长按选择文本。');
    }
  }
  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }
  function exportData() {
    const stamp = new Date().toISOString().slice(0, 10);
    const backup = clone(state.data);
    if (backup.settings) backup.settings.apiKey = '';
    download('国博讲解手册-' + stamp + '.json', JSON.stringify(backup, null, 2));
    toast('已导出备份（不含 API Key）。建议放到云盘或发给自己。');
  }
  function importDataFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const normalized = normalizeData(parsed);
        // 备份不应携带 Key；即使是旧备份里带来的，也不自动启用。
        if (normalized.settings) normalized.settings.apiKey = '';
        if (!confirm('导入会替换当前全部数据（' + state.data.artifacts.length + ' 件文物），确定继续吗？')) return;
        state.data = normalized;
        scheduleSave();
        closeModal();
        onRoute();
        toast('已导入 ' + normalized.artifacts.length + ' 件文物。');
      } catch (e) {
        alert('导入失败：' + e.message);
      }
    };
    reader.onerror = () => alert('文件读取失败。');
    reader.readAsText(file, 'utf-8');
  }
  function resetData() {
    if (!confirm('会清空当前所有修改，恢复 13 件示例文物。确定吗？')) return;
    state.data = normalizeData(freshSeed());
    scheduleSave();
    onRoute();
    toast('已恢复示例数据。');
  }
  async function testAI() {
    const form = document.getElementById('settings-form');
    if (form) {
      const s = state.data.settings;
      s.apiBase = form.apiBase.value.trim() || defaultApiBase();
      s.apiKey = form.apiKey.value.trim();
      s.model = form.model.value.trim() || 'deepseek-flash';
      if (form.thinking) s.thinking = form.thinking.checked;
      scheduleSave();
    }
    toast('正在测试连接……');
    try {
      const content = await chatCompletion([{ role: 'user', content: '只返回一个 json 对象：{"ok":true}' }], 30);
      toast('连接成功：' + content.slice(0, 40));
    } catch (e) {
      toast('连接失败：' + (e.message || e).slice(0, 80));
    }
  }
  function installApp() {
    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') toast('已添加到桌面。');
        deferredInstall = null;
      });
    } else {
      toast('请用浏览器菜单里的“添加到桌面 / 安装应用”。');
    }
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.getAttribute('data-action');
      if (action === 'set-theme') {
        e.preventDefault();
        const theme = applyTheme(el.getAttribute('data-theme'), true);
        document.querySelectorAll('.theme-swatch').forEach((s) => {
          const on = s.getAttribute('data-theme') === theme;
          s.classList.toggle('active', on);
          s.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const found = THEMES.find((t) => t.id === theme);
        toast('底色：' + (found ? found.name : theme));
        return;
      }
      if (action === 'toggle-sort') {
        e.preventDefault();
        const next = !state.ui.sortMode;
        state.ui.sortMode = next;
        renderApp();
        toast(next ? '排序模式：点 ↑↓ 调整顺序。' : '排序完成，已保存。');
        return;
      }
      if (action === 'move-up' || action === 'move-down') {
        e.preventDefault();
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        if (id) moveArtifact(id, action === 'move-up' ? -1 : 1);
        return;
      }
      if (action === 'card-menu') {
        e.preventDefault();
        e.stopPropagation();
        const id = el.getAttribute('data-id');
        if (id) openModal('card-menu', { artifactId: id });
        return;
      }
      if (action === 'delete-card') {
        e.preventDefault();
        e.stopPropagation();
        deleteArtifact(el.getAttribute('data-id'));
        return;
      }
      if (action === 'open-artifact') {
        if (state.ui.sortMode) return;
        if (Date.now() - lastDragAt < 250) return;
        const id = el.getAttribute('data-id');
        if (!id) return;
        if (isSplitView()) {
          const a = findArtifact(id);
          if (a) navigate('#/g/' + encodeURIComponent(a.galleryId) + '/a/' + encodeURIComponent(a.id));
          return;
        }
        navigate('#/a/' + encodeURIComponent(id));
        return;
      }
      if (action === 'close-split') {
        e.preventDefault();
        const r = state.ui.route;
        if (r.name === 'gallery') navigate('#/g/' + encodeURIComponent(r.id));
        return;
      }
      if (action === 'cycle-color') {
        e.preventDefault();
        e.stopPropagation();
        const a = findArtifact(el.getAttribute('data-id'));
        if (!a) return;
        const next = { '': 'green', green: 'yellow', yellow: 'red', red: '' }[a.colorCode || ''];
        a.colorCode = next;
        scheduleSave();
        renderApp();
        toast('颜色：' + colorLabel(next));
        return;
      }
      if (action === 'pick-catalog-item') {
        e.preventDefault();
        const ed = state.ui.editor;
        if (!ed) return;
        const item = (ed.pickerList || [])[Number(el.getAttribute('data-index'))];
        if (!item) return;
        ed.artifact = artifactFromCatalog(item, ed.scope);
        ed.picker = false;
        ed.query = '';
        renderModal();
        return;
      }
      if (action === 'catalog-scope') {
        e.preventDefault();
        if (!state.ui.editor) return;
        state.ui.editor.scope = el.getAttribute('data-scope') || 'all';
        state.ui.editor.query = '';
        renderModal();
        return;
      }
      if (action === 'manual-fill') {
        e.preventDefault();
        if (!state.ui.editor) return;
        const scope = state.ui.editor.scope;
        state.ui.editor.artifact = newArtifactBase(scope === 'all' ? '' : scope);
        state.ui.editor.picker = false;
        state.ui.editor.query = '';
        renderModal();
        return;
      }
      if (action === 'back-to-picker') {
        e.preventDefault();
        if (!state.ui.editor) return;
        state.ui.editor.picker = true;
        renderModal();
        return;
      }
      if (action === 'save-with-ai') {
        e.preventDefault();
        const form = document.getElementById('artifact-form');
        if (!form || !state.ui.editor) return;
        state.ui.editor.autoAI = true;
        saveArtifactForm(form);
        return;
      }
      if (action === 'modal-backdrop') {
        if (e.target === el) closeModal();
        return;
      }
      if (action === 'go-back') { e.preventDefault(); goBack(); return; }
      if (action === 'focus-search') {
        e.preventDefault();
        if (state.ui.route.name !== 'home') navigate('#/');
        setTimeout(() => {
          const input = document.getElementById('home-search');
          if (input) { input.focus(); input.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        }, 80);
        return;
      }
      if (action === 'go-settings') { e.preventDefault(); closeModal(); navigate('#/settings'); return; }
      if (action === 'close-modal') { e.preventDefault(); closeModal(); return; }
      if (action === 'manage-galleries') { e.preventDefault(); closeModal(); openGalleries(); return; }
      if (action === 'add-artifact') { e.preventDefault(); openEditor(null, el.getAttribute('data-gallery') || undefined); return; }
      if (action === 'edit-artifact') { e.preventDefault(); openEditor(el.getAttribute('data-id')); return; }
      if (action === 'open-ai') { e.preventDefault(); openAI(el.getAttribute('data-id')); return; }
      if (action === 'open-reader') { e.preventDefault(); openReader(el.getAttribute('data-id')); return; }
      if (action === 'official-image') {
        e.preventDefault();
        const a = findArtifact(el.getAttribute('data-id'));
        if (a) window.open('https://www.bing.com/images/search?q=' + encodeURIComponent('site:chnmuseum.cn ' + a.name), '_blank', 'noopener');
        return;
      }
      if (action === 'copy-script') {
        const a = findArtifact(el.getAttribute('data-id'));
        if (a) copyText('【一句话简介】\n' + (a.summary || '') + '\n\n【讲解故事】\n' + storyText(a), '讲解内容已复制，可以发到手机或打印。');
        return;
      }
      if (action === 'review-filter') {
        e.preventDefault();
        state.ui.review.galleryId = el.getAttribute('data-gallery') || 'all';
        state.ui.review.artifactId = null;
        state.ui.review.revealed = false;
        initReview(true);
        renderApp();
        return;
      }
      if (action === 'review-reveal') {
        state.ui.review.revealed = true;
        state.ui.review.count += 1;
        renderApp();
        return;
      }
      if (action === 'review-next') {
        const pool = reviewPool();
        if (pool.length > 1) {
          let next;
          do { next = pool[Math.floor(Math.random() * pool.length)]; } while (next.id === state.ui.review.artifactId);
          state.ui.review.artifactId = next.id;
        }
        state.ui.review.revealed = false;
        renderApp();
        return;
      }
      if (action === 'review-again') {
        state.ui.review.revealed = false;
        renderApp();
        return;
      }
      if (action === 'pick-image') {
        const input = document.getElementById('image-file');
        if (input) input.click();
        return;
      }
      if (action === 'clear-image') {
        const url = document.getElementById('f-image');
        if (url) url.value = '';
        updateImagePreview('');
        return;
      }
      if (action === 'delete-artifact') {
        e.preventDefault();
        deleteArtifact(el.getAttribute('data-id'));
        return;
      }
      if (action === 'gallery-new') {
        state.ui.manager = { editing: 'new', form: { name: '', period: '', description: '', color: '#8a6a4f' } };
        renderModal();
        return;
      }
      if (action === 'gallery-edit') {
        const g = findGallery(el.getAttribute('data-id'));
        if (!g) return;
        state.ui.manager = { editing: g.id, form: clone(g) };
        renderModal();
        return;
      }
      if (action === 'gallery-cancel') {
        state.ui.manager = { editing: null, form: null };
        renderModal();
        return;
      }
      if (action === 'gallery-delete') {
        const g = findGallery(el.getAttribute('data-id'));
        if (!g) return;
        const count = galleryArtifacts(g.id).length;
        if (count) { alert('“' + g.name + '”下还有 ' + count + ' 件文物。请先删除或移到其他单元。'); return; }
        if (!confirm('删除单元“' + g.name + '”？')) return;
        state.data.galleries = state.data.galleries.filter((x) => x.id !== g.id);
        state.ui.manager = { editing: null, form: null };
        scheduleSave();
        renderModal();
        if (state.ui.route.name === 'gallery' && state.ui.route.id === g.id) {
          navigate('#/');
        } else {
          renderApp();
        }
        toast('单元已删除。');
        return;
      }
      if (action === 'gallery-move') {
        const id = el.getAttribute('data-id');
        const dir = Number(el.getAttribute('data-dir'));
        const arr = state.data.galleries;
        const idx = arr.findIndex((g) => g.id === id);
        const j = idx + dir;
        if (idx >= 0 && j >= 0 && j < arr.length) {
          const t = arr[idx]; arr[idx] = arr[j]; arr[j] = t;
          scheduleSave();
          renderModal();
          renderApp();
        }
        return;
      }
      if (action === 'export-data') { exportData(); return; }
      if (action === 'import-data') {
        const input = document.getElementById('import-file');
        if (input) input.click();
        return;
      }
      if (action === 'reset-data') { resetData(); return; }
      if (action === 'use-deepseek') {
        e.preventDefault();
        const baseInput = document.getElementById('apiBase');
        const modelInput = document.getElementById('model');
        if (baseInput) baseInput.value = 'https://api.deepseek.com/chat/completions';
        if (modelInput) modelInput.value = 'deepseek-flash';
        toast('已填入 DeepSeek 官方接口，点“保存设置”生效。');
        return;
      }
      if (action === 'test-ai') { e.preventDefault(); testAI(); return; }
      if (action === 'toggle-key') {
        const input = document.getElementById('apiKey');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
        return;
      }
      if (action === 'install') { installApp(); return; }
      if (action === 'reader-prev') {
        if (state.ui.reader && state.ui.reader.index > 0) {
          state.ui.reader.index -= 1;
          renderReader();
        }
        return;
      }
      if (action === 'reader-next') {
        if (state.ui.reader && state.ui.reader.index < state.ui.reader.beats.length - 1) {
          state.ui.reader.index += 1;
          renderReader();
        }
        return;
      }
      if (action === 'reader-font') {
        if (!state.ui.reader) return;
        const delta = Number(el.getAttribute('data-delta')) || 0;
        const idx = READER_SIZES.indexOf(state.ui.reader.size);
        state.ui.reader.size = READER_SIZES[clamp(idx + delta, 0, READER_SIZES.length - 1)];
        renderReader();
        return;
      }
      if (action === 'close-reader') { closeReader(); return; }
      if (action === 'copy-prompt') { copyPrompt(); return; }
      if (action === 'offline-draft') { offlineDraft(); return; }
      if (action === 'parse-ai') {
        const ta = document.getElementById('ai-paste');
        if (!ta || !ta.value.trim()) { toast('先把 AI 返回的 JSON 粘贴进来。'); return; }
        try {
          state.ui.ai.result = parseAIJSON(ta.value);
          state.ui.ai.error = '';
          renderModal();
          toast('解析成功，先预览再应用。');
        } catch (err) {
          state.ui.ai.error = err.message;
          renderModal();
        }
        return;
      }
      if (action === 'apply-ai') { applyAI(); return; }
      if (action === 'ai-back') {
        state.ui.ai.result = null;
        state.ui.ai.error = '';
        renderModal();
        return;
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id === 'artifact-form') {
        e.preventDefault();
        saveArtifactForm(e.target);
      } else if (e.target.id === 'gallery-form') {
        e.preventDefault();
        saveGalleryForm(e.target);
      } else if (e.target.id === 'settings-form') {
        e.preventDefault();
        const fd = new FormData(e.target);
        state.data.settings = {
          apiBase: String(fd.get('apiBase') || '').trim() || defaultApiBase(),
          apiKey: String(fd.get('apiKey') || '').trim(),
          model: String(fd.get('model') || '').trim() || 'deepseek-flash',
          thinking: fd.get('thinking') === 'on'
        };
        scheduleSave();
        toast('设置已保存。');
        renderApp();
      } else if (e.target.id === 'ai-form') {
        e.preventDefault();
        const fd = new FormData(e.target);
        state.ui.ai.mode = String(fd.get('mode') || 'full');
        state.ui.ai.instruction = String(fd.get('instruction') || '');
        state.ui.ai.result = null;
        state.ui.ai.error = '';
        generateAI();
      }
    });

    document.addEventListener('input', (e) => {
      if (e.target.id === 'catalog-search' && state.ui.editor && state.ui.editor.picker) {
        state.ui.editor.query = e.target.value;
        renderPickerList();
      }
      if (e.target.id === 'home-search') {
        const q = e.target.value.trim();
        state.ui.query = q;
        const results = document.getElementById('search-results');
        const timeline = document.getElementById('timeline');
        if (results) {
          results.innerHTML = q ? searchResultsHTML(q) : '';
          results.classList.toggle('hidden', !q);
        }
        if (timeline) timeline.classList.toggle('hidden', !!q);
      }
      if (e.target.id === 'f-image') {
        updateImagePreview(e.target.value.trim());
      }
      if (e.target.matches('textarea[data-counter-for], textarea#f-story')) {
        const id = e.target.id;
        const counter = document.querySelector('[data-counter-for="' + id + '"]');
        if (counter) counter.textContent = e.target.value.length + ' 字';
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'image-file') {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        readImageFile(file).then((dataUrl) => {
          const urlInput = document.getElementById('f-image');
          if (urlInput) urlInput.value = dataUrl;
          updateImagePreview(dataUrl);
          toast('图片已压缩，保存后写入本机。');
        }).catch((err) => toast(err.message));
        e.target.value = '';
      }
      if (e.target.id === 'import-file') {
        importDataFile(e.target.files && e.target.files[0]);
        e.target.value = '';
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('artifact-row')) {
        e.preventDefault();
        if (state.ui.sortMode) return;
        const id = e.target.getAttribute('data-id');
        if (!id) return;
        if (isSplitView()) {
          const a = findArtifact(id);
          if (a) navigate('#/g/' + encodeURIComponent(a.galleryId) + '/a/' + encodeURIComponent(a.id));
        } else {
          navigate('#/a/' + encodeURIComponent(id));
        }
        return;
      }
      if (e.key === 'Enter' && e.target.id === 'catalog-search' && state.ui.editor && state.ui.editor.picker) {
        const first = document.querySelector('.catalog-row');
        if (first) { e.preventDefault(); first.click(); return; }
      }
      if (e.key === 'Escape') {
        if (state.ui.reader) { closeReader(); return; }
        if (state.ui.modal) { closeModal(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (state.ui.route.name !== 'home') navigate('#/');
        setTimeout(() => { const input = document.getElementById('home-search'); if (input) input.focus(); }, 80);
      }
      if (state.ui.reader) {
        if (e.key === 'ArrowRight') {
          if (state.ui.reader.index < state.ui.reader.beats.length - 1) { state.ui.reader.index += 1; renderReader(); }
        }
        if (e.key === 'ArrowLeft') {
          if (state.ui.reader.index > 0) { state.ui.reader.index -= 1; renderReader(); }
        }
      }
    });

    document.addEventListener('contextmenu', (e) => {
      const row = e.target.closest && e.target.closest('.artifact-row');
      if (row) e.preventDefault();
    });
    document.addEventListener('selectstart', (e) => {
      const row = e.target.closest && e.target.closest('.artifact-row');
      if (row) e.preventDefault();
    });

    document.addEventListener('dragstart', (e) => {
      if (state.ui.sortMode || !window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); return; }
      const row = e.target.closest && e.target.closest('.artifact-row');
      if (!row || state.ui.route.name !== 'gallery') return;
      dragId = row.getAttribute('data-id');
      lastDragAt = Date.now();
      row.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
      }
    });
    document.addEventListener('dragover', (e) => {
      if (!dragId) return;
      const row = e.target.closest && e.target.closest('.artifact-row');
      if (!row) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.artifact-row.drag-over').forEach((el) => el.classList.remove('drag-over', 'after'));
      const id = row.getAttribute('data-id');
      if (id === dragId) { dropTarget = null; return; }
      const rect = row.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      row.classList.add('drag-over');
      if (after) row.classList.add('after');
      dropTarget = { id, after };
    });
    document.addEventListener('dragleave', (e) => {
      const row = e.target.closest && e.target.closest('.artifact-row');
      if (row && !row.contains(e.relatedTarget)) row.classList.remove('drag-over', 'after');
    });
    document.addEventListener('drop', (e) => {
      if (!dragId) return;
      e.preventDefault();
      const target = dropTarget;
      const moved = target ? reorderArtifact(dragId, target.id, target.after) : false;
      cleanupDrag();
      if (moved) renderApp();
    });
    document.addEventListener('dragend', () => { cleanupDrag(); });

    const splitMedia = window.matchMedia('(min-width: 760px)');
    if (splitMedia.addEventListener) {
      splitMedia.addEventListener('change', () => {
        const r = state.ui.route;
        if (splitMedia.matches && r.name === 'artifact') {
          const a = findArtifact(r.id);
          if (a) { replaceRoute('#/g/' + encodeURIComponent(a.galleryId) + '/a/' + encodeURIComponent(a.id)); return; }
        }
        if (!splitMedia.matches && r.name === 'gallery' && r.selectedId) {
          replaceRoute('#/a/' + encodeURIComponent(r.selectedId));
          return;
        }
        renderApp();
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
    });
    window.addEventListener('appinstalled', () => toast('已安装到桌面。'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
    window.addEventListener('pagehide', saveNow);
  }

  function saveArtifactForm(form) {
    const fd = new FormData(form);
    const e = state.ui.editor;
    if (!e) return;
    const autoAI = !!e.autoAI;
    e.autoAI = false;
    const name = String(fd.get('name') || '').trim();
    if (!name) { toast('先给文物起个名字。'); return; }
    const galleryId = String(fd.get('galleryId') || '');
    if (!findGallery(galleryId)) { toast('请选择一个有效的单元。'); return; }
    const aiInstruction = String(fd.get('aiInstruction') || '').trim();
    const base = e.artifact;
    const artifact = {
      ...base,
      id: base.id || uid('a-'),
      galleryId,
      name,
      alias: String(fd.get('alias') || '').trim(),
      era: String(fd.get('era') || '').trim(),
      date: '',
      material: String(fd.get('material') || '').trim(),
      category: String(fd.get('category') || '').trim(),
      size: String(fd.get('size') || '').trim(),
      weight: String(fd.get('weight') || '').trim(),
      unearthed: String(fd.get('unearthed') || '').trim(),
      museum: base.museum || '中国国家博物馆',
      image: String(fd.get('image') || '').trim(),
      imageCredit: String(fd.get('imageCredit') || '').trim(),
      summary: String(fd.get('summary') || '').trim(),
      story: String(fd.get('story') || '').trim(),
      duration: clamp(Number(fd.get('duration')) || Number(base.duration) || 3, 1, 30),
      notes: String(fd.get('notes') != null ? fd.get('notes') : (base.notes || '')).trim(),
      createdAt: base.createdAt || nowISO(),
      updatedAt: nowISO()
    };
    delete artifact.status;
    const idx = state.data.artifacts.findIndex((a) => a.id === artifact.id);
    if (idx >= 0) state.data.artifacts[idx] = artifact;
    else state.data.artifacts.push(artifact);
    scheduleSave();
    closeModal();
    if (e.mode === 'new') {
      navigate('#/a/' + encodeURIComponent(artifact.id));
      if (autoAI) {
        setTimeout(() => {
          openAI(artifact.id, { instruction: aiInstruction });
          toast('已保存。确认或补一句提示，再点“生成草稿”。');
        }, 420);
      } else {
        setTimeout(() => toast('已保存。点“AI 起草”，可以按统一格式生成简介和讲解故事。'), 260);
      }
    } else {
      renderApp();
      toast('已保存。');
    }
  }
  function saveGalleryForm(form) {
    const m = state.ui.manager;
    if (!m) return;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { toast('单元名称不能为空。'); return; }
    const data = {
      name,
      period: String(fd.get('period') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      color: colorSafe(String(fd.get('color') || '#8a6a4f'))
    };
    if (m.editing === 'new') {
      state.data.galleries.push({ id: uid('g-'), ...data });
    } else {
      const g = findGallery(m.editing);
      if (!g) return;
      Object.assign(g, data);
    }
    state.ui.manager = { editing: null, form: null };
    scheduleSave();
    renderModal();
    renderApp();
    toast('单元已保存。');
  }

  /* ---------------- init ---------------- */
  function showBoot() {
    document.getElementById('app').innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;color:var(--muted);font-size:13px"><div style="text-align:center"><div style="width:44px;height:44px;margin:0 auto 14px;border-radius:8px;background:var(--cinnabar);color:#fff8ea;display:grid;place-items:center;font-family:var(--serif);font-size:24px">国</div>正在打开手册……</div></div>';
  }
  async function init() {
    applyTheme(currentTheme(), false);
    showBoot();
    let loaded = null;
    try { loaded = await loadStored(); } catch (e) { loaded = null; }
    if (loaded) {
      try { state.data = normalizeData(loaded); } catch (e) { state.data = normalizeData(freshSeed()); }
    } else {
      state.data = normalizeData(freshSeed());
    }
    if (!state.data.settings) state.data.settings = defaultSettings();
    bindEvents();
    window.addEventListener('hashchange', onRoute);
    onRoute();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !window.__STANDALONE__) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
