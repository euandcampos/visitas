import {
  enqueue,
  getQueue,
  removeFromQueue,
  updateQueueRecord,
  getQueueSize,
  storeVisitSnapshot,
  getVisitSnapshot,
  deleteVisitSnapshot,
  saveFileBlob,
  getFileBlob,
  deleteFileBlob,
} from './offlineQueue.js';
import {
  createVisit,
  getVisit,
  listVisits,
  updateVisit,
  uploadFiles,
  deleteFile as apiDeleteFile,
  deleteVisit as apiDeleteVisit,
  getFileDownloadUrl,
  submitVisit as submitVisitRequest,
} from './apiClient.js';

const listeners = new Set();
const randomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const state = {
  activeVisit: null,
  history: [],
  sendable: [],
  syncStatus: 'ok',
  queueSize: 0,
  offline: !navigator.onLine,
};

const SECTION_KEYS = ['section1', 'section2', 'section3', 'section4'];

function cloneVisit(visit) {
  return JSON.parse(JSON.stringify(visit));
}

function removeVisitById(list, id) {
  const index = list.findIndex((visit) => visit.id === id);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

function upsertVisit(list, visit) {
  const index = list.findIndex((item) => item.id === visit.id);
  const copy = cloneVisit(visit);
  if (index === -1) {
    list.push(copy);
  } else {
    list[index] = copy;
  }
}

function syncLocalListsWithActive() {
  if (!state.activeVisit) return;
  removeVisitById(state.history, state.activeVisit.id);
  removeVisitById(state.sendable, state.activeVisit.id);
  if (state.activeVisit.status === 'salva') {
    upsertVisit(state.sendable, state.activeVisit);
  } else {
    upsertVisit(state.history, state.activeVisit);
  }
  notify({ history: state.history, sendable: state.sendable });
}

function notify(change = {}) {
  listeners.forEach((listener) => {
    try {
      listener(state, change);
    } catch (error) {
      console.error('[state] listener error', error);
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state, { initial: true });
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

function ensureActiveVisitStructure(visit) {
  visit.sections = visit.sections || {};
  SECTION_KEYS.forEach((key) => {
    if (!visit.sections[key]) {
      visit.sections[key] = {};
    }
  });
  visit.files = visit.files || {};
  visit.metadata = visit.metadata || {};
  return visit;
}

function prepareFilesFromServer(visit) {
  const files = {};
  const original = visit.files || {};
  Object.keys(original).forEach((field) => {
    files[field] = original[field].map((file) => ({
      localId: file.id,
      serverId: file.id,
      name: file.originalName,
      size: file.size,
      type: file.mimeType,
      uploadedAt: file.uploadedAt,
      downloadUrl: file.downloadUrl || getFileDownloadUrl(visit.id, field, file.id),
      pending: false,
      previewUrl: null,
    }));
  });
  visit.files = files;
  return visit;
}

async function persistSnapshot() {
  if (state.activeVisit) {
    await storeVisitSnapshot(state.activeVisit);
  }
}

async function refreshQueueSize() {
  state.queueSize = await getQueueSize();
  notify({ queueSize: state.queueSize });
}

function setSyncStatus(status) {
  if (state.syncStatus !== status) {
    state.syncStatus = status;
    notify({ syncStatus: status });
  }
}

function setOffline(value) {
  if (state.offline !== value) {
    state.offline = value;
    notify({ offline: value });
  }
}

function persistActiveVisitId(id) {
  if (id) {
    localStorage.setItem('activeVisitId', id);
  } else {
    localStorage.removeItem('activeVisitId');
  }
}

async function loadVisitFromBackend(id) {
  const visit = await getVisit(id);
  ensureActiveVisitStructure(visit);
  prepareFilesFromServer(visit);
  return visit;
}

async function createNewVisitOnline() {
  const visit = await createVisit({ status: 'rascunho' });
  ensureActiveVisitStructure(visit);
  prepareFilesFromServer(visit);
  return visit;
}

async function initActiveVisit() {
  const storedId = localStorage.getItem('activeVisitId');
  if (storedId && navigator.onLine) {
    try {
      const visit = await loadVisitFromBackend(storedId);
      state.activeVisit = visit;
      await persistSnapshot();
      await regeneratePendingPreviews();
      return;
    } catch (error) {
      console.warn('[state] falha ao carregar visita do servidor, tentando snapshot', error);
    }
  }

  if (storedId) {
    const snapshot = await getVisitSnapshot(storedId);
    if (snapshot) {
      state.activeVisit = ensureActiveVisitStructure(snapshot);
      await regeneratePendingPreviews();
      return;
    }
  }

  // NÃO criar visita automaticamente - deixar o usuário decidir quando criar
  state.activeVisit = null;
  persistActiveVisitId(null);
}

async function loadLists() {
  if (!navigator.onLine) {
    return;
  }
  try {
    // Carregar TODAS as visitas do servidor
    const allVisits = await listVisits();
    
    // Separar entre rascunhos e salvas/enviando/erro
    state.history = allVisits.filter(v => v.status === 'rascunho');
    state.sendable = allVisits.filter(v => v.status === 'salva' || v.status === 'enviando' || v.status === 'erro');
    
    notify({ history: state.history, sendable: state.sendable });
    try {
      localStorage.setItem('last_history', JSON.stringify(state.history));
      localStorage.setItem('last_sendable', JSON.stringify(state.sendable));
    } catch (_) {}
  } catch (error) {
    console.error('[state] erro ao listar visitas', error);
  }
}

export async function initState() {
  try {
    await initActiveVisit();
    // garantir que a visita ativa restaurada apareça nas listas locais (offline também)
    syncLocalListsWithActive();
    await refreshQueueSize();
    await loadLists();
    // fallback offline: preencher a partir do cache local se vazio
    if (!navigator.onLine) {
      try {
        if (!state.history?.length) {
          const cached = localStorage.getItem('last_history');
          if (cached) state.history = JSON.parse(cached);
        }
        if (!state.sendable?.length) {
          const cachedS = localStorage.getItem('last_sendable');
          if (cachedS) state.sendable = JSON.parse(cachedS);
        }
      } catch (_) {}
    }
    notify({ activeVisit: state.activeVisit });
  } catch (error) {
    console.error('[state] erro ao iniciar', error);
    throw error;
  }

  window.addEventListener('online', async () => {
    setOffline(false);
    await processQueue();
    await loadLists();
  });

  window.addEventListener('offline', () => {
    setOffline(true);
    setSyncStatus('offline');
  });
}

async function regeneratePendingPreviews() {
  const visit = state.activeVisit;
  if (!visit || !visit.files) return;
  const fields = Object.keys(visit.files);
  for (const field of fields) {
    const list = visit.files[field] || [];
    for (const file of list) {
      if (!file.downloadUrl && file.pending && file.localId) {
        try {
          const blob = await getFileBlob(file.localId);
          if (blob) {
            try { if (file.previewUrl) URL.revokeObjectURL(file.previewUrl); } catch (_) {}
            file.previewUrl = URL.createObjectURL(blob);
          }
        } catch (_) {}
      }
    }
  }
}

function getFieldFiles(field) {
  if (!state.activeVisit.files[field]) {
    state.activeVisit.files[field] = [];
  }
  return state.activeVisit.files[field];
}

function updateFileEntry(field, localId, updater) {
  const files = getFieldFiles(field);
  const index = files.findIndex((file) => file.localId === localId);
  if (index === -1) return;
  files[index] = { ...files[index], ...updater(files[index]) };
}

function removeFileEntry(field, localId) {
  const files = getFieldFiles(field);
  const index = files.findIndex((file) => file.localId === localId);
  if (index !== -1) {
    files.splice(index, 1);
  }
}

function extractSectionsData(formsData) {
  const partial = {};
  SECTION_KEYS.forEach((key) => {
    if (formsData[key]) {
      partial[key] = formsData[key];
    }
  });
  return partial;
}

export async function saveSections(formsData, options = {}) {
  if (!state.activeVisit) return;
  const sections = extractSectionsData(formsData);
  const hasChanges = Object.keys(sections).length > 0;

  if (hasChanges) {
    SECTION_KEYS.forEach((key) => {
      if (sections[key]) {
        state.activeVisit.sections[key] = {
          ...state.activeVisit.sections[key],
          ...sections[key],
        };
      }
    });
  }

  if (options.metadata) {
    state.activeVisit.metadata = {
      ...state.activeVisit.metadata,
      ...options.metadata,
    };
  }

  if (options.status) {
    state.activeVisit.status = options.status;
  }

  notify({ activeVisit: state.activeVisit });
  await persistSnapshot();

  const payload = {
    sections,
    metadata: options.metadata,
    status: options.status,
    markSaved: options.markSaved,
    updatedBy: options.updatedBy || null,
  };

  if (navigator.onLine) {
    try {
      setSyncStatus('syncing');
      const updated = await updateVisit(state.activeVisit.id, payload);
      ensureActiveVisitStructure(updated);
      prepareFilesFromServer(updated);
      state.activeVisit = {
        ...state.activeVisit,
        sections: { ...state.activeVisit.sections, ...updated.sections },
        metadata: updated.metadata,
        status: updated.status,
      };
      await persistSnapshot();
      setSyncStatus('ok');
      notify({ activeVisit: state.activeVisit });
      state.history = state.history.filter((visit) => visit.id !== state.activeVisit.id);
      const existingIndex = state.sendable.findIndex((visit) => visit.id === state.activeVisit.id);
      if (state.activeVisit.status === 'salva') {
        if (existingIndex === -1) {
          state.sendable.push({ ...state.activeVisit });
        } else {
          state.sendable[existingIndex] = { ...state.activeVisit };
        }
      } else {
        if (existingIndex !== -1) {
          state.sendable.splice(existingIndex, 1);
        }
        if (!state.history.some((visit) => visit.id === state.activeVisit.id)) {
          state.history.push({ ...state.activeVisit });
        }
      }
      notify({ history: state.history, sendable: state.sendable });
      syncLocalListsWithActive();
      return;
    } catch (error) {
      console.warn('[state] falha ao atualizar servidor, fila offline', error);
      setSyncStatus('error');
    }
  }

  await enqueue('updateSections', {
    visitId: state.activeVisit.id,
    payload,
  });
  await refreshQueueSize();
  syncLocalListsWithActive();
}

export async function addFiles(field, fileList) {
  if (!state.activeVisit) return [];
  const filesArray = Array.from(fileList);
  const addedEntries = [];

  for (const file of filesArray) {
    const localId = randomId();
    const entry = {
      localId,
      serverId: null,
      name: file.name,
      size: file.size,
      type: file.type,
      pending: true,
      previewUrl: URL.createObjectURL(file),
    };
    getFieldFiles(field).push(entry);
    addedEntries.push(entry);
    await saveFileBlob(localId, file);
  }

  notify({ activeVisit: state.activeVisit });
  await persistSnapshot();

  if (navigator.onLine) {
    try {
      setSyncStatus('syncing');
      const files = filesArray.map((file) => file);
      const response = await uploadFiles(state.activeVisit.id, field, files);
      const serverFiles = response.files || [];
      serverFiles.forEach((serverFile, index) => {
        const entry = addedEntries[index];
        if (!entry) return;
        updateFileEntry(field, entry.localId, () => ({
          serverId: serverFile.id,
          pending: false,
          downloadUrl: serverFile.downloadUrl || getFileDownloadUrl(state.activeVisit.id, field, serverFile.id),
          previewUrl: entry.previewUrl,
        }));
        deleteFileBlob(entry.localId);
      });
      setSyncStatus('ok');
      await persistSnapshot();
      notify({ activeVisit: state.activeVisit });
      return addedEntries;
    } catch (error) {
      console.error('[state] erro ao enviar arquivos online, voltando para fila', error);
      setSyncStatus('error');
    }
  }

  await enqueue('uploadFiles', {
    visitId: state.activeVisit.id,
    field,
    localIds: addedEntries.map((entry) => entry.localId),
  });
  await refreshQueueSize();
  return addedEntries;
}

export async function removeFile(field, localId) {
  if (!state.activeVisit) return;
  const files = getFieldFiles(field);
  const entry = files.find((file) => file.localId === localId);
  if (!entry) return;

  removeFileEntry(field, localId);
  notify({ activeVisit: state.activeVisit });
  await persistSnapshot();

  if (entry.previewUrl) {
    URL.revokeObjectURL(entry.previewUrl);
  }

  if (entry.pending || !entry.serverId) {
    await deleteFileBlob(localId);
    await enqueue('deleteFile', {
      visitId: state.activeVisit.id,
      field,
      localId,
      serverId: entry.serverId,
    });
    await refreshQueueSize();
    return;
  }

  if (navigator.onLine) {
    try {
      setSyncStatus('syncing');
      await apiDeleteFile(state.activeVisit.id, field, entry.serverId);
      setSyncStatus('ok');
      await persistSnapshot();
      return;
    } catch (error) {
      console.warn('[state] erro ao remover arquivo no servidor, enfileirando', error);
      setSyncStatus('error');
    }
  }

  await enqueue('deleteFile', {
    visitId: state.activeVisit.id,
    field,
    localId,
    serverId: entry.serverId,
  });
  await refreshQueueSize();
}

export async function switchActiveVisit(visitId) {
  if (!visitId || (state.activeVisit && state.activeVisit.id === visitId)) {
    return;
  }

  if (navigator.onLine) {
    const visit = await loadVisitFromBackend(visitId);
    state.activeVisit = visit;
    persistActiveVisitId(visitId);
    await persistSnapshot();
    notify({ activeVisit: state.activeVisit });
    await loadLists();
    return;
  }

  const snapshot = await getVisitSnapshot(visitId);
  if (!snapshot) {
    throw new Error('Visita não disponível offline');
  }
  state.activeVisit = ensureActiveVisitStructure(snapshot);
  persistActiveVisitId(visitId);
  // refletir visita ativa nas listas quando offline
  syncLocalListsWithActive();
  notify({ activeVisit: state.activeVisit });
}

export async function newVisit() {
  if (!navigator.onLine) {
    throw new Error('Conecte-se à internet para iniciar uma nova visita');
  }
  const visit = await createNewVisitOnline();
  state.activeVisit = visit;
  persistActiveVisitId(visit.id);
  await persistSnapshot();
  notify({ activeVisit: state.activeVisit });
  await loadLists();
}

async function handleUpdateSections(record) {
  const { visitId, payload } = record.payload;
  await updateVisit(visitId, payload);
}

async function handleUploadFiles(record) {
  const { visitId, field, localIds } = record.payload;
  const blobs = [];
  for (const localId of localIds) {
    const blob = await getFileBlob(localId);
    if (blob) {
      blobs.push(blob);
    }
  }
  if (blobs.length === 0) {
    return;
  }
  const response = await uploadFiles(visitId, field, blobs);
  const serverFiles = response.files || [];
  serverFiles.forEach(async (serverFile, index) => {
    const localId = localIds[index];
    if (!localId) return;
    await deleteFileBlob(localId);
    if (state.activeVisit?.id === visitId) {
      updateFileEntry(field, localId, (current) => ({
        serverId: serverFile.id,
        pending: false,
        downloadUrl: serverFile.downloadUrl || getFileDownloadUrl(visitId, field, serverFile.id),
      }));
    }
  });
}

async function handleDeleteFile(record) {
  const { visitId, field, serverId, localId } = record.payload;
  if (serverId) {
    await apiDeleteFile(visitId, field, serverId);
  }
  await deleteFileBlob(localId);
}

async function handleSubmitVisit(record) {
  const { visitId } = record.payload;
  await submitVisitRequest(visitId);
  await deleteVisitSnapshot(visitId);
  if (state.activeVisit?.id === visitId) {
    state.activeVisit = null;
    persistActiveVisitId(null);
    await newVisit();
  } else {
    state.history = state.history.filter((visit) => visit.id !== visitId);
    state.sendable = state.sendable.filter((visit) => visit.id !== visitId);
    notify({ history: state.history, sendable: state.sendable });
  }
  await loadLists();
}

const queueHandlers = {
  updateSections: handleUpdateSections,
  uploadFiles: handleUploadFiles,
  deleteFile: handleDeleteFile,
  submitVisit: handleSubmitVisit,
  deleteVisit: async (record) => {
    const { visitId } = record.payload;
    await apiDeleteVisit(visitId);
  },
};

export async function processQueue() {
  const queue = await getQueue();
  if (!queue.length) {
    setSyncStatus('ok');
    await refreshQueueSize();
    return;
  }

  setSyncStatus('syncing');

  for (const record of queue) {
    const handler = queueHandlers[record.type];
    if (!handler) {
      await removeFromQueue(record.id);
      continue;
    }
    try {
      await handler(record);
      await removeFromQueue(record.id);
    } catch (error) {
      console.warn('[state] falha ao processar fila', record.type, error);
      record.attempts = (record.attempts || 0) + 1;
      await updateQueueRecord(record);
      setSyncStatus('error');
      break;
    }
  }

  await refreshQueueSize();
  await persistSnapshot();
  notify({ activeVisit: state.activeVisit });

  if (state.queueSize === 0) {
    setSyncStatus('ok');
  }
}

export async function refreshLists() {
  await loadLists();
}

export async function submitVisit(visitId) {
  const id = visitId || state.activeVisit?.id;
  if (!id) {
    throw new Error('Nenhuma visita selecionada para envio.');
  }
  if (!navigator.onLine) {
    await enqueue('submitVisit', { visitId: id });
    await refreshQueueSize();
    return { queued: true };
  }
  setSyncStatus('syncing');
  try {
    await submitVisitRequest(id);
    await deleteVisitSnapshot(id);
    if (state.activeVisit?.id === id) {
      state.activeVisit = null;
      persistActiveVisitId(null);
      await newVisit();
    } else {
      state.history = state.history.filter((visit) => visit.id !== id);
      state.sendable = state.sendable.filter((visit) => visit.id !== id);
      notify({ history: state.history, sendable: state.sendable });
    }
    await loadLists();
    setSyncStatus('ok');
    await refreshQueueSize();
    return { status: 'ok' };
  } catch (error) {
    console.error('[state] erro ao enviar visita', error);
    await enqueue('submitVisit', { visitId: id });
    await refreshQueueSize();
    setSyncStatus('error');
    throw error;
  }
}

export async function deleteVisit(id) {
  console.log('[state] deleteVisit chamada com id:', id);
  if (!id) {
    console.error('[state] id vazio, abortando');
    return;
  }
  if (navigator.onLine) {
    try {
      console.log('[state] online, chamando API delete...');
      await apiDeleteVisit(id);
      console.log('[state] API delete sucesso');
    } catch (error) {
      console.error('[state] erro ao excluir visita na API:', error);
      throw error;
    }
  } else {
    console.log('[state] offline, enfileirando delete...');
    await enqueue('deleteVisit', { visitId: id });
    await refreshQueueSize();
  }
  console.log('[state] deletando snapshot local...');
  await deleteVisitSnapshot(id);
  if (state.activeVisit?.id === id) {
    console.log('[state] visita deletada era a ativa, limpando...');
    state.activeVisit = null;
    persistActiveVisitId(null);
    // NÃO criar nova visita automaticamente - deixar o usuário decidir
  }
  console.log('[state] carregando listas novamente...');
  await loadLists();
  console.log('[state] notificando observers...');
  notify({ activeVisit: state.activeVisit });
  console.log('[state] deleteVisit concluída');
}

