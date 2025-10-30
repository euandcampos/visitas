const modal = document.getElementById('permission-modal');
const allowBtn = document.getElementById('permission-allow');
const closeBtn = document.getElementById('permission-close');

async function checkPermissions() {
  if (!navigator.permissions || !modal) return;
  try {
    const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
    if (geoStatus.state === 'granted') {
      modal.setAttribute('aria-hidden', 'true');
      return;
    }
    if (geoStatus.state === 'denied') {
      modal.setAttribute('aria-hidden', 'false');
    }
    geoStatus.onchange = () => {
      if (geoStatus.state === 'granted') {
        modal.setAttribute('aria-hidden', 'true');
      }
    };
  } catch (error) {
    console.warn('[permissions] não foi possível verificar permissões', error);
  }
}

export function initPermissionModal() {
  if (!modal) return;
  checkPermissions();

  allowBtn?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Este dispositivo não suporta GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        modal.setAttribute('aria-hidden', 'true');
      },
      () => {
        modal.setAttribute('aria-hidden', 'false');
      },
      { timeout: 10000 },
    );
  });

  closeBtn?.addEventListener('click', () => {
    modal.setAttribute('aria-hidden', 'true');
  });
}

