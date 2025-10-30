const floatBtn = document.getElementById('permission-float');

async function checkPermissions() {
  if (!navigator.permissions || !floatBtn) return;

  try {
    const geoStatus = await navigator.permissions.query({ name: 'geolocation' });

    if (geoStatus.state === 'granted') {
      floatBtn.style.display = 'none';
      return;
    }

    if (geoStatus.state === 'prompt' || geoStatus.state === 'denied') {
      floatBtn.style.display = 'flex';
    }

    geoStatus.onchange = () => {
      if (geoStatus.state === 'granted') {
        floatBtn.style.display = 'none';
      } else {
        floatBtn.style.display = 'flex';
      }
    };
  } catch (error) {
    console.warn('[permissions] não foi possível verificar permissões', error);
    floatBtn.style.display = 'flex';
  }
}

export function initPermissionModal() {
  if (!floatBtn) return;

  checkPermissions();

  floatBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Este dispositivo não suporta GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        floatBtn.style.display = 'none';
        alert('✓ Permissão de localização concedida!');
      },
      (error) => {
        console.error('[permissions] erro ao solicitar', error);
        if (error.code === 1) {
          alert('⚠️ Permissão negada. Você pode ativar nas configurações do navegador.');
        } else {
          alert('⚠️ Erro ao acessar localização. Verifique as configurações.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
