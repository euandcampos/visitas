import { subscribe, newVisit as createNewVisit, switchActiveVisit as setActiveVisit, refreshLists as reloadLists, deleteVisit as removeVisit } from './state.js';
import { clearAll as clearOfflineDb } from './offlineQueue.js';

let menuWrapper;
let menuTrigger;
let menuItems;
let historyView;
let sendView;
let formView;
let historyList;
let sendList;

let handlers = {};

function toggleMenu(open) {
  if (!menuItems) return;
  const isOpen = open !== undefined ? open : !menuItems.classList.contains('show');
  menuItems.classList.toggle('show', isOpen);
}

function showView(view) {
  [historyView, sendView, formView].forEach((el) => {
    if (!el) return;
    el.classList.toggle('active', el === view);
  });
  if (view !== formView) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR');
}

function renderHistory(state) {
  if (!historyList) return;
  historyList.innerHTML = '';
  const combined = [...(state.history || []), ...(state.sendable || [])];
  // remover duplicados por id
  const map = new Map();
  combined.forEach((v) => map.set(v.id, v));
  const list = Array.from(map.values());
  if (!list || list.length === 0) {
    historyList.innerHTML = '<p class="help">Nenhuma visita rascunho encontrada.</p>';
    return;
  }
  list.forEach((visit) => {
    const card = document.createElement('div');
    card.className = 'visit-card';
    const section1 = visit.sections?.section1 || {};
    const motoboy = section1.sender || 'Não informado';
    const cliente = section1.clientName || 'Cliente não informado';
    const cpf = section1.cpf || 'CPF não informado';
    const updatedDate = formatDate(visit.updatedAt);
    
    card.innerHTML = `
      <div class="visit-card__header">
        <div class="visit-card__thumb-placeholder" data-thumb="${visit.id}">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div>
          <div class="visit-card__title">${cliente}</div>
          <div class="visit-card__meta">
            <span><strong>CPF:</strong> ${cpf}</span>
            <span>Visita criada por ${motoboy}</span>
            <span>Última atualização: ${updatedDate}</span>
            <div class="visit-card__meta-row">
              <span class="badge ${visit.status === 'salva' ? 'saved' : 'draft'}">${visit.status === 'salva' ? 'Pronta para enviar' : 'Rascunho'}</span>
            </div>
          </div>
        </div>
        <button class="icon-delete" data-action="delete" data-id="${visit.id}" title="Excluir visita">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="visit-card__actions">
        <button class="primary" data-action="resume" data-id="${visit.id}">Continuar</button>
      </div>
    `;
    historyList.appendChild(card);
  });

  // Lazy carregar foto do cliente (fotoCliente) com debounce
  let loadTimeout;
  const loadPhotos = () => {
    clearTimeout(loadTimeout);
    loadTimeout = setTimeout(async () => {
      console.log('[menu] Iniciando carregamento de fotos...');
      for (const visit of list) {
        try {
          if (!window.navigator.onLine) continue;
          console.log('[menu] Carregando foto para visita:', visit.id);
          const mod = await import('./apiClient.js');
          const detail = await mod.getVisit(visit.id);
          const files = detail.files || {};
          
          // Buscar especificamente a foto do cliente
          let url = '';
          if (files.fotoCliente && Array.isArray(files.fotoCliente) && files.fotoCliente.length > 0) {
            const first = files.fotoCliente[0];
            // Usar downloadUrl se disponível, senão gerar URL
            url = first?.downloadUrl || mod.getFileDownloadUrl(visit.id, 'fotoCliente', first.id);
            console.log('[menu] URL gerada:', url);
          }
          
          const placeholder = historyList.querySelector(`[data-thumb="${visit.id}"]`);
          if (placeholder && url) {
            console.log('[menu] Substituindo placeholder por imagem para visita:', visit.id);
            
            // Usar fetch + blob em vez de URL direta para suportar autenticação
            fetch(url, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('visitas_api_token') || 'defina_um_token_seguro'}`
              }
            })
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
              }
              return response.blob();
            })
            .then(blob => {
              const img = document.createElement('img');
              img.src = URL.createObjectURL(blob);
              img.alt = 'Foto do cliente';
              img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border-radius: 8px;';
              
              img.onload = () => {
                console.log('[menu] Imagem carregada com sucesso para visita:', visit.id);
                // Substituir placeholder por imagem
                placeholder.innerHTML = '';
                placeholder.appendChild(img);
              };
              
              img.onerror = () => {
                console.log('[menu] Erro ao carregar imagem para visita:', visit.id);
                placeholder.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
              };
            })
            .catch(error => {
              console.log('[menu] Erro no fetch para visita:', visit.id, error);
              placeholder.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
            });
          } else {
            console.log('[menu] Placeholder não encontrado ou URL vazia para visita:', visit.id, 'placeholder:', !!placeholder, 'url:', url);
          }
        } catch (error) {
          console.error('[menu] Erro ao carregar foto para visita:', visit.id, error);
        }
      }
    }, 100); // Debounce de 100ms
  };
  
  loadPhotos();
}

function renderSendable(state) {
  if (!sendList) return;
  sendList.innerHTML = '';
  if (!state.sendable || state.sendable.length === 0) {
    sendList.innerHTML = '<p class="help">Nenhuma visita pronta para envio.</p>';
    return;
  }
  state.sendable.forEach((visit) => {
    const card = document.createElement('div');
    card.className = 'visit-card';
    const section1 = visit.sections?.section1 || {};
    const motoboy = section1.sender || 'Motoboy não informado';
    const cliente = section1.clientName || 'Cliente não informado';
    const date = formatDate(visit.createdAt);
    card.innerHTML = `
      <div class="visit-card__header">
        <div>
          <div class="visit-card__title">${cliente}</div>
          <div class="visit-card__meta">
            <span>Motoboy: ${motoboy}</span>
            <span>ID: ${visit.id.slice(0, 8)} · ${date}</span>
            <span>Salva em: ${formatDate(visit.updatedAt)}</span>
          </div>
        </div>
        <button class="icon-delete" data-action="delete" data-id="${visit.id}" title="Excluir visita">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="visit-card__actions">
        <button class="primary" data-action="send" data-id="${visit.id}">Enviar agora</button>
      </div>
    `;
    sendList.appendChild(card);
  });
}

async function handleMenuAction(action) {
  switch (action) {
    case 'new-visit':
      if (confirm('Iniciar uma nova visita? Os dados da visita atual permanecem salvos.')) {
        await createNewVisit();
        showView(formView);
      }
      break;
    case 'history':
      showView(historyView);
      await reloadLists();
      break;
    case 'send':
      showView(sendView);
      await reloadLists();
      break;
    case 'refresh':
      try {
        await handlers.processQueue?.();
      } catch (_) {}
      try {
        // limpar IndexedDB (fila/visitas/arquivos)
        await clearOfflineDb();
      } catch (_) {}
      try {
        // manter token, limpar demais chaves
        const keepToken = localStorage.getItem('visitas_api_token');
        localStorage.clear();
        if (keepToken) localStorage.setItem('visitas_api_token', keepToken);
      } catch (_) {}
      try {
        // remover todos os caches do SW
        if (window.caches && caches.keys) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
      try {
        // desregistrar service workers
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch (_) {}
      // recarregar para pegar a última versão
      window.location.reload();
      break;
    default:
      break;
  }
  toggleMenu(false);
}

function onHistoryClick(event) {
  const button = event.target.closest('button[data-action="resume"]');
  if (!button) return;
  const visitId = button.getAttribute('data-id');
  if (!visitId) return;
  setActiveVisit(visitId)
    .then(() => {
      showView(formView);
      toggleMenu(false);
    })
    .catch((error) => {
      alert(error.message || 'Não foi possível abrir a visita selecionada.');
    });
}

function onDeleteClick(event) {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;
  const visitId = button.getAttribute('data-id');
  if (!visitId) return;
  console.log('[menu] tentando deletar visita:', visitId);
  if (!confirm('Deseja excluir esta visita? Essa ação não pode ser desfeita.')) {
    console.log('[menu] exclusão cancelada pelo usuário');
    return;
  }
  console.log('[menu] confirmação OK, chamando deleteVisit...');
  // Feedback visual imediato
  button.disabled = true;
  button.textContent = '...';
  
  handlers.deleteVisit(visitId)
    .then(() => {
      console.log('[menu] deleteVisit sucesso, recarregando listas...');
      return reloadLists();
    })
    .then(() => {
      console.log('[menu] listas recarregadas com sucesso');
      // Remover o card visualmente
      const card = button.closest('.visit-card');
      if (card) {
        card.style.opacity = '0.5';
        card.style.transition = 'opacity 0.3s';
        setTimeout(() => card.remove(), 300);
      }
    })
    .catch((error) => {
      console.error('[menu] erro ao excluir visita:', error);
      alert('❌ Erro ao excluir: ' + (error.message || 'Tente novamente'));
      button.disabled = false;
      button.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    });
}

function onSendClick(event) {
  const button = event.target.closest('button[data-action="send"]');
  if (!button) return;
  const visitId = button.getAttribute('data-id');
  if (!visitId) return;
  if (!handlers.submitVisit) {
    alert('Função de envio ainda não disponível.');
    return;
  }
  handlers
    .submitVisit(visitId)
    .then((result) => {
      if (result?.queued) {
        alert('Sem conexão. O envio será tentado automaticamente quando estiver online.');
      } else {
        alert('Visita enviada com sucesso!');
      }
    })
    .catch((error) => {
      console.error('[menu] erro ao enviar visita', error);
      alert(error.message || 'Erro ao enviar visita. A ação será reprocessada quando possível.');
    });
}

export function initMenu({ newVisit, switchActiveVisit, refreshLists, processQueue, submitVisit, deleteVisit }) {
  handlers = { newVisit, switchActiveVisit, refreshLists, processQueue, submitVisit, deleteVisit };

  menuWrapper = document.getElementById('menu-wrapper');
  menuTrigger = document.getElementById('menu-main');
  menuItems = document.getElementById('menu-items');
  historyView = document.getElementById('history-view');
  sendView = document.getElementById('send-view');
  formView = document.getElementById('form-view');
  historyList = document.getElementById('history-list');
  sendList = document.getElementById('send-list');

  if (menuTrigger) {
    menuTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleMenu();
    });
  }

  menuWrapper?.querySelectorAll('.menu-orb__item').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      handleMenuAction(button.dataset.action);
    });
  });

  document.addEventListener('click', (event) => {
    if (!menuWrapper?.contains(event.target)) {
      toggleMenu(false);
    }
  });

  historyList?.addEventListener('click', onHistoryClick);
  sendList?.addEventListener('click', onSendClick);
  historyList?.addEventListener('click', onDeleteClick);
  sendList?.addEventListener('click', onDeleteClick);

  subscribe((state) => {
    renderHistory(state);
    renderSendable(state);
  });
}

