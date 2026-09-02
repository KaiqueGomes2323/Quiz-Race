const SETTINGS_CACHE_KEY = 'quizCorrida_settings';
const SETTINGS_COLLECTION = 'userSettings';

const SETTINGS_PALETTES = [
  { id: 'roxo',    label: 'Roxo Elétrico', b1: '#9b6bff', g1: 'rgba(155,107,255,0.45)', b2: '#42e8ff', g2: 'rgba(66,232,255,0.4)',  b3: '#ff5fd8', g3: 'rgba(255,95,216,0.4)' },
  { id: 'verde',   label: 'Verde Turbo',   b1: '#3dffb0', g1: 'rgba(61,255,176,0.45)',  b2: '#42e8ff', g2: 'rgba(66,232,255,0.4)',  b3: '#ffe14d', g3: 'rgba(255,225,77,0.35)' },
  { id: 'laranja', label: 'Laranja Fogo',  b1: '#ff9a47', g1: 'rgba(255,154,71,0.45)',  b2: '#ff5fd8', g2: 'rgba(255,95,216,0.35)', b3: '#ffd23f', g3: 'rgba(255,210,63,0.4)' },
  { id: 'vermelho',label: 'Vermelho Racer',b1: '#ff4d6a', g1: 'rgba(255,77,106,0.45)',  b2: '#7a8cff', g2: 'rgba(122,140,255,0.4)', b3: '#3dffb0', g3: 'rgba(61,255,176,0.3)' },
  { id: 'ciano',   label: 'Ciano Ártico',  b1: '#42e8ff', g1: 'rgba(66,232,255,0.45)',  b2: '#7a8cff', g2: 'rgba(122,140,255,0.4)', b3: '#9dff5c', g3: 'rgba(157,255,92,0.3)' },
  { id: 'rosa',    label: 'Rosa Neon',     b1: '#ff6ec7', g1: 'rgba(255,110,199,0.45)', b2: '#c26bff', g2: 'rgba(194,107,255,0.4)', b3: '#42e8ff', g3: 'rgba(66,232,255,0.3)' },
];

const SETTINGS_TEXT_SIZES = [
  { id: 'sm', label: 'A-', scale: 0.85 },
  { id: 'md', label: 'A',  scale: 1 },
  { id: 'lg', label: 'A+', scale: 1.35 },
];

const DEFAULT_SETTINGS = {
  theme: 'dark',
  paletteId: 'roxo',
  textSizeId: 'md',
};

function settingsGetPalette(id){
  return SETTINGS_PALETTES.find(p => p.id === id) || SETTINGS_PALETTES[0];
}
function settingsGetTextSize(id){
  return SETTINGS_TEXT_SIZES.find(t => t.id === id) || SETTINGS_TEXT_SIZES[1];
}

function settingsReadCache(){
  try{
    const raw = JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY));
    if(!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...raw };
  }catch(e){
    return { ...DEFAULT_SETTINGS };
  }
}

function settingsWriteCache(settings){
  try{
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  }catch(e){ /* localStorage indisponível — ignora */ }
}

function settingsApply(settings){
  const root = document.documentElement;

  if(settings.theme === 'light'){
    root.setAttribute('data-theme', 'light');
  }else{
    root.removeAttribute('data-theme');
  }

  const palette = settingsGetPalette(settings.paletteId);
  root.style.setProperty('--blob-1', palette.b1);
  root.style.setProperty('--blob-1-glow', palette.g1);
  root.style.setProperty('--blob-2', palette.b2);
  root.style.setProperty('--blob-2-glow', palette.g2);
  root.style.setProperty('--blob-3', palette.b3);
  root.style.setProperty('--blob-3-glow', palette.g3);

  const textSize = settingsGetTextSize(settings.textSizeId);
  root.style.setProperty('--text-scale', String(textSize.scale));
}

(function settingsInit(){
  let currentSettings = settingsReadCache();
  settingsApply(currentSettings);

  document.addEventListener('DOMContentLoaded', () => {
    settingsBuildUI(currentSettings);
    settingsSyncWithFirestore((updated) => {
      currentSettings = updated;
      settingsApply(currentSettings);
      settingsReflectUI(currentSettings);
    });
  });

  function settingsSyncWithFirestore(onRemoteUpdate){
    if(typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore){
      return;
    }

    let unsubscribeDoc = null;

    auth.onAuthStateChanged((user) => {
      if(!user){
        auth.signInAnonymously().catch((err) => {
          console.error('Falha ao autenticar anonimamente para salvar configurações:', err);
        });
        return;
      }

      if(unsubscribeDoc) unsubscribeDoc();

      const docRef = dbFirestore.collection(SETTINGS_COLLECTION).doc(user.uid);

      unsubscribeDoc = docRef.onSnapshot((snap) => {
        if(snap.exists){
          const remote = { ...DEFAULT_SETTINGS, ...snap.data() };
          settingsWriteCache(remote);
          onRemoteUpdate(remote);
        }else{
          docRef.set(currentSettings, { merge: true }).catch((err) => {
            console.error('Falha ao criar configurações no Firestore:', err);
          });
        }
      }, (err) => {
        console.error('Falha ao sincronizar configurações com o Firestore:', err);
      });

      window.__settingsSaveToFirestore = (patch) => {
        currentSettings = { ...currentSettings, ...patch };
        settingsWriteCache(currentSettings);
        docRef.set(patch, { merge: true }).catch((err) => {
          console.error('Falha ao salvar configurações no Firestore:', err);
        });
      };
    });
  }

  let panelEls = null;

  function settingsReflectUI(settings){
    if(!panelEls) return;
    panelEls.themeBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.theme === settings.theme);
    });
    panelEls.swatches.forEach(sw => {
      sw.classList.toggle('is-active', sw.dataset.paletteId === settings.paletteId);
    });
    panelEls.sizeBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.sizeId === settings.textSizeId);
    });
  }

  function settingsSaveAndApply(patch, settingsRef){
    Object.assign(settingsRef, patch);
    settingsWriteCache(settingsRef);
    settingsApply(settingsRef);
    settingsReflectUI(settingsRef);
    if(window.__settingsSaveToFirestore){
      window.__settingsSaveToFirestore(patch);
    }
  }

  function settingsBuildUI(initialSettings){
    const settingsRef = { ...initialSettings };

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'settings-fab';
    fab.setAttribute('aria-label', 'Configurações');
    fab.setAttribute('aria-haspopup', 'true');
    fab.innerHTML = '⚙️';

    const panel = document.createElement('div');
    panel.className = 'settings-panel glass';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Configurações de exibição');

    panel.innerHTML = `
      <h3>⚙️ Configurações</h3>
      <div class="settings-section">
        <span class="settings-label">Tema</span>
        <div class="settings-row" data-role="theme-row">
          <button type="button" class="settings-option" data-theme="dark">🌙 Escuro</button>
          <button type="button" class="settings-option" data-theme="light">☀️ Claro</button>
        </div>
      </div>
      <div class="settings-section">
        <span class="settings-label">Cor do fundo</span>
        <div class="settings-row" data-role="palette-row"></div>
      </div>
      <div class="settings-section">
        <span class="settings-label">Tamanho do texto</span>
        <div class="settings-row" data-role="size-row"></div>
      </div>
      <p class="settings-status">Suas preferências ficam salvas neste navegador.</p>
    `;

    const paletteRow = panel.querySelector('[data-role="palette-row"]');
    SETTINGS_PALETTES.forEach(p => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'settings-swatch';
      sw.dataset.paletteId = p.id;
      sw.title = p.label;
      sw.setAttribute('aria-label', p.label);
      sw.style.background = `linear-gradient(135deg, ${p.b1}, ${p.b2} 55%, ${p.b3})`;
      sw.addEventListener('click', () => {
        settingsSaveAndApply({ paletteId: p.id }, settingsRef);
      });
      paletteRow.appendChild(sw);
    });

    const sizeRow = panel.querySelector('[data-role="size-row"]');
    SETTINGS_TEXT_SIZES.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'settings-option';
      btn.dataset.sizeId = t.id;
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        settingsSaveAndApply({ textSizeId: t.id }, settingsRef);
      });
      sizeRow.appendChild(btn);
    });

    const themeBtns = Array.from(panel.querySelectorAll('[data-theme]'));
    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        settingsSaveAndApply({ theme: btn.dataset.theme }, settingsRef);
      });
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    panelEls = {
      themeBtns,
      swatches: Array.from(panel.querySelectorAll('.settings-swatch')),
      sizeBtns: Array.from(panel.querySelectorAll('[data-size-id]')),
    };
    settingsReflectUI(settingsRef);

    function closePanel(){
      panel.classList.remove('is-open');
      fab.setAttribute('aria-expanded', 'false');
    }
    function openPanel(){
      panel.classList.add('is-open');
      fab.setAttribute('aria-expanded', 'true');
    }

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      if(panel.classList.contains('is-open')) closePanel(); else openPanel();
    });
    document.addEventListener('click', (e) => {
      if(!panel.contains(e.target) && e.target !== fab){
        closePanel();
      }
    });
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closePanel();
    });
  }
})();