import { initState, subscribe, saveSections, addFiles, removeFile, newVisit, switchActiveVisit, refreshLists, getState, processQueue, submitVisit, deleteVisit } from './state.js';
import { initLocationManager } from './location.js';
import { initFormNavigation } from './forms.js';
import { initMenu } from './menu.js';
import { setupUploads } from './uploads.js';
import { initPermissionModal } from './permissions.js';
import { setApiToken } from './apiClient.js';

function showViewById(id) {
  const formView = document.getElementById('form-view');
  const historyView = document.getElementById('history-view');
  const sendView = document.getElementById('send-view');
  const hubView = document.getElementById('hub-view');
  [formView, historyView, sendView, hubView].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el.id === id);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHub(state) {
  const wrap = document.getElementById('hub-active');
  if (!wrap) return;
  wrap.innerHTML = '';
  const visit = state.activeVisit;
  const card = document.createElement('div');
  card.className = 'visit-card';
  if (!visit) {
    card.innerHTML = '<p class="help">Nenhuma visita ativa no momento.</p>';
    wrap.appendChild(card);
    return;
  }
  const section1 = visit.sections?.section1 || {};
  const cliente = section1.clientName || 'Cliente não informado';
  const motoboy = section1.sender || 'Motoboy não informado';
  const date = new Date(visit.updatedAt || visit.createdAt || Date.now()).toLocaleString('pt-BR');
  card.innerHTML = `
    <div class="visit-card__header">
      <div>
        <div class="visit-card__title">${cliente}</div>
        <div class="visit-card__meta">
          <span>ID: ${visit.id.slice(0,8)} · ${date}</span>
          <span>Motoboy: ${motoboy}</span>
          <div class="visit-card__meta-row">
            <span class="badge ${visit.status === 'salva' ? 'saved' : 'draft'}">${visit.status === 'salva' ? 'Pronta para enviar' : 'Rascunho'}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="visit-card__actions">
      <button id="hub-continue" class="primary">Continuar</button>
    </div>
  `;
  wrap.appendChild(card);
  const btn = card.querySelector('#hub-continue');
  btn?.addEventListener('click', () => showViewById('form-view'));
}

async function bootstrap() {
  // Configurar token de API
  const token = localStorage.getItem('visitas_api_token') || 'defina_um_token_seguro';
  setApiToken(token);
  
  await initState();
  initPermissionModal();
  initFormNavigation({ saveSections, removeFile });
  initLocationManager({ saveSections });
  setupUploads({ addFiles, removeFile });
  initMenu({ newVisit, switchActiveVisit, refreshLists, processQueue, submitVisit, deleteVisit });
  initThemeToggle();
  initPWAInstall();

  subscribe((state) => {
    updateSyncIndicator(state);
    updateActiveVisitLabel(state);
    renderHub(state);
  });

  // quando uma visita for marcada como salva, forçar atualização de listas
  window.addEventListener('visita-salva', async () => {
    try {
      const { refreshLists } = await import('./state.js');
      await refreshLists();
    } catch (_) {}
  });
  // hub actions
  const hubNew = document.getElementById('hub-new');
  const hubHistory = document.getElementById('hub-history');
  const hubSend = document.getElementById('hub-send');
  hubNew?.addEventListener('click', async () => { await newVisit(); showViewById('form-view'); });
  hubHistory?.addEventListener('click', async () => { await refreshLists(); showViewById('history-view'); });
  hubSend?.addEventListener('click', async () => { await refreshLists(); showViewById('send-view'); });

  // save draft button
  const saveDraft = document.getElementById('btn-save-draft');
  saveDraft?.addEventListener('click', async () => {
    try {
      const meta = { step: 'draft', lastStepAt: new Date().toISOString() };
      await saveSections({}, { status: 'rascunho', metadata: meta });
      await refreshLists();
      showViewById('history-view');
    } catch (e) {
      alert(e.message || 'Falha ao salvar rascunho');
    }
  });

  // go home button
  const goHome = document.getElementById('go-home');
  goHome?.addEventListener('click', async () => {
    try { await refreshLists(); } catch (_) {}
    showViewById('hub-view');
  });
}

function initThemeToggle() {
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  if (!button) return;
  const moonIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/></svg>`;
  const sunIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5.25a6.75 6.75 0 1 1 0 13.5a6.75 6.75 0 0 1 0-13.5Zm0-3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 12 2.25Zm0 18a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm9-7.5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Zm-18 0a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Zm15.4 6.15a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0Zm-14.78-14.78a.75.75 0 0 1 0-1.06L4.68 3.5a.75.75 0 1 1 1.06 1.06L4.68 5.62a.75.75 0 0 1-1.06 0Zm14.78 0a.75.75 0 0 1 1.06-1.06l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06Zm-14.78 14.78a.75.75 0 1 1 1.06-1.06l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06Z"/></svg>`;

  const saved = localStorage.getItem('visitas_theme') || 'light';
  if (saved === 'dark') {
    root.setAttribute('data-theme', 'dark');
    button.innerHTML = sunIcon;
  } else {
    button.innerHTML = moonIcon;
  }
  
  button.addEventListener('click', () => {
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      root.setAttribute('data-theme', 'dark');
      button.innerHTML = sunIcon;
    } else {
      root.removeAttribute('data-theme');
      button.innerHTML = moonIcon;
    }
    localStorage.setItem('visitas_theme', next);
  });
}

function updateSyncIndicator(state) {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  indicator.classList.remove('status-ok', 'status-syncing', 'status-error');
  if (state.offline) {
    indicator.title = 'Offline';
    indicator.classList.add('status-error');
    return;
  }
  switch (state.syncStatus) {
    case 'syncing':
      indicator.title = 'Sincronizando...';
      indicator.classList.add('status-syncing');
      break;
    case 'error':
      indicator.title = 'Requer atenção';
      indicator.classList.add('status-error');
      break;
    default:
      indicator.title = 'Sincronizado';
      indicator.classList.add('status-ok');
      break;
  }
}

function updateActiveVisitLabel(state) {
  const label = document.getElementById('active-visit-label');
  if (!label) return;
  const visit = state.activeVisit;
  if (!visit) {
    label.textContent = '';
    return;
  }
  const created = new Date(visit.createdAt || Date.now());
  label.textContent = `ID: ${visit.id.slice(0, 8)} • ${created.toLocaleString('pt-BR')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch((error) => {
    console.error('[app] erro na inicialização', error);
    alert(`Falha ao iniciar o aplicativo: ${error.message}`);
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      console.log('[SW] Registrado com sucesso:', registration.scope);
    })
    .catch((error) => {
      console.error('[SW] Falha ao registrar:', error);
    });
}

function initPWAInstall() {
  let deferredPrompt = null;
  const installButton = document.getElementById('install-pwa-btn');
  
  if (!installButton) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.style.display = 'flex';
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`[PWA] Escolha do usuário: ${outcome}`);
    
    if (outcome === 'accepted') {
      installButton.style.display = 'none';
    }
    
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App instalado com sucesso');
    installButton.style.display = 'none';
    deferredPrompt = null;
  });
}

window.__VISITAS_DEBUG_STATE__ = getState;

