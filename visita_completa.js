let currentSection = 1;
const totalSections = 4;

function showSection(sectionNumber) {
  for (let i = 1; i <= totalSections; i++) {
    document.getElementById(`section${i}`).classList.remove('active');
  }
  document.getElementById(`section${sectionNumber}`).classList.add('active');
  const backBtn = document.getElementById('back-btn');
  if (sectionNumber === 1) {
    backBtn.style.display = 'none';
  } else {
    backBtn.style.display = 'flex';
  }
  currentSection = sectionNumber;
  window.scrollTo(0, 0);
}

document.getElementById('back-btn').addEventListener('click', () => {
  if (currentSection > 1) {
    showSection(currentSection - 1);
  }
});

let melhorLocalizacao = null;
let melhorPrecisao = Infinity;
let intervalId = null;
let isCapturing = false;
let capturaCount = 0;

const locationBox = document.getElementById('location-box');
const locationIcon = document.getElementById('location-icon');
const locationStatus = document.getElementById('location-status');
const locationAccuracy = document.getElementById('location-accuracy');
const locationCoords = document.getElementById('location-coords');
const locationTime = document.getElementById('location-time');
const btnRecapture = document.getElementById('btn-recapture');

function iniciarCaptura() {
  if (!navigator.geolocation) {
    mostrarErro('GPS não disponível neste dispositivo');
    return;
  }
  isCapturing = true;
  capturaCount = 0;
  locationBox.className = 'location-box capturing';
  locationIcon.textContent = '[GPS]';
  locationStatus.textContent = 'Capturando localização...';
  locationAccuracy.textContent = 'Aguarde...';
  btnRecapture.style.display = 'none';
  capturarLocalizacao();
  intervalId = setInterval(() => {
    capturarLocalizacao();
  }, 1000);
}

function capturarLocalizacao() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturaCount++;
      const precisao = position.coords.accuracy;
      if (precisao < melhorPrecisao) {
        melhorPrecisao = precisao;
        melhorLocalizacao = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisao: precisao,
          timestamp: new Date().toISOString(),
          timestampDisplay: new Date().toLocaleString('pt-BR'),
          linkMaps: `https://maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`,
          totalCapturas: capturaCount
        };
        localStorage.setItem('visitLocation', JSON.stringify(melhorLocalizacao));
        atualizarDisplay();
        if (precisao <= 2) {
          pararCaptura(true);
        }
      }
    },
    (error) => {
      console.error('Erro GPS:', error);
      if (capturaCount === 0) {
        mostrarErro('Erro ao capturar GPS. Verifique se permitiu acesso.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  );
}

function atualizarDisplay() {
  if (!melhorLocalizacao) return;
  const precisao = melhorLocalizacao.precisao;
  const totalCapturas = melhorLocalizacao.totalCapturas || capturaCount;
  locationAccuracy.textContent = `Precisão: ${precisao.toFixed(1)}m | Capturas: ${totalCapturas}`;
  locationCoords.textContent = `${melhorLocalizacao.latitude.toFixed(6)}, ${melhorLocalizacao.longitude.toFixed(6)}`;
  locationTime.textContent = `Atualizado em ${melhorLocalizacao.timestampDisplay}`;
  if (precisao <= 2) {
    locationStatus.textContent = '[OK] Localização perfeita!';
    locationIcon.textContent = '[OK]';
  } else if (precisao <= 10) {
    locationStatus.textContent = '[GPS] Refinando... Quase lá!';
  } else if (precisao <= 30) {
    locationStatus.textContent = '[GPS] Refinando localização...';
  } else {
    locationStatus.textContent = '[GPS] Capturando... Aguarde';
  }
}

function pararCaptura(sucesso = true) {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isCapturing = false;
  if (sucesso && melhorLocalizacao) {
    locationBox.className = 'location-box success';
    locationIcon.textContent = '[OK]';
    locationStatus.textContent = '[OK] Localização capturada!';
    btnRecapture.style.display = 'inline-block';
  }
}

function mostrarErro(mensagem) {
  locationBox.className = 'location-box error';
  locationIcon.textContent = '[X]';
  locationStatus.textContent = mensagem;
  locationAccuracy.textContent = 'Tente novamente';
  btnRecapture.style.display = 'inline-block';
  isCapturing = false;
}

btnRecapture.addEventListener('click', () => {
  melhorPrecisao = Infinity;
  iniciarCaptura();
});

window.addEventListener('beforeunload', () => {
  if (melhorLocalizacao) {
    localStorage.setItem('visitLocation', JSON.stringify(melhorLocalizacao));
  }
});

iniciarCaptura();

document.addEventListener('visibilitychange', () => {
  if (document.hidden && isCapturing) {
    pararCaptura(true);
  } else if (!document.hidden && !isCapturing && melhorLocalizacao && melhorLocalizacao.precisao > 2) {
    iniciarCaptura();
  }
});

const root = document.documentElement;
const themeBtn = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  root.setAttribute('data-theme', 'dark');
  themeBtn.textContent = '◐';
} else {
  themeBtn.textContent = '◐';
}
themeBtn.addEventListener('click', () => {
  const current = root.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  if (next === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
  localStorage.setItem('theme', next);
  themeBtn.textContent = '◐';
});

const cpf = document.getElementById('cpf');
cpf.addEventListener('input', () => {
  let v = cpf.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) cpf.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
  else if (v.length > 6) cpf.value = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
  else if (v.length > 3) cpf.value = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
  else cpf.value = v;
});

const cep = document.getElementById('cep');
cep.addEventListener('input', () => {
  let v = cep.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) cep.value = v.replace(/(\d{5})(\d{0,3})/, '$1-$2');
  else cep.value = v;
});


const whatsapp = document.getElementById('whatsapp');
whatsapp.addEventListener('input', () => {
  let v = whatsapp.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) whatsapp.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) whatsapp.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  else whatsapp.value = v;
});


function applyMoneyMask(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    v = (parseInt(v) / 100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    input.value = 'R$ ' + v;
  });
  input.addEventListener('focus', () => {
    let v = input.value.replace(/\D/g, '');
    if (v === '0' || v === '00') {
      input.value = '';
    }
  });
}

applyMoneyMask(document.getElementById('rentValue'));
applyMoneyMask(document.getElementById('benefitValue'));
applyMoneyMask(document.getElementById('income'));
applyMoneyMask(document.getElementById('spouseIncome'));

const houseTypeRadios = document.querySelectorAll('input[name="houseType"]');
const rentValueField = document.getElementById('rent-value-field');
const rentValueInput = document.getElementById('rentValue');

houseTypeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if ((radio.value === 'alugada' || radio.value === 'ap') && radio.checked) {
      rentValueField.classList.add('show');
    } else {
      rentValueField.classList.remove('show');
      rentValueInput.value = '';
    }
  });
});

const benefitRadios = document.querySelectorAll('input[name="benefit"]');
const benefitValueField = document.getElementById('benefit-value-field');
const benefitValueInput = document.getElementById('benefitValue');

benefitRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'sim' && radio.checked) {
      benefitValueField.classList.add('show');
    } else {
      benefitValueField.classList.remove('show');
      benefitValueInput.value = '';
    }
  });
});

const worksRadios = document.querySelectorAll('input[name="works"]');
const worksFields = document.getElementById('works-fields');

worksRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'sim' && radio.checked) {
      worksFields.classList.add('show');
    } else {
      worksFields.classList.remove('show');
      document.getElementById('companyName').value = '';
      document.getElementById('workTime').value = '';
      document.getElementById('workCep').value = '';
      document.getElementById('workStreet').value = '';
      document.getElementById('workNumber').value = '';
      document.getElementById('workDistrict').value = '';
      document.getElementById('workCity').value = '';
      document.getElementById('address-fields-trabalho').classList.remove('visible');
      document.getElementById('address-fields-trabalho-2').classList.remove('visible');
    }
  });
});

const marriedRadios = document.querySelectorAll('input[name="married"]');
const spouseSection = document.getElementById('spouse-section');

marriedRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'sim' && radio.checked) {
      spouseSection.classList.add('show');
    } else {
      spouseSection.classList.remove('show');
      document.querySelectorAll('#spouse-section input').forEach(inp => inp.value = '');
      document.querySelectorAll('#spouse-section input[type="radio"]').forEach(r => r.checked = false);
    }
  });
});

const childrenRadios = document.querySelectorAll('input[name="children"]');
const childrenFields = document.getElementById('children-fields');

childrenRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'sim' && radio.checked) {
      childrenFields.classList.add('show');
    } else {
      childrenFields.classList.remove('show');
      document.getElementById('childrenAge').value = '';
      document.getElementById('childrenWorks').value = '';
    }
  });
});

const spouseWorksRadios = document.querySelectorAll('input[name="spouseWorks"]');
const spouseWorksFields = document.getElementById('spouse-works-fields');
const spouseNoWorksField = document.getElementById('spouse-no-works-field');

spouseWorksRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.value === 'sim' && radio.checked) {
      spouseWorksFields.classList.add('show');
      spouseNoWorksField.classList.remove('show');
      document.getElementById('spouseSideJob').value = '';
    } else if (radio.value === 'nao' && radio.checked) {
      spouseWorksFields.classList.remove('show');
      spouseNoWorksField.classList.add('show');
      document.getElementById('spouseCompanyName').value = '';
      document.getElementById('spouseWorkTime').value = '';
      document.getElementById('spouseWorkCep').value = '';
      document.getElementById('spouseWorkStreet').value = '';
      document.getElementById('spouseWorkNumber').value = '';
      document.getElementById('spouseWorkDistrict').value = '';
      document.getElementById('spouseWorkCity').value = '';
      document.getElementById('address-fields-trabalho-conjuge').classList.remove('visible');
      document.getElementById('address-fields-trabalho-conjuge-2').classList.remove('visible');
    }
  });
});


const filesData = {
  fotoCasa: [],
  fotoCliente: [],
  comprovanteResidencia: [],
  carteiraTrabalho: [],
  holerite: [],
  extratoBeneficio: [],
  rg: [],
  redesSociais: []
};

let addressConfirmations = [];
let confirmationIdCounter = 0;

document.getElementById('btn-add-confirmation').addEventListener('click', addAddressConfirmation);

function addAddressConfirmation() {
  const id = confirmationIdCounter++;
  const confirmation = {
    id: id,
    nomeParente: '',
    whatsappParente: '',
    qualParente: '',
    cep: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    tipoCasa: '',
    gps: null,
    fotosCasa: []
  };
  addressConfirmations.push(confirmation);
  renderConfirmation(confirmation);
}

function renderConfirmation(confirmation) {
  const container = document.getElementById('confirmations-container');
  const div = document.createElement('div');
  div.className = 'confirmation-item';
  div.setAttribute('data-confirmation-id', confirmation.id);
  div.innerHTML = `
    <div class="confirmation-header">
      <span class="confirmation-title">Confirmação #${confirmation.id + 1}</span>
      <button type="button" class="btn-remove-confirmation" onclick="removeAddressConfirmation(${confirmation.id})">[X] Remover</button>
    </div>
    
    <div class="field">
      <div class="label-row">
        <label>Nome do parente</label>
      </div>
      <input type="text" id="conf-name-${confirmation.id}" placeholder="Ex.: Maria Silva" />
      <div class="help">Nome completo do parente</div>
    </div>
    
    <div class="row row-2">
      <div class="field">
        <div class="label-row">
          <label>WhatsApp do parente</label>
        </div>
        <input type="tel" id="conf-whatsapp-${confirmation.id}" placeholder="(11) 90000-0000" maxlength="15" />
        <div class="help">Ex.: 11912345678</div>
      </div>
      <div class="field">
        <div class="label-row">
          <label>Qual parente é</label>
        </div>
        <input type="text" id="conf-relation-${confirmation.id}" placeholder="Ex.: Irmã" />
        <div class="help">Ex.: Mãe, Irmão, Tio</div>
      </div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <div class="label-row">
        <label>CEP</label>
      </div>
      <input type="text" 
             id="conf-cep-${confirmation.id}" 
             placeholder="00000-000" 
             maxlength="9" 
             inputmode="numeric"
             oninput="this.value=this.value.replace(/\\D/g,'').slice(0,8).replace(/(\\d{5})(\\d{0,3})/,'$1-$2')" />
      <div class="help">Digite o CEP para buscar automaticamente</div>
    </div>
    
    <div class="address-fields row row-2" id="conf-address-fields-${confirmation.id}" style="display: none;">
      <div class="field">
        <div class="label-row">
          <label>Rua</label>
        </div>
        <input type="text" id="conf-street-${confirmation.id}" placeholder="Ex.: Rua das Flores" readonly />
        <div class="help">Preenchido automaticamente</div>
      </div>
      <div class="field">
        <div class="label-row">
          <label>Número</label>
        </div>
        <input type="text" id="conf-number-${confirmation.id}" placeholder="Ex.: 123" />
        <div class="help">Digite o número</div>
      </div>
    </div>
    
    <div class="address-fields row row-2" id="conf-address-fields-2-${confirmation.id}" style="display: none;">
      <div class="field">
        <div class="label-row">
          <label>Bairro</label>
        </div>
        <input type="text" id="conf-district-${confirmation.id}" placeholder="Ex.: Centro" readonly />
        <div class="help">Preenchido automaticamente</div>
      </div>
      <div class="field">
        <div class="label-row">
          <label>Cidade</label>
        </div>
        <input type="text" id="conf-city-${confirmation.id}" placeholder="Ex.: São Paulo" readonly />
        <div class="help">Preenchido automaticamente</div>
      </div>
    </div>
    
    <div class="address-fields field" id="conf-address-fields-3-${confirmation.id}" style="display: none; margin-top: 16px;">
      <div class="label-row">
        <label>Tipo de casa</label>
      </div>
      <div class="radio-group">
        <div class="radio-option">
          <input type="radio" id="conf-house-own-${confirmation.id}" name="conf-housetype-${confirmation.id}" value="propria" />
          <label for="conf-house-own-${confirmation.id}" class="radio-label">Própria</label>
        </div>
        <div class="radio-option">
          <input type="radio" id="conf-house-rent-${confirmation.id}" name="conf-housetype-${confirmation.id}" value="alugada" />
          <label for="conf-house-rent-${confirmation.id}" class="radio-label">Alugada</label>
        </div>
        <div class="radio-option">
          <input type="radio" id="conf-house-ap-${confirmation.id}" name="conf-housetype-${confirmation.id}" value="ap" />
          <label for="conf-house-ap-${confirmation.id}" class="radio-label">AP</label>
        </div>
      </div>
      <div class="help">Selecione uma opção</div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <div class="label-row">
        <label>Foto(s) da casa</label>
        <span class="count-badge" id="count-confirmation-${confirmation.id}">0</span>
      </div>
      <input type="file" id="confirmation-photo-${confirmation.id}" class="file-input" accept="image/*,application/pdf" multiple />
      <label for="confirmation-photo-${confirmation.id}" class="upload-btn">
        [+] Tirar foto ou escolher arquivo
      </label>
      <div class="help">Foto da placa ou número da casa</div>
      <div class="files-preview" id="preview-confirmation-${confirmation.id}"></div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <button type="button" class="btn-capture-gps" id="btn-gps-${confirmation.id}" onclick="captureConfirmationGPS(${confirmation.id})">
        [GPS] Capturar Localização
      </button>
      <div id="gps-info-${confirmation.id}" class="gps-info" style="display: none;"></div>
    </div>
  `;
  container.appendChild(div);
  
  const confId = confirmation.id;
  
  const nameInput = document.getElementById(`conf-name-${confId}`);
  if (nameInput) {
    nameInput.addEventListener('input', (e) => {
      const conf = addressConfirmations.find(c => c.id === confId);
      if (conf) conf.nomeParente = e.target.value;
    });
  }
  
  const whatsappInput = document.getElementById(`conf-whatsapp-${confId}`);
  if (whatsappInput) {
    whatsappInput.addEventListener('input', function() {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) this.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      else if (v.length > 2) this.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      else this.value = v;
      
      const conf = addressConfirmations.find(c => c.id === confId);
      if (conf) conf.whatsappParente = this.value;
    });
  }
  
  const relationInput = document.getElementById(`conf-relation-${confId}`);
  if (relationInput) {
    relationInput.addEventListener('input', (e) => {
      const conf = addressConfirmations.find(c => c.id === confId);
      if (conf) conf.qualParente = e.target.value;
    });
  }
  
  const cepInput = document.getElementById(`conf-cep-${confId}`);
  if (cepInput) {
    cepInput.addEventListener('input', async function() {
      const cepLimpo = this.value.replace(/\D/g, '');
      const conf = addressConfirmations.find(c => c.id === confId);
      
      if (cepLimpo.length === 0 && conf) {
        conf.cep = '';
        conf.rua = '';
        conf.numero = '';
        conf.bairro = '';
        conf.cidade = '';
        const fields1 = document.getElementById(`conf-address-fields-${confId}`);
        const fields2 = document.getElementById(`conf-address-fields-2-${confId}`);
        const fields3 = document.getElementById(`conf-address-fields-3-${confId}`);
        if (fields1) fields1.style.display = 'none';
        if (fields2) fields2.style.display = 'none';
        if (fields3) fields3.style.display = 'none';
      } else if (cepLimpo.length === 8) {
        const data = await buscarCep(this.value, 'confirmacao');
        if (data && conf) {
          conf.cep = this.value;
          conf.rua = data.logradouro;
          conf.bairro = data.bairro;
          conf.cidade = `${data.localidade}/${data.uf}`;
          
          const streetInput = document.getElementById(`conf-street-${confId}`);
          const districtInput = document.getElementById(`conf-district-${confId}`);
          const cityInput = document.getElementById(`conf-city-${confId}`);
          const fields1 = document.getElementById(`conf-address-fields-${confId}`);
          const fields2 = document.getElementById(`conf-address-fields-2-${confId}`);
          const fields3 = document.getElementById(`conf-address-fields-3-${confId}`);
          const numberInput = document.getElementById(`conf-number-${confId}`);
          
          if (streetInput) streetInput.value = data.logradouro;
          if (districtInput) districtInput.value = data.bairro;
          if (cityInput) cityInput.value = `${data.localidade}/${data.uf}`;
          
          if (fields1) fields1.style.display = 'grid';
          if (fields2) fields2.style.display = 'grid';
          if (fields3) fields3.style.display = 'block';
          
          if (numberInput) numberInput.focus();
        }
      }
    });
  }
  
  const numberInput = document.getElementById(`conf-number-${confId}`);
  if (numberInput) {
    numberInput.addEventListener('input', (e) => {
      const conf = addressConfirmations.find(c => c.id === confId);
      if (conf) conf.numero = e.target.value;
    });
  }
  
  const houseTypeRadios = document.querySelectorAll(`input[name="conf-housetype-${confId}"]`);
  houseTypeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const conf = addressConfirmations.find(c => c.id === confId);
      if (conf && radio.checked) conf.tipoCasa = radio.value;
    });
  });
  
  const photoInput = document.getElementById(`confirmation-photo-${confId}`);
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      handleConfirmationPhotoSelect(e, confId);
    });
  }
}

function handleConfirmationPhotoSelect(event, confirmationId) {
  const files = Array.from(event.target.files);
  const confirmation = addressConfirmations.find(c => c.id === confirmationId);
  if (!confirmation) return;
  files.forEach(file => {
    confirmation.fotosCasa.push(file);
  });
  updateConfirmationPreview(confirmationId);
  updateConfirmationCounter(confirmationId);
  event.target.value = '';
}

function updateConfirmationPreview(confirmationId) {
  const confirmation = addressConfirmations.find(c => c.id === confirmationId);
  if (!confirmation) return;
  const previewContainer = document.getElementById(`preview-confirmation-${confirmationId}`);
  previewContainer.innerHTML = '';
  confirmation.fotosCasa.forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'file-preview-img';
      img.src = URL.createObjectURL(file);
      fileItem.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = 'PDF';
      fileItem.appendChild(icon);
    }
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileItem.appendChild(fileInfo);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
      removeConfirmationPhoto(confirmationId, index);
    });
    fileItem.appendChild(removeBtn);
    previewContainer.appendChild(fileItem);
  });
}

function updateConfirmationCounter(confirmationId) {
  const confirmation = addressConfirmations.find(c => c.id === confirmationId);
  if (!confirmation) return;
  const counter = document.getElementById(`count-confirmation-${confirmationId}`);
  if (counter) counter.textContent = confirmation.fotosCasa.length;
}

function removeConfirmationPhoto(confirmationId, index) {
  const confirmation = addressConfirmations.find(c => c.id === confirmationId);
  if (!confirmation) return;
  confirmation.fotosCasa.splice(index, 1);
  updateConfirmationPreview(confirmationId);
  updateConfirmationCounter(confirmationId);
}

function removeAddressConfirmation(confirmationId) {
  const index = addressConfirmations.findIndex(c => c.id === confirmationId);
  if (index !== -1) {
    addressConfirmations.splice(index, 1);
  }
  const element = document.querySelector(`[data-confirmation-id="${confirmationId}"]`);
  if (element) {
    element.remove();
  }
}

function captureConfirmationGPS(confirmationId) {
  const btn = document.getElementById(`btn-gps-${confirmationId}`);
  const infoDiv = document.getElementById(`gps-info-${confirmationId}`);
  btn.textContent = '[GPS] Capturando...';
  btn.classList.add('capturing');
  btn.disabled = true;
  if (!navigator.geolocation) {
    btn.textContent = '[X] GPS não disponível';
    btn.classList.remove('capturing');
    btn.disabled = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const confirmation = addressConfirmations.find(c => c.id === confirmationId);
      if (confirmation) {
        confirmation.gps = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString()
        };
        btn.textContent = '[OK] GPS Capturado!';
        btn.classList.remove('capturing');
        btn.classList.add('success');
        btn.disabled = false;
        infoDiv.style.display = 'block';
        infoDiv.innerHTML = `
          <strong>GPS Capturado</strong><br>
          Lat: ${confirmation.gps.latitude.toFixed(6)}, Long: ${confirmation.gps.longitude.toFixed(6)}<br>
          Precisão: ${confirmation.gps.accuracy.toFixed(1)}m
        `;
      }
    },
    (error) => {
      console.error('Erro GPS:', error);
      btn.textContent = '[X] Erro ao capturar';
      btn.classList.remove('capturing');
      btn.disabled = false;
      alert('Erro ao capturar GPS. Verifique se permitiu o acesso à localização.');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

const fileInputs = document.querySelectorAll('.file-input');
fileInputs.forEach(input => {
  input.addEventListener('change', (e) => {
    handleFileSelect(e, input.id);
  });
});

function handleFileSelect(event, fieldId) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    filesData[fieldId].push(file);
  });
  updatePreview(fieldId);
  updateCounter(fieldId);
  event.target.value = '';
}

function updatePreview(fieldId) {
  const previewContainer = document.getElementById(`preview-${fieldId}`);
  previewContainer.innerHTML = '';
  filesData[fieldId].forEach((file, index) => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'file-preview-img';
      img.src = URL.createObjectURL(file);
      fileItem.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.textContent = 'PDF';
      fileItem.appendChild(icon);
    }
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    const fileName = document.createElement('div');
    fileName.className = 'file-name';
    fileName.textContent = file.name;
    const fileSize = document.createElement('div');
    fileSize.className = 'file-size';
    fileSize.textContent = formatFileSize(file.size);
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    fileItem.appendChild(fileInfo);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-file-btn';
    removeBtn.textContent = 'Remover';
    removeBtn.addEventListener('click', () => {
      removeFile(fieldId, index);
    });
    fileItem.appendChild(removeBtn);
    previewContainer.appendChild(fileItem);
  });
}

function updateCounter(fieldId) {
  const counter = document.getElementById(`count-${fieldId}`);
  counter.textContent = filesData[fieldId].length;
}

function removeFile(fieldId, index) {
  filesData[fieldId].splice(index, 1);
  updatePreview(fieldId);
  updateCounter(fieldId);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const modal = document.getElementById('validation-modal');
const modalTitle = document.getElementById('modal-title');
const missingFieldEl = document.getElementById('missing-field');
const btnFill = document.getElementById('btn-fill');
const btnSkip = document.getElementById('btn-skip');

let currentEmptyField = null;
let emptyFields = [];
let currentIndex = 0;
let currentForm = null;

document.getElementById('form1').addEventListener('submit', (e) => {
  e.preventDefault();
  currentForm = document.getElementById('form1');
  emptyFields = [];
  const textFields = Array.from(currentForm.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"]')).filter(input => input.name !== 'complement' && input.name !== 'rentValue');
  emptyFields = textFields.filter(field => !field.value.trim());
  const houseTypeSelected = currentForm.querySelector('input[name="houseType"]:checked');
  if (!houseTypeSelected) {
    const fake = document.createElement('input');
    fake.setAttribute('data-label', 'Tipo de casa');
    fake.name = 'houseType';
    emptyFields.push(fake);
  } else if (houseTypeSelected.value === 'alugada' || houseTypeSelected.value === 'ap') {
    if (!rentValueInput.value.trim()) {
      emptyFields.push(rentValueInput);
    }
  }
  if (emptyFields.length > 0) {
    currentIndex = 0;
    showModalForField(emptyFields[currentIndex]);
  } else {
    submitForm1();
  }
});

function submitForm1() {
  const data = Object.fromEntries(new FormData(currentForm).entries());
  if (melhorLocalizacao) {
    data.localizacaoVisita = melhorLocalizacao;
  }
  localStorage.setItem('formData_section1', JSON.stringify(data));
  showSection(2);
}

document.getElementById('form2').addEventListener('submit', (e) => {
  e.preventDefault();
  currentForm = document.getElementById('form2');
  emptyFields = [];
  const benefit = currentForm.querySelector('input[name="benefit"]:checked');
  if (!benefit) {
    const fake = document.createElement('input');
    fake.setAttribute('data-label', 'Recebe benefício');
    fake.name = 'benefit';
    emptyFields.push(fake);
  } else if (benefit.value === 'sim' && !benefitValueInput.value.trim()) {
    emptyFields.push(benefitValueInput);
  }
  const works = currentForm.querySelector('input[name="works"]:checked');
  if (!works) {
    const fake = document.createElement('input');
    fake.setAttribute('data-label', 'Trabalha registrado');
    fake.name = 'works';
    emptyFields.push(fake);
  } else if (works.value === 'sim') {
    if (!document.getElementById('companyName').value.trim()) emptyFields.push(document.getElementById('companyName'));
    if (!document.getElementById('workTime').value.trim()) emptyFields.push(document.getElementById('workTime'));
    if (!document.getElementById('workCep').value.trim()) emptyFields.push(document.getElementById('workCep'));
  }
  if (!document.getElementById('profession').value.trim()) emptyFields.push(document.getElementById('profession'));
  if (!document.getElementById('income').value.trim()) emptyFields.push(document.getElementById('income'));
  const married = currentForm.querySelector('input[name="married"]:checked');
  if (!married) {
    const fake = document.createElement('input');
    fake.setAttribute('data-label', 'Casado(a)');
    fake.name = 'married';
    emptyFields.push(fake);
  }
  const children = currentForm.querySelector('input[name="children"]:checked');
  if (!children) {
    const fake = document.createElement('input');
    fake.setAttribute('data-label', 'Tem filhos');
    fake.name = 'children';
    emptyFields.push(fake);
  } else if (children.value === 'sim') {
    if (!document.getElementById('childrenAge').value.trim()) emptyFields.push(document.getElementById('childrenAge'));
    if (!document.getElementById('childrenWorks').value.trim()) emptyFields.push(document.getElementById('childrenWorks'));
  }
  if (married && married.value === 'sim') {
    const spouseWorks = currentForm.querySelector('input[name="spouseWorks"]:checked');
    if (!spouseWorks) {
      const fake = document.createElement('input');
      fake.setAttribute('data-label', 'Marido/esposa trabalha registrado');
      fake.name = 'spouseWorks';
      emptyFields.push(fake);
    } else if (spouseWorks.value === 'sim') {
      if (!document.getElementById('spouseCompanyName').value.trim()) emptyFields.push(document.getElementById('spouseCompanyName'));
      if (!document.getElementById('spouseWorkTime').value.trim()) emptyFields.push(document.getElementById('spouseWorkTime'));
      if (!document.getElementById('spouseWorkCep').value.trim()) emptyFields.push(document.getElementById('spouseWorkCep'));
    } else if (spouseWorks.value === 'nao') {
      if (!document.getElementById('spouseSideJob').value.trim()) emptyFields.push(document.getElementById('spouseSideJob'));
    }
    if (!document.getElementById('spouseProfession').value.trim()) emptyFields.push(document.getElementById('spouseProfession'));
    if (!document.getElementById('spouseIncome').value.trim()) emptyFields.push(document.getElementById('spouseIncome'));
  }
  if (emptyFields.length > 0) {
    currentIndex = 0;
    showModalForField(emptyFields[currentIndex]);
  } else {
    submitForm2();
  }
});

function submitForm2() {
  const data = Object.fromEntries(new FormData(currentForm).entries());
  localStorage.setItem('formData_section2', JSON.stringify(data));
  showSection(3);
}

document.getElementById('form3').addEventListener('submit', (e) => {
  e.preventDefault();
  currentForm = document.getElementById('form3');
  emptyFields = [];
  modalTitle.textContent = 'Faltou enviar um documento';
  const requiredFields = [
    { id: 'fotoCasa', label: 'Foto da casa' },
    { id: 'fotoCliente', label: 'Foto do cliente segurando o RG' },
    { id: 'comprovanteResidencia', label: 'Comprovante de residência/IPTU' },
    { id: 'carteiraTrabalho', label: 'Carteira de trabalho' },
    { id: 'holerite', label: 'Holerite' },
    { id: 'extratoBeneficio', label: 'Extrato do benefício' },
    { id: 'rg', label: 'RG frente/verso' },
    { id: 'redesSociais', label: 'Redes sociais' }
  ];
  requiredFields.forEach(field => {
    if (filesData[field.id].length === 0) {
      emptyFields.push(field);
    }
  });
  if (emptyFields.length > 0) {
    currentIndex = 0;
    showModalForFieldFile(emptyFields[currentIndex]);
  } else {
    submitForm3();
  }
});

function submitForm3() {
  localStorage.setItem('formData_files', 'uploaded');
  pararCaptura(true);
  showSection(4);
}

document.getElementById('form4').addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (addressConfirmations.length === 0) {
    alert('Você pode finalizar sem adicionar confirmações, ou adicionar pelo menos uma se desejar.');
    submitFormFinal();
    return;
  }
  
  for (let i = 0; i < addressConfirmations.length; i++) {
    const conf = addressConfirmations[i];
    
    if (!conf.nomeParente || conf.nomeParente.trim() === '') {
      alert(`Confirmação #${i + 1}: Nome do parente não preenchido!`);
      document.getElementById(`conf-name-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`conf-name-${conf.id}`).focus();
      return;
    }
    
    if (!conf.whatsappParente || conf.whatsappParente.trim() === '') {
      alert(`Confirmação #${i + 1}: WhatsApp não preenchido!`);
      document.getElementById(`conf-whatsapp-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`conf-whatsapp-${conf.id}`).focus();
      return;
    }
    
    if (!conf.qualParente || conf.qualParente.trim() === '') {
      alert(`Confirmação #${i + 1}: Qual parente é não preenchido!`);
      document.getElementById(`conf-relation-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`conf-relation-${conf.id}`).focus();
      return;
    }
    
    if (!conf.cep || conf.cep.replace(/\D/g, '').length !== 8) {
      alert(`Confirmação #${i + 1}: CEP não preenchido ou inválido!`);
      document.getElementById(`conf-cep-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`conf-cep-${conf.id}`).focus();
      return;
    }
    
    if (!conf.numero || conf.numero.trim() === '') {
      alert(`Confirmação #${i + 1}: Número não preenchido!`);
      document.getElementById(`conf-number-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById(`conf-number-${conf.id}`).focus();
      return;
    }
    
    if (!conf.tipoCasa || conf.tipoCasa.trim() === '') {
      alert(`Confirmação #${i + 1}: Tipo de casa não selecionado!`);
      document.getElementById(`conf-address-fields-3-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (conf.fotosCasa.length === 0) {
      alert(`Confirmação #${i + 1}: É necessário enviar pelo menos 1 foto da casa!`);
      document.getElementById(`confirmation-photo-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    if (!conf.gps) {
      alert(`Confirmação #${i + 1}: É necessário capturar a localização GPS!`);
      document.getElementById(`btn-gps-${conf.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  
  submitFormFinal();
});

async function submitFormFinal() {
  alert('Enviando dados... Aguarde.');
  const data1 = JSON.parse(localStorage.getItem('formData_section1') || '{}');
  const data2 = JSON.parse(localStorage.getItem('formData_section2') || '{}');
  const data4 = Object.fromEntries(new FormData(currentForm).entries());
  const formData = new FormData();
  formData.append('nomeMotoboy', data1.sender || '');
  formData.append('nomeCliente', data1.clientName || '');
  formData.append('idadeCliente', data1.age || '');
  formData.append('cpfCliente', data1.cpf || '');
  formData.append('whatsappCliente', data1.whatsapp || '');
  formData.append('ruaCliente', data1.street || '');
  formData.append('numeroCliente', data1.number || '');
  formData.append('bairroCliente', data1.district || '');
  formData.append('cidadeCliente', data1.city || '');
  formData.append('cepCliente', data1.cep || '');
  formData.append('complementoCliente', data1.complement || '');
  formData.append('quantasPessoasMoram', data1.residents || '');
  formData.append('tipoCasa', data1.houseType || '');
  if (data1.rentValue) formData.append('valorAluguel', data1.rentValue);
  if (data1.localizacaoVisita) {
    formData.append('latitudeVisita', data1.localizacaoVisita.latitude || '');
    formData.append('longitudeVisita', data1.localizacaoVisita.longitude || '');
    formData.append('precisaoVisita', data1.localizacaoVisita.precisao || '');
    formData.append('timestampVisita', data1.localizacaoVisita.timestamp || '');
    formData.append('linkMapsVisita', data1.localizacaoVisita.linkMaps || '');
  }
  formData.append('recebeBeneficio', data2.benefit || '');
  if (data2.benefitValue) formData.append('valorBeneficio', data2.benefitValue);
  formData.append('trabalhaRegistrado', data2.works || '');
  if (data2.companyName) formData.append('nomeEmpresa', data2.companyName);
  if (data2.workTime) formData.append('tempoRegistro', data2.workTime);
  if (data2.workCep) formData.append('cepTrabalho', data2.workCep);
  if (data2.workStreet) formData.append('ruaTrabalho', data2.workStreet);
  if (data2.workNumber) formData.append('numeroTrabalho', data2.workNumber);
  if (data2.workDistrict) formData.append('bairroTrabalho', data2.workDistrict);
  if (data2.workCity) formData.append('cidadeTrabalho', data2.workCity);
  formData.append('profissao', data2.profession || '');
  formData.append('rendaMensal', data2.income || '');
  formData.append('casado', data2.married || '');
  formData.append('temFilhos', data2.children || '');
  if (data2.childrenAge) formData.append('idadeFilhos', data2.childrenAge);
  if (data2.childrenWorks) formData.append('filhoTrabalhaRegistrado', data2.childrenWorks);
  if (data2.spouseWorks) formData.append('conjugeTrabalhaRegistrado', data2.spouseWorks);
  if (data2.spouseCompanyName) formData.append('nomeEmpresaConjuge', data2.spouseCompanyName);
  if (data2.spouseWorkTime) formData.append('tempoRegistroConjuge', data2.spouseWorkTime);
  if (data2.spouseWorkCep) formData.append('cepTrabalhoConjuge', data2.spouseWorkCep);
  if (data2.spouseWorkStreet) formData.append('ruaTrabalhoConjuge', data2.spouseWorkStreet);
  if (data2.spouseWorkNumber) formData.append('numeroTrabalhoConjuge', data2.spouseWorkNumber);
  if (data2.spouseWorkDistrict) formData.append('bairroTrabalhoConjuge', data2.spouseWorkDistrict);
  if (data2.spouseWorkCity) formData.append('cidadeTrabalhoConjuge', data2.spouseWorkCity);
  if (data2.spouseSideJob) formData.append('conjugeFazBico', data2.spouseSideJob);
  if (data2.spouseProfession) formData.append('profissaoConjuge', data2.spouseProfession);
  if (data2.spouseIncome) formData.append('rendaMensalConjuge', data2.spouseIncome);
  Object.keys(filesData).forEach(key => {
    filesData[key].forEach((file, index) => {
      formData.append(`${key}[${index}]`, file, file.name);
    });
  });
  addressConfirmations.forEach((conf, index) => {
    formData.append(`confirmacoesEndereco[${index}][nomeParente]`, conf.nomeParente || '');
    formData.append(`confirmacoesEndereco[${index}][whatsappParente]`, conf.whatsappParente || '');
    formData.append(`confirmacoesEndereco[${index}][qualParente]`, conf.qualParente || '');
    formData.append(`confirmacoesEndereco[${index}][cep]`, conf.cep || '');
    formData.append(`confirmacoesEndereco[${index}][rua]`, conf.rua || '');
    formData.append(`confirmacoesEndereco[${index}][numero]`, conf.numero || '');
    formData.append(`confirmacoesEndereco[${index}][bairro]`, conf.bairro || '');
    formData.append(`confirmacoesEndereco[${index}][cidade]`, conf.cidade || '');
    formData.append(`confirmacoesEndereco[${index}][tipoCasa]`, conf.tipoCasa || '');
    if (conf.gps) {
      formData.append(`confirmacoesEndereco[${index}][latitude]`, conf.gps.latitude);
      formData.append(`confirmacoesEndereco[${index}][longitude]`, conf.gps.longitude);
      formData.append(`confirmacoesEndereco[${index}][precisao]`, conf.gps.accuracy);
      formData.append(`confirmacoesEndereco[${index}][timestamp]`, conf.gps.timestamp);
    }
    conf.fotosCasa.forEach((photo, photoIndex) => {
      formData.append(`confirmacoesEndereco[${index}][fotos][${photoIndex}]`, photo, photo.name);
    });
  });
  formData.append('timestamp', new Date().toISOString());
  try {
    const response = await fetch('https://webhook.fazseunome.top/webhook/visita', {
      method: 'POST',
      body: formData
    });
    if (response.ok) {
      const result = await response.json().catch(() => response.text());
      console.log('Resposta do servidor:', result);
      const totalFiles = Object.values(filesData).reduce((acc, arr) => acc + arr.length, 0) +
                        addressConfirmations.reduce((acc, conf) => acc + conf.fotosCasa.length, 0);
      alert('[OK] Formulário enviado com sucesso!\n\nTodos os dados e documentos foram salvos no servidor.\n\n' + 
            'Total de arquivos enviados: ' + totalFiles +
            '\nConfirmações de endereço: ' + addressConfirmations.length);
      localStorage.removeItem('formData_section1');
      localStorage.removeItem('formData_section2');
      localStorage.removeItem('formData_files');
      localStorage.removeItem('visitLocation');
    } else {
      throw new Error(`Erro no servidor: ${response.status} - ${response.statusText}`);
    }
  } catch (error) {
    console.error('Erro ao enviar formulário:', error);
    const backupData = {
      section1: data1,
      section2: data2,
      addressConfirmations: addressConfirmations.map(c => ({
        nomeParente: c.nomeParente,
        whatsappParente: c.whatsappParente,
        qualParente: c.qualParente,
        endereco: `${c.rua}, ${c.numero} - ${c.bairro}, ${c.cidade}`,
        gps: c.gps,
        fotosCount: c.fotosCasa.length
      })),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('formData_complete_backup', JSON.stringify(backupData));
    alert('[ERRO] Erro ao enviar formulário!\n\n' + 
          'Erro: ' + error.message + '\n\n' +
          'Os dados foram salvos localmente como backup.\n' +
          'Tente novamente mais tarde ou entre em contato com o suporte.');
  }
}

function showModalForField(field) {
  modalTitle.textContent = 'Faltou preencher um campo';
  currentEmptyField = field;
  const label = field.getAttribute('data-label') || field.name;
  missingFieldEl.textContent = label;
  modal.classList.add('show');
}

function showModalForFieldFile(field) {
  modalTitle.textContent = 'Faltou enviar um documento';
  currentEmptyField = field;
  missingFieldEl.textContent = field.label;
  modal.classList.add('show');
}

function closeModal() {
  modal.classList.remove('show');
  currentEmptyField = null;
}

btnFill.addEventListener('click', () => {
  closeModal();
  if (currentEmptyField) {
    if (currentEmptyField.name && ['houseType', 'benefit', 'works', 'married', 'children', 'spouseWorks'].includes(currentEmptyField.name)) {
      const firstRadio = currentForm.querySelector(`input[name="${currentEmptyField.name}"]`);
      if (firstRadio) {
        firstRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (currentEmptyField.id) {
      const input = document.getElementById(currentEmptyField.id);
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      currentEmptyField.focus();
      currentEmptyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

btnSkip.addEventListener('click', () => {
  closeModal();
  currentIndex++;
  if (currentIndex < emptyFields.length) {
    if (currentSection === 3) {
      showModalForFieldFile(emptyFields[currentIndex]);
    } else {
      showModalForField(emptyFields[currentIndex]);
    }
  } else {
    if (currentSection === 1) submitForm1();
    else if (currentSection === 2) submitForm2();
    else if (currentSection === 3) submitForm3();
    else if (currentSection === 4) submitFormFinal();
  }
});

const cepModal = document.getElementById('cep-modal');
const cepModalAddress = document.getElementById('cep-modal-address');
const cepConfirmBtn = document.getElementById('cep-confirm');
const cepCancelBtn = document.getElementById('cep-cancel');

let currentCepData = null;
let currentCepType = null;

async function buscarCep(cep, type) {
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    return null;
  }
  
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    
    if (data.erro) {
      alert('CEP não encontrado. Verifique se digitou corretamente.');
      return null;
    }
    
    return data;
  } catch (error) {
    alert('Erro ao buscar CEP. Verifique sua conexão.');
    return null;
  }
}

function mostrarModalCep(data, type) {
  currentCepData = data;
  currentCepType = type;
  
  const endereco = `${data.logradouro}<br>${data.bairro} - ${data.localidade}/${data.uf}<br>CEP: ${data.cep}`;
  cepModalAddress.innerHTML = endereco;
  cepModal.classList.add('show');
}

function preencherCamposEndereco(data, type) {
  if (type === 'cliente') {
    document.getElementById('street').value = data.logradouro;
    document.getElementById('district').value = data.bairro;
    document.getElementById('city').value = `${data.localidade}/${data.uf}`;
    
    document.getElementById('address-fields-cliente').classList.add('visible');
    document.getElementById('address-fields-cliente-2').classList.add('visible');
    document.getElementById('address-fields-cliente-3').classList.add('visible');
    
    document.getElementById('number').focus();
  } else if (type === 'trabalho') {
    document.getElementById('workStreet').value = data.logradouro;
    document.getElementById('workDistrict').value = data.bairro;
    document.getElementById('workCity').value = `${data.localidade}/${data.uf}`;
    
    document.getElementById('address-fields-trabalho').classList.add('visible');
    document.getElementById('address-fields-trabalho-2').classList.add('visible');
    
    document.getElementById('workNumber').focus();
  } else if (type === 'trabalho-conjuge') {
    document.getElementById('spouseWorkStreet').value = data.logradouro;
    document.getElementById('spouseWorkDistrict').value = data.bairro;
    document.getElementById('spouseWorkCity').value = `${data.localidade}/${data.uf}`;
    
    document.getElementById('address-fields-trabalho-conjuge').classList.add('visible');
    document.getElementById('address-fields-trabalho-conjuge-2').classList.add('visible');
    
    document.getElementById('spouseWorkNumber').focus();
  }
}

function limparCamposEndereco(type) {
  if (type === 'cliente') {
    document.getElementById('street').value = '';
    document.getElementById('number').value = '';
    document.getElementById('district').value = '';
    document.getElementById('city').value = '';
    document.getElementById('complement').value = '';
    
    document.getElementById('address-fields-cliente').classList.remove('visible');
    document.getElementById('address-fields-cliente-2').classList.remove('visible');
    document.getElementById('address-fields-cliente-3').classList.remove('visible');
  } else if (type === 'trabalho') {
    document.getElementById('workStreet').value = '';
    document.getElementById('workNumber').value = '';
    document.getElementById('workDistrict').value = '';
    document.getElementById('workCity').value = '';
    
    document.getElementById('address-fields-trabalho').classList.remove('visible');
    document.getElementById('address-fields-trabalho-2').classList.remove('visible');
  } else if (type === 'trabalho-conjuge') {
    document.getElementById('spouseWorkStreet').value = '';
    document.getElementById('spouseWorkNumber').value = '';
    document.getElementById('spouseWorkDistrict').value = '';
    document.getElementById('spouseWorkCity').value = '';
    
    document.getElementById('address-fields-trabalho-conjuge').classList.remove('visible');
    document.getElementById('address-fields-trabalho-conjuge-2').classList.remove('visible');
  }
}

document.getElementById('cep').addEventListener('input', async function() {
  const cepLimpo = this.value.replace(/\D/g, '');
  
  if (cepLimpo.length === 0) {
    limparCamposEndereco('cliente');
  } else if (cepLimpo.length === 8) {
    const data = await buscarCep(this.value, 'cliente');
    if (data) {
      mostrarModalCep(data, 'cliente');
    }
  }
});


const workCepField = document.getElementById('workCep');
if (workCepField) {
  workCepField.addEventListener('input', async function() {
    const cepLimpo = this.value.replace(/\D/g, '');
    
    if (cepLimpo.length === 0) {
      limparCamposEndereco('trabalho');
    } else if (cepLimpo.length === 8) {
      const data = await buscarCep(this.value, 'trabalho');
      if (data) {
        mostrarModalCep(data, 'trabalho');
      }
    }
  });
}

const spouseWorkCepField = document.getElementById('spouseWorkCep');
if (spouseWorkCepField) {
  spouseWorkCepField.addEventListener('input', async function() {
    const cepLimpo = this.value.replace(/\D/g, '');
    
    if (cepLimpo.length === 0) {
      limparCamposEndereco('trabalho-conjuge');
    } else if (cepLimpo.length === 8) {
      const data = await buscarCep(this.value, 'trabalho-conjuge');
      if (data) {
        mostrarModalCep(data, 'trabalho-conjuge');
      }
    }
  });
}

cepConfirmBtn.addEventListener('click', () => {
  if (currentCepData && currentCepType) {
    preencherCamposEndereco(currentCepData, currentCepType);
  }
  cepModal.classList.remove('show');
  currentCepData = null;
  currentCepType = null;
});

cepCancelBtn.addEventListener('click', () => {
  if (currentCepType === 'cliente') {
    document.getElementById('cep').value = '';
  } else if (currentCepType === 'trabalho') {
    document.getElementById('workCep').value = '';
  } else if (currentCepType === 'trabalho-conjuge') {
    document.getElementById('spouseWorkCep').value = '';
  }
  cepModal.classList.remove('show');
  currentCepData = null;
  currentCepType = null;
});
