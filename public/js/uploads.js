import { subscribe, getState } from './state.js';

const previewCache = new Map();

function resolvePreview(field) {
  return document.querySelector(`[data-preview-field="${field}"]`) || document.getElementById(`preview-${field}`);
}

function resolveCounter(field) {
  return document.querySelector(`[data-counter-field="${field}"]`) || document.getElementById(`count-${field}`);
}

function renderField(field) {
  const state = getState();
  const entries = state.activeVisit?.files?.[field] || [];
  const preview = resolvePreview(field);
  const counter = resolveCounter(field);
  if (!preview || !counter) return;

  preview.innerHTML = '';
  counter.textContent = entries.length;

  entries.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'file-item';

    if (file.type && file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'file-preview-img';
      img.src = file.previewUrl || file.downloadUrl || '';
      img.onerror = () => {
        // Fallback para ícone se a imagem falhar
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = 'IMG';
        icon.style.cssText = 'background: var(--input); color: var(--muted); border: 1px solid var(--input-border);';
        item.replaceChild(icon, img);
      };
      item.appendChild(img);
    } else if (file.type && file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.className = 'file-preview-video';
      video.src = file.previewUrl || file.downloadUrl || '';
      video.preload = 'metadata';
      video.muted = true;
      video.controls = true;
      video.onloadedmetadata = () => {
        // não tocar automaticamente
        video.currentTime = Math.min(0.1, video.duration || 0);
      };
      video.onerror = () => {
        const icon = document.createElement('div');
        icon.className = 'file-icon';
        icon.textContent = 'VID';
        icon.style.cssText = 'background: var(--input); color: var(--muted); border: 1px solid var(--input-border); display:flex;align-items:center;justify-content:center;';
        item.appendChild(icon);
      };
      item.appendChild(video);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = file.type === 'application/pdf' ? 'PDF' : 'ARQ';
      item.appendChild(icon);
    }

    const info = document.createElement('div');
    info.className = 'file-info';
    info.innerHTML = `
      <div class="file-name">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}${file.pending ? ' • aguardando envio' : ''}</div>
    `;
    item.appendChild(info);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'file-remove';
    removeBtn.dataset.field = field;
    removeBtn.dataset.localId = file.localId;
    removeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>';
    item.appendChild(removeBtn);

    preview.appendChild(item);
  });
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

export function setupUploads({ addFiles, removeFile }) {
  document.addEventListener('click', (event) => {
    const plus = event.target.closest('button.upload-plus');
    if (!plus) return;
    const forId = plus.getAttribute('data-for');
    if (!forId) return;
    const input = document.getElementById(forId);
    if (input && input.type === 'file') {
      input.click();
    }
  });

  document.addEventListener('change', async (event) => {
    const input = event.target.closest('input.file-input');
    if (!input) return;
    const fieldId = input.dataset.fieldId || input.id;
    if (!fieldId) return;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    await addFiles(fieldId, files);
    input.value = '';
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button.remove-file-btn, button.file-remove');
    if (!button) return;
    const field = button.dataset.field;
    const localId = button.dataset.localId;
    if (!field || !localId) return;
    await removeFile(field, localId);
  });

  subscribe((state) => {
    if (!state.activeVisit) return;
    Object.keys(state.activeVisit.files || {}).forEach((field) => renderField(field));
  });
}

