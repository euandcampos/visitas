import { subscribe, getState } from './state.js';

const SECTION_IDS = ['section1', 'section2', 'section3', 'section4'];
const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

let currentSection = 0;
let saveSectionsFn = null;
let removeFileFn = null;
let confirmationIndex = 0;
const autosaveTimers = new Map();

// Rastrear campo com foco para evitar autosave durante digitação
let activeInputField = null;

// Snapshot dos dados originais para prevenir sobrescrita acidental
let originalSectionData = {
  section1: null,
  section2: null,
  section4: null
};

const dom = {};
let validationModal = null;
let missingFieldEl = null;
let modalTitle = null;
let btnFill = null;
let btnSkip = null;
let cepModal = null;
let cepModalAddress = null;
let cepConfirmBtn = null;
let cepCancelBtn = null;
let permissionModal = null;

let emptyFields = [];
let currentEmptyField = null;
let currentForm = null;
let currentIndex = 0;
let pendingCepData = null;

const CEP_TYPES = {
  cliente: {
    fields: ['street', 'district', 'city'],
    groups: ['address-fields-cliente', 'address-fields-cliente-2', 'address-fields-cliente-3'],
  },
  trabalho: {
    fields: ['workStreet', 'workDistrict', 'workCity'],
    groups: ['address-fields-trabalho', 'address-fields-trabalho-2'],
  },
  'trabalho-conjuge': {
    fields: ['spouseWorkStreet', 'spouseWorkDistrict', 'spouseWorkCity'],
    groups: ['address-fields-trabalho-conjuge', 'address-fields-trabalho-conjuge-2'],
  },
};

function cacheDom() {
  dom.forms = SECTION_IDS.map((id) => document.getElementById(`form${id.replace('section', '')}`));
  dom.sections = SECTION_IDS.map((id) => document.getElementById(id));
  dom.backBtn = document.getElementById('back-btn');
  validationModal = document.getElementById('validation-modal');
  missingFieldEl = document.getElementById('missing-field');
  modalTitle = document.getElementById('modal-title');
  btnFill = document.getElementById('btn-fill');
  btnSkip = document.getElementById('btn-skip');
  cepModal = document.getElementById('cep-modal');
  cepModalAddress = document.getElementById('cep-modal-address');
  cepConfirmBtn = document.getElementById('cep-confirm');
  cepCancelBtn = document.getElementById('cep-cancel');
  permissionModal = document.getElementById('permission-modal');
  dom.addConfirmationBtn = document.getElementById('btn-add-confirmation');
  dom.confirmationsContainer = document.getElementById('confirmations-container');
}

function showSection(index) {
  dom.sections.forEach((section, idx) => {
    if (section) {
      section.classList.toggle('active', idx === index);
    }
  });
  currentSection = index;
  if (dom.backBtn) {
    dom.backBtn.style.display = index === 0 ? 'none' : 'flex';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function attachNavigation() {
  if (!dom.backBtn) return;
  dom.backBtn.addEventListener('click', () => {
    if (currentSection > 0) {
      showSection(currentSection - 1);
    }
  });
}

function applyMasks() {
  const cpf = document.getElementById('cpf');
  if (cpf) {
    cpf.addEventListener('input', () => {
      let v = cpf.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 9) cpf.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
      else if (v.length > 6) cpf.value = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
      else if (v.length > 3) cpf.value = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
      else cpf.value = v;
    });
  }

  const cep = document.getElementById('cep');
  if (cep) {
    cep.addEventListener('input', () => {
      let v = cep.value.replace(/\D/g, '').slice(0, 8);
      cep.value = v.length > 5 ? v.replace(/(\d{5})(\d{0,3})/, '$1-$2') : v;
    });
  }

  const whatsapp = document.getElementById('whatsapp');
  if (whatsapp) {
    whatsapp.addEventListener('input', () => {
      let v = whatsapp.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) whatsapp.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      else if (v.length > 2) whatsapp.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      else whatsapp.value = v;
    });
  }

  document.querySelectorAll('.conf-whatsapp').forEach((input) => {
    input.addEventListener('input', function onWhatsappInput() {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) this.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      else if (v.length > 2) this.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      else this.value = v;
    });
  });

  const moneyInputs = ['rentValue', 'benefitValue', 'income', 'spouseIncome'];
  moneyInputs.forEach((id) => {
    const input = document.getElementById(id);
    if (input) applyMoneyMask(input);
  });
}

function applyMoneyMask(input) {
  input.addEventListener('input', () => {
    let v = input.value.replace(/\D/g, '');
    if (!v) v = '0';
    v = (parseInt(v, 10) / 100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    input.value = `R$ ${v}`;
  });
  input.addEventListener('focus', () => {
    let v = input.value.replace(/\D/g, '');
    if (v === '0' || v === '00') {
      input.value = '';
    }
  });
}

function setupConditionalFields() {
  const houseTypeSelect = document.getElementById('houseType');
  const rentField = document.getElementById('rent-value-field');
  const rentInput = document.getElementById('rentValue');
  if (houseTypeSelect) {
    const toggleRent = () => {
      const v = houseTypeSelect.value;
      const isRent = v === 'casa-alugada' || v === 'ap-alugado';
      if (isRent) {
        rentField.classList.add('show');
      } else {
        rentField.classList.remove('show');
        if (rentInput) rentInput.value = '';
      }
    };
    houseTypeSelect.addEventListener('change', toggleRent);
    toggleRent();
  }

  const benefitRadios = document.querySelectorAll('input[name="benefit"]');
  const benefitField = document.getElementById('benefit-value-field');
  const benefitInput = document.getElementById('benefitValue');
  benefitRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.value === 'sim' && radio.checked) {
        benefitField.classList.add('show');
      } else {
        benefitField.classList.remove('show');
        if (benefitInput) benefitInput.value = '';
      }
    });
  });

  const worksRadios = document.querySelectorAll('input[name="works"]');
  const worksFields = document.getElementById('works-fields');
  worksRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.value === 'sim' && radio.checked) {
        worksFields.classList.add('show');
      } else {
        worksFields.classList.remove('show');
        ['companyName', 'workTime', 'workCep', 'workStreet', 'workNumber', 'workDistrict', 'workCity'].forEach((id) => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
        ['address-fields-trabalho', 'address-fields-trabalho-2'].forEach((id) => {
          const group = document.getElementById(id);
          if (group) group.classList.remove('visible');
        });
      }
    });
  });

  const marriedRadios = document.querySelectorAll('input[name="married"]');
  const spouseSection = document.getElementById('spouse-section');
  marriedRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.value === 'sim' && radio.checked) {
        spouseSection.classList.add('show');
      } else {
        spouseSection.classList.remove('show');
        spouseSection.querySelectorAll('input').forEach((input) => {
          if (input.type === 'radio') input.checked = false;
          else input.value = '';
        });
        ['address-fields-trabalho-conjuge', 'address-fields-trabalho-conjuge-2'].forEach((id) => {
          const group = document.getElementById(id);
          if (group) group.classList.remove('visible');
        });
      }
    });
  });

  const childrenRadios = document.querySelectorAll('input[name="children"]');
  const childrenFields = document.getElementById('children-fields');
  childrenRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.value === 'sim' && radio.checked) {
        childrenFields.classList.add('show');
      } else {
        childrenFields.classList.remove('show');
        ['childrenAge', 'childrenWorks'].forEach((id) => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
      }
    });
  });

  const spouseWorksRadios = document.querySelectorAll('input[name="spouseWorks"]');
  const spouseWorksFields = document.getElementById('spouse-works-fields');
  const spouseNoWorksField = document.getElementById('spouse-no-works-field');
  spouseWorksRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.value === 'sim' && radio.checked) {
        spouseWorksFields.classList.add('show');
        spouseNoWorksField.classList.remove('show');
        const sideJob = document.getElementById('spouseSideJob');
        if (sideJob) sideJob.value = '';
      } else if (radio.value === 'nao' && radio.checked) {
        spouseWorksFields.classList.remove('show');
        spouseNoWorksField.classList.add('show');
        ['spouseCompanyName', 'spouseWorkTime', 'spouseWorkCep', 'spouseWorkStreet', 'spouseWorkNumber', 'spouseWorkDistrict', 'spouseWorkCity'].forEach((id) => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
        ['address-fields-trabalho-conjuge', 'address-fields-trabalho-conjuge-2'].forEach((id) => {
          const group = document.getElementById(id);
          if (group) group.classList.remove('visible');
        });
      }
    });
  });
}

function showValidationModal(field, isFile = false) {
  if (!validationModal) return;
  modalTitle.textContent = isFile ? 'Faltou enviar um documento' : 'Faltou preencher um campo';
  missingFieldEl.textContent = field.label || field.getAttribute?.('data-label') || field.name || 'Campo';
  currentEmptyField = field;
  validationModal.classList.add('show');
}

function closeValidationModal() {
  if (validationModal) validationModal.classList.remove('show');
  currentEmptyField = null;
}

function handleFillButton() {
  closeValidationModal();
  if (!currentEmptyField) return;
  if (currentEmptyField.elementId) {
    const el = document.getElementById(currentEmptyField.elementId);
    if (el) {
      el.focus();
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  if (currentEmptyField instanceof HTMLElement) {
    currentEmptyField.focus();
    currentEmptyField.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function handleSkipButton() {
  closeValidationModal();
  currentIndex += 1;
  if (currentIndex < emptyFields.length) {
    const field = emptyFields[currentIndex];
    if (field.type === 'file') {
      showValidationModal(field, true);
    } else {
      showValidationModal(field);
    }
    return;
  }
  if (currentForm === dom.forms[0]) {
    submitSectionOne();
  } else if (currentForm === dom.forms[1]) {
    submitSectionTwo();
  } else if (currentForm === dom.forms[2]) {
    submitSectionThree();
  }
}

function gatherFormData(form) {
  const data = {};
  Array.from(new FormData(form).entries()).forEach(([key, value]) => {
    if (data[key]) {
      if (Array.isArray(data[key])) data[key].push(value);
      else data[key] = [data[key], value];
    } else {
      data[key] = value;
    }
  });
  return data;
}

function validateForm1() {
  const form = dom.forms[0];
  currentForm = form;
  emptyFields = [];
  const requiredInputs = Array.from(form.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], select')).filter((input) => input.name !== 'complement' && input.name !== 'rentValue');
  requiredInputs.forEach((field) => {
    if (!field.value.trim()) emptyFields.push(field);
  });
  const houseTypeSelected = form.querySelector('select[name="houseType"]');
  if (!houseTypeSelected || !houseTypeSelected.value) {
    emptyFields.push(createFakeField('Tipo de moradia'));
  } else if ((houseTypeSelected.value === 'casa-alugada' || houseTypeSelected.value === 'ap-alugado') && !document.getElementById('rentValue').value.trim()) {
    emptyFields.push(document.getElementById('rentValue'));
  }
  return emptyFields.length === 0;
}

function validateForm2() {
  const form = dom.forms[1];
  currentForm = form;
  emptyFields = [];
  const benefit = form.querySelector('input[name="benefit"]:checked');
  if (!benefit) emptyFields.push(createFakeField('Recebe benefício'));
  else if (benefit.value === 'sim' && !document.getElementById('benefitValue').value.trim()) emptyFields.push(document.getElementById('benefitValue'));

  const works = form.querySelector('input[name="works"]:checked');
  if (!works) emptyFields.push(createFakeField('Trabalha registrado'));
  else if (works.value === 'sim') {
    ['companyName', 'workTime', 'workCep'].forEach((id) => {
      const input = document.getElementById(id);
      if (input && !input.value.trim()) emptyFields.push(input);
    });
  }

  if (!document.getElementById('profession').value.trim()) emptyFields.push(document.getElementById('profession'));
  if (!document.getElementById('income').value.trim()) emptyFields.push(document.getElementById('income'));

  const married = form.querySelector('input[name="married"]:checked');
  if (!married) emptyFields.push(createFakeField('Casado(a)'));

  const children = form.querySelector('input[name="children"]:checked');
  if (!children) emptyFields.push(createFakeField('Tem filhos'));
  else if (children.value === 'sim') {
    ['childrenAge', 'childrenWorks'].forEach((id) => {
      const input = document.getElementById(id);
      if (input && !input.value.trim()) emptyFields.push(input);
    });
  }

  if (married && married.value === 'sim') {
    const spouseWorks = form.querySelector('input[name="spouseWorks"]:checked');
    if (!spouseWorks) emptyFields.push(createFakeField('Marido/esposa trabalha registrado'));
    else if (spouseWorks.value === 'sim') {
      ['spouseCompanyName', 'spouseWorkTime', 'spouseWorkCep'].forEach((id) => {
        const input = document.getElementById(id);
        if (input && !input.value.trim()) emptyFields.push(input);
      });
    } else if (spouseWorks.value === 'nao') {
      const sideJob = document.getElementById('spouseSideJob');
      if (sideJob && !sideJob.value.trim()) emptyFields.push(sideJob);
    }
    ['spouseProfession', 'spouseIncome'].forEach((id) => {
      const input = document.getElementById(id);
      if (input && !input.value.trim()) emptyFields.push(input);
    });
  }

  return emptyFields.length === 0;
}

function validateForm3() {
  const requiredFields = [
    { id: 'fotoCasa', label: 'Foto da casa' },
    { id: 'fotoCliente', label: 'Foto do cliente segurando o RG' },
    { id: 'comprovanteResidencia', label: 'Comprovante de residência/IPTU' },
    { id: 'carteiraTrabalho', label: 'Carteira de trabalho' },
    { id: 'holerite', label: 'Holerite' },
    { id: 'extratoBeneficio', label: 'Extrato do benefício' },
    { id: 'rg', label: 'RG frente/verso' },
    { id: 'redesSociais', label: 'Redes sociais' },
  ];
  const fileCounts = requiredFields.map((field) => {
    const counter = document.getElementById(`count-${field.id}`);
    const count = counter ? parseInt(counter.textContent, 10) || 0 : 0;
    return { ...field, count };
  });
  emptyFields = fileCounts.filter((field) => field.count === 0).map((field) => ({ ...field, type: 'file' }));
  currentForm = dom.forms[2];
  return emptyFields.length === 0;
}

function createFakeField(label) {
  return {
    type: 'fake',
    label,
    elementId: null,
  };
}

function submitSectionOne() {
  const formData = gatherFormData(dom.forms[0]);
  saveSectionsFn({ section1: formData }, { metadata: { step: 'section1', lastStepAt: new Date().toISOString() } });
  showSection(1);
}

function submitSectionTwo() {
  const formData = gatherFormData(dom.forms[1]);
  saveSectionsFn({ section2: formData }, { metadata: { step: 'section2', lastStepAt: new Date().toISOString() } });
  showSection(2);
}

function submitSectionThree() {
  saveSectionsFn({ section3: {} }, { metadata: { step: 'section3', lastStepAt: new Date().toISOString() } });
  showSection(3);
}

function submitSectionFour(event) {
  event.preventDefault();
  const container = document.getElementById('confirmations-container');
  const items = container ? Array.from(container.children) : [];
  const confirmations = [];
  for (const item of items) {
    const nome = item.querySelector('.conf-name').value.trim();
    const whatsapp = item.querySelector('.conf-whatsapp').value.trim();
    const relation = item.querySelector('.conf-relation').value.trim();
    const cep = item.querySelector('.conf-cep').value.replace(/\D/g, '');
    const numero = item.querySelector('.conf-number').value.trim();
    const tipoCasaEl = item.querySelector('.conf-house-select');
    const tipoCasa = tipoCasaEl ? { value: tipoCasaEl.value } : null;
    const counter = item.querySelector('.conf-count');
    const gpsInfo = item.dataset.gpsLat ? true : false;
    const fieldId = item.dataset.fieldId;
    const filesCount = counter ? parseInt(counter.textContent, 10) || 0 : 0;
    if (!nome || !whatsapp || !relation || cep.length !== 8 || !numero || !tipoCasa || !tipoCasa.value || filesCount === 0 || !gpsInfo) {
      alert('Complete todos os campos das confirmações de endereço antes de finalizar.');
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    confirmations.push({
      nome,
      whatsapp,
      qualParente: relation,
      cep,
      numero,
      rua: item.querySelector('.conf-street').value,
      bairro: item.querySelector('.conf-district').value,
      cidade: item.querySelector('.conf-city').value,
      tipoCasa: tipoCasa.value,
      filesField: fieldId,
      gps: {
        latitude: parseFloat(item.dataset.gpsLat),
        longitude: parseFloat(item.dataset.gpsLng),
        accuracy: parseFloat(item.dataset.gpsAccuracy),
        timestamp: item.dataset.gpsTimestamp,
      },
    });
  }
  saveSectionsFn({ section4: { confirmations } }, { status: 'salva', markSaved: true, metadata: { step: 'section4', lastStepAt: new Date().toISOString() } });
  // garantir atualização de listas pós-salvar
  try {
    const evt = new CustomEvent('visita-salva');
    window.dispatchEvent(evt);
  } catch (_) {}
  alert('Visita salva com sucesso! Envie quando desejar pelo menu.');
}

function collectConfirmations() {
  const container = dom.confirmationsContainer;
  if (!container) return [];
  const items = Array.from(container.children);
  return items.map((item) => ({
    nome: item.querySelector('.conf-name')?.value || '',
    whatsapp: item.querySelector('.conf-whatsapp')?.value || '',
    qualParente: item.querySelector('.conf-relation')?.value || '',
    cep: item.querySelector('.conf-cep')?.value || '',
    numero: item.querySelector('.conf-number')?.value || '',
    rua: item.querySelector('.conf-street')?.value || '',
    bairro: item.querySelector('.conf-district')?.value || '',
    cidade: item.querySelector('.conf-city')?.value || '',
    tipoCasa: item.querySelector('.conf-house-select')?.value || '',
    filesField: item.dataset.fieldId,
    gps: item.dataset.gpsLat
      ? {
          latitude: parseFloat(item.dataset.gpsLat),
          longitude: parseFloat(item.dataset.gpsLng),
          accuracy: parseFloat(item.dataset.gpsAccuracy),
          timestamp: item.dataset.gpsTimestamp,
        }
      : null,
  }));
}

function hasChanged(newData, oldData) {
  if (!oldData) return true; // Primeira vez, sempre salva
  
  // Remove campos vazios do newData
  const cleanNew = {};
  for (const [key, value] of Object.entries(newData)) {
    if (value !== '' && value !== null && value !== undefined) {
      cleanNew[key] = value;
    }
  }
  
  // Se cleanNew está vazio, não houve digitação real
  if (Object.keys(cleanNew).length === 0) {
    console.log('[autosave] Dados vazios, ignorando');
    return false;
  }
  
  // Compara se algum campo mudou
  for (const key of Object.keys(cleanNew)) {
    if (cleanNew[key] !== oldData[key]) {
      console.log('[autosave] Campo alterado:', key, oldData[key], '→', cleanNew[key]);
      return true;
    }
  }
  
  console.log('[autosave] Nenhuma mudança real detectada');
  return false;
}

function scheduleAutosave(sectionKey) {
  if (!saveSectionsFn) return;
  
  // NÃO autosalvar se um campo está com foco (usuário está digitando)
  if (activeInputField) {
    console.log('[autosave] Adiando autosave - campo com foco:', activeInputField.name || activeInputField.className);
    return;
  }
  
  if (autosaveTimers.has(sectionKey)) {
    clearTimeout(autosaveTimers.get(sectionKey));
  }
  const timer = setTimeout(() => {
    performAutosave(sectionKey);
  }, 800);
  autosaveTimers.set(sectionKey, timer);
}

function performAutosave(sectionKey) {
  autosaveTimers.delete(sectionKey);
  const timestamp = new Date().toISOString();
  
  if (sectionKey === 'section1') {
    const data = gatherFormData(dom.forms[0]);
    
    // ✅ Só salva se houve mudança real
    if (!hasChanged(data, originalSectionData.section1)) {
      console.log('[autosave] Section1: sem mudanças, ignorando');
      return;
    }
    
    saveSectionsFn({ section1: data }, { metadata: { autosaveAt: timestamp } });
    // Atualiza snapshot após salvar
    originalSectionData.section1 = JSON.parse(JSON.stringify(data));
    
  } else if (sectionKey === 'section2') {
    const data = gatherFormData(dom.forms[1]);
    
    // ✅ Só salva se houve mudança real
    if (!hasChanged(data, originalSectionData.section2)) {
      console.log('[autosave] Section2: sem mudanças, ignorando');
      return;
    }
    
    saveSectionsFn({ section2: data }, { metadata: { autosaveAt: timestamp } });
    // Atualiza snapshot após salvar
    originalSectionData.section2 = JSON.parse(JSON.stringify(data));
    
  } else if (sectionKey === 'section4') {
    const confirmations = collectConfirmations();
    const currentData = { confirmations };
    
    // ✅ Só salva se houve mudança real (compara JSON stringified)
    const currentJson = JSON.stringify(currentData);
    const originalJson = JSON.stringify(originalSectionData.section4 || {});
    
    if (currentJson === originalJson) {
      console.log('[autosave] Section4: sem mudanças, ignorando');
      return;
    }
    
    saveSectionsFn({ section4: currentData }, { metadata: { autosaveAt: timestamp } });
    // Atualiza snapshot após salvar
    originalSectionData.section4 = JSON.parse(currentJson);
  }
}

function attachFormHandlers() {
  dom.forms[0].addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateForm1()) {
      submitSectionOne();
    } else {
      currentIndex = 0;
      showValidationModal(emptyFields[currentIndex]);
    }
  });

  dom.forms[1].addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateForm2()) {
      submitSectionTwo();
    } else {
      currentIndex = 0;
      showValidationModal(emptyFields[currentIndex]);
    }
  });

  dom.forms[2].addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateForm3()) {
      submitSectionThree();
    } else {
      currentIndex = 0;
      showValidationModal(emptyFields[currentIndex], true);
    }
  });

  dom.forms[3].addEventListener('submit', submitSectionFour);

  dom.forms[0].addEventListener('input', () => scheduleAutosave('section1'));
  dom.forms[0].addEventListener('change', () => scheduleAutosave('section1'));
  dom.forms[1].addEventListener('input', () => scheduleAutosave('section2'));
  dom.forms[1].addEventListener('change', () => scheduleAutosave('section2'));
  dom.forms[3].addEventListener('input', () => scheduleAutosave('section4'));
  dom.forms[3].addEventListener('change', () => scheduleAutosave('section4'));
}

async function buscarCep(cep) {
  console.log('[CEP] 🔍 Iniciando busca para:', cep);
  const clean = cep.replace(/\D/g, '');
  
  if (clean.length !== 8) {
    console.log('[CEP] ⚠️ CEP inválido, comprimento:', clean.length, '(esperado: 8)');
    return null;
  }
  
  try {
    console.log('[CEP] 🌐 Chamando API ViaCEP para:', clean);
    const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    
    if (!response.ok) {
      console.error('[CEP] ❌ Erro HTTP:', response.status, response.statusText);
      throw new Error(`Erro na API: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[CEP] 📦 Resposta recebida:', data);
    
    if (data.erro) {
      console.error('[CEP] ❌ CEP não encontrado na base ViaCEP');
      throw new Error('CEP não encontrado');
    }
    
    console.log('[CEP] ✅ CEP válido! Endereço:', data.logradouro, '-', data.bairro, '-', data.localidade);
    return data;
  } catch (error) {
    console.error('[CEP] ❌ Erro na busca:', error.message);
    throw error;
  }
}

function attachCepHandlers() {
  const clienteCep = document.getElementById('cep');
  if (clienteCep) {
    clienteCep.addEventListener('input', async function onCepInput() {
      const clean = this.value.replace(/\D/g, '');
      if (clean.length === 0) {
        limparCamposEndereco('cliente');
      } else if (clean.length === 8) {
        try {
          const data = await buscarCep(this.value);
          pendingCepData = { data, type: 'cliente' };
          mostrarCepModal(data);
        } catch (error) {
          alert(error.message || 'Erro ao buscar CEP');
        }
      }
    });
  }

  const workCep = document.getElementById('workCep');
  if (workCep) {
    workCep.addEventListener('input', async function onWorkCep() {
      const clean = this.value.replace(/\D/g, '');
      if (clean.length === 0) {
        limparCamposEndereco('trabalho');
      } else if (clean.length === 8) {
        try {
          const data = await buscarCep(this.value);
          pendingCepData = { data, type: 'trabalho' };
          mostrarCepModal(data);
        } catch (error) {
          alert(error.message || 'Erro ao buscar CEP');
        }
      }
    });
  }

  const spouseWorkCep = document.getElementById('spouseWorkCep');
  if (spouseWorkCep) {
    spouseWorkCep.addEventListener('input', async function onSpouseCep() {
      const clean = this.value.replace(/\D/g, '');
      if (clean.length === 0) {
        limparCamposEndereco('trabalho-conjuge');
      } else if (clean.length === 8) {
        try {
          const data = await buscarCep(this.value);
          pendingCepData = { data, type: 'trabalho-conjuge' };
          mostrarCepModal(data);
        } catch (error) {
          alert(error.message || 'Erro ao buscar CEP');
        }
      }
    });
  }

  cepConfirmBtn.addEventListener('click', () => {
    if (pendingCepData) {
      preencherCamposEndereco(pendingCepData.data, pendingCepData.type);
      pendingCepData = null;
    }
    cepModal.classList.remove('show');
  });

  cepCancelBtn.addEventListener('click', () => {
    if (pendingCepData) {
      if (pendingCepData.type === 'cliente') document.getElementById('cep').value = '';
      if (pendingCepData.type === 'trabalho') document.getElementById('workCep').value = '';
      if (pendingCepData.type === 'trabalho-conjuge') document.getElementById('spouseWorkCep').value = '';
    }
    pendingCepData = null;
    cepModal.classList.remove('show');
  });
}

function mostrarCepModal(data) {
  console.log('[CEP] 📋 Exibindo modal de confirmação');
  const endereco = `${data.logradouro}<br>${data.bairro} - ${data.localidade}/${data.uf}<br>CEP: ${data.cep}`;
  cepModalAddress.innerHTML = endereco;
  cepModal.classList.add('show');
  console.log('[CEP] ✅ Modal exibido com sucesso');
}

function preencherCamposEndereco(data, type) {
  console.log('[CEP] 📝 Preenchendo campos de endereço, tipo:', type);
  const config = CEP_TYPES[type];
  if (!config) {
    console.error('[CEP] ❌ Tipo de CEP inválido:', type);
    return;
  }
  
  const fieldIds = {
    cliente: ['street', 'district', 'city'],
    trabalho: ['workStreet', 'workDistrict', 'workCity'],
    'trabalho-conjuge': ['spouseWorkStreet', 'spouseWorkDistrict', 'spouseWorkCity'],
  }[type];
  
  if (fieldIds) {
    console.log('[CEP] ✏️ Preenchendo campos:', fieldIds);
    document.getElementById(fieldIds[0]).value = data.logradouro || '';
    document.getElementById(fieldIds[1]).value = data.bairro || '';
    document.getElementById(fieldIds[2]).value = `${data.localidade}/${data.uf}`;
  }
  
  config.groups.forEach((id) => {
    const group = document.getElementById(id);
    if (group) {
      group.classList.add('visible');
      console.log('[CEP] 👁️ Exibindo grupo:', id);
    }
  });
  
  const numberInputId = {
    cliente: 'number',
    trabalho: 'workNumber',
    'trabalho-conjuge': 'spouseWorkNumber',
  }[type];
  
  if (numberInputId) {
    const input = document.getElementById(numberInputId);
    if (input) {
      input.focus();
      console.log('[CEP] 🎯 Foco movido para campo número');
    }
  }
  
  console.log('[CEP] ✅ Campos preenchidos com sucesso');
}

function limparCamposEndereco(type) {
  const config = CEP_TYPES[type];
  if (!config) return;
  const fieldIds = {
    cliente: ['street', 'district', 'city', 'number', 'complement'],
    trabalho: ['workStreet', 'workDistrict', 'workCity', 'workNumber'],
    'trabalho-conjuge': ['spouseWorkStreet', 'spouseWorkDistrict', 'spouseWorkCity', 'spouseWorkNumber'],
  }[type];
  if (fieldIds) {
    fieldIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
  }
  config.groups.forEach((id) => {
    const group = document.getElementById(id);
    if (group) group.classList.remove('visible');
  });
}

function populateForm(visit) {
  if (!visit) {
    // Limpa snapshots se não há visita
    originalSectionData.section1 = null;
    originalSectionData.section2 = null;
    originalSectionData.section4 = null;
    return;
  }
  
  const section1 = visit.sections.section1 || {};
  const section2 = visit.sections.section2 || {};
  
  // ✅ Guardar snapshot dos dados originais para prevenir sobrescrita
  originalSectionData.section1 = JSON.parse(JSON.stringify(section1));
  originalSectionData.section2 = JSON.parse(JSON.stringify(section2));
  originalSectionData.section4 = JSON.parse(JSON.stringify(visit.sections.section4 || {}));
  console.log('[forms] Snapshot criado para prevenir perda de dados');
  
  document.getElementById('rent-value-field')?.classList.remove('show');
  document.getElementById('benefit-value-field')?.classList.remove('show');
  document.getElementById('works-fields')?.classList.remove('show');
  document.getElementById('spouse-section')?.classList.remove('show');
  document.getElementById('children-fields')?.classList.remove('show');
  document.getElementById('spouse-works-fields')?.classList.remove('show');
  document.getElementById('spouse-no-works-field')?.classList.remove('show');
  ['address-fields-trabalho', 'address-fields-trabalho-2', 'address-fields-trabalho-conjuge', 'address-fields-trabalho-conjuge-2', 'address-fields-cliente', 'address-fields-cliente-2', 'address-fields-cliente-3'].forEach((id) => {
    document.getElementById(id)?.classList.remove('visible');
  });
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach((input) => {
    const name = input.name;
    if (!name) return;
    const section = SECTION_IDS.find((sectionId) => visit.sections[sectionId]?.hasOwnProperty(name));
    if (!section) return;
    const value = visit.sections[section][name];
    if (input.type === 'radio') {
      input.checked = input.value === value;
    } else if (input.tagName === 'SELECT') {
      input.value = value || '';
    } else if (input.type !== 'file') {
      input.value = value || '';
    }
  });

  if (section1.cep && section1.cep.replace(/\D/g, '').length === 8) {
    ['address-fields-cliente', 'address-fields-cliente-2', 'address-fields-cliente-3'].forEach((id) => document.getElementById(id)?.classList.add('visible'));
  }
  if (section1.houseType === 'casa-alugada' || section1.houseType === 'ap-alugado') {
    document.getElementById('rent-value-field').classList.add('show');
  }
  if (section2.benefit === 'sim') {
    document.getElementById('benefit-value-field').classList.add('show');
  }
  if (section2.works === 'sim') {
    document.getElementById('works-fields').classList.add('show');
    ['address-fields-trabalho', 'address-fields-trabalho-2'].forEach((id) => document.getElementById(id)?.classList.add('visible'));
  }
  if (section2.married === 'sim') {
    document.getElementById('spouse-section').classList.add('show');
  }
  if (section2.children === 'sim') {
    document.getElementById('children-fields').classList.add('show');
  }
  if (section2.spouseWorks === 'sim') {
    document.getElementById('spouse-works-fields').classList.add('show');
    ['address-fields-trabalho-conjuge', 'address-fields-trabalho-conjuge-2'].forEach((id) => document.getElementById(id)?.classList.add('visible'));
  } else if (section2.spouseWorks === 'nao') {
    document.getElementById('spouse-no-works-field').classList.add('show');
  }

  if (dom.confirmationsContainer) {
    dom.confirmationsContainer.innerHTML = '';
    const confirmations = visit.sections.section4?.confirmations || [];
    confirmations.forEach((conf) => {
      createConfirmationItem({
        nome: conf.nome,
        whatsapp: conf.whatsapp,
        relation: conf.qualParente,
        cep: conf.cep,
        numero: conf.numero,
        tipoCasa: conf.tipoCasa,
        filesField: conf.filesField,
        endereco: {
          logradouro: conf.rua,
          bairro: conf.bairro,
          cidade: conf.cidade,
        },
        gps: conf.gps,
      });
    });
  }
}

function createConfirmationItem(prefill = {}) {
  const template = document.getElementById('confirmation-template');
  if (!template || !dom.confirmationsContainer) return null;
  const clone = template.content.firstElementChild.cloneNode(true);
  const confirmationId = `conf-${confirmationIndex++}`;
  const fieldId = prefill.filesField || `confirmation-${generateId()}`;
  clone.dataset.confirmationId = confirmationId;
  clone.dataset.fieldId = fieldId;

  const fileInput = clone.querySelector('.conf-file-input');
  const preview = clone.querySelector('.conf-preview');
  const counter = clone.querySelector('.conf-count');
  const uploadBtn = clone.querySelector('.conf-upload-btn');

  if (fileInput) {
    const inputId = `${fieldId}-input`;
    fileInput.dataset.fieldId = fieldId;
    fileInput.id = inputId;
    if (uploadBtn) uploadBtn.setAttribute('for', inputId);
  }
  if (preview) {
    preview.dataset.previewField = fieldId;
  }
  if (counter) {
    counter.dataset.counterField = fieldId;
  }

  const houseSelect = clone.querySelector('.conf-house-select');

  const cepInput = clone.querySelector('.conf-cep');
  if (cepInput) {
    if (prefill.cep) {
      cepInput.value = prefill.cep;
    }
    cepInput.addEventListener('input', async function onCep() {
      let val = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = val.length > 5 ? val.replace(/(\d{5})(\d{0,3})/, '$1-$2') : val;
      if (val.length === 8) {
        try {
          const data = await buscarCep(this.value);
          preencherCamposConfirmacao(clone, data);
        } catch (error) {
          alert(error.message || 'Erro ao buscar CEP');
        }
      }
    });
  }

  const whatsappInput = clone.querySelector('.conf-whatsapp');
  if (whatsappInput) {
    if (prefill.whatsapp) whatsappInput.value = prefill.whatsapp;
    whatsappInput.addEventListener('input', function onWhatsapp() {
      let v = this.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 6) this.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
      else if (v.length > 2) this.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
      else this.value = v;
    });
  }

  const nameInput = clone.querySelector('.conf-name');
  if (nameInput && prefill.nome) nameInput.value = prefill.nome;
  const relationInput = clone.querySelector('.conf-relation');
  if (relationInput && prefill.relation) relationInput.value = prefill.relation;
  const numberInput = clone.querySelector('.conf-number');
  if (numberInput && prefill.numero) numberInput.value = prefill.numero;

  if (prefill.tipoCasa && houseSelect) {
    houseSelect.value = prefill.tipoCasa;
  }

  const removeBtn = clone.querySelector('.btn-remove-confirmation');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (removeFileFn) {
        const state = getState();
        const entries = state.activeVisit?.files?.[fieldId] || [];
        for (const entry of entries) {
          await removeFileFn(fieldId, entry.localId);
        }
      }
      clone.remove();
      scheduleAutosave('section4');
    });
  }

  const gpsButton = clone.querySelector('.conf-gps-btn');
  const gpsInfo = clone.querySelector('.conf-gps-info');
  if (gpsButton && gpsInfo) {
    gpsButton.addEventListener('click', () => {
      gpsButton.textContent = '[GPS] Capturando...';
      gpsButton.classList.add('capturing');
      gpsButton.disabled = true;
      if (!navigator.geolocation) {
        gpsButton.textContent = '[X] GPS não disponível';
        gpsButton.classList.remove('capturing');
        gpsButton.disabled = false;
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          gpsButton.textContent = '[OK] GPS Capturado!';
          gpsButton.classList.remove('capturing');
          gpsButton.classList.add('success');
          gpsButton.disabled = false;
          const { latitude, longitude, accuracy } = position.coords;
          gpsInfo.style.display = 'block';
          gpsInfo.innerHTML = `
            <strong>GPS Capturado</strong><br>
            Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}<br>
            Precisão: ${accuracy.toFixed(1)}m
          `;
          clone.dataset.gpsLat = latitude;
          clone.dataset.gpsLng = longitude;
          clone.dataset.gpsAccuracy = accuracy;
          clone.dataset.gpsTimestamp = new Date().toISOString();
          scheduleAutosave('section4');
        },
        (error) => {
          console.error('[gps] erro confirmação', error);
          gpsButton.textContent = '[X] Erro ao capturar';
          gpsButton.classList.remove('capturing');
          gpsButton.disabled = false;
          alert('Erro ao capturar GPS. Verifique se permitiu acesso.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  }

  if (prefill.endereco && (prefill.endereco.logradouro || prefill.endereco.bairro || prefill.endereco.cidade)) {
    preencherCamposConfirmacao(clone, {
      logradouro: prefill.endereco.logradouro,
      bairro: prefill.endereco.bairro,
      cidade: prefill.endereco.cidade,
    }, { skipAutosave: true });
  }

  if (prefill.gps && gpsInfo) {
    clone.dataset.gpsLat = prefill.gps.latitude;
    clone.dataset.gpsLng = prefill.gps.longitude;
    clone.dataset.gpsAccuracy = prefill.gps.accuracy;
    clone.dataset.gpsTimestamp = prefill.gps.timestamp;
    gpsButton.textContent = '[OK] GPS Capturado!';
    gpsButton.classList.add('success');
    gpsInfo.style.display = 'block';
    gpsInfo.innerHTML = `
      <strong>GPS Capturado</strong><br>
      Lat: ${prefill.gps.latitude.toFixed(6)}, Long: ${prefill.gps.longitude.toFixed(6)}<br>
      Precisão: ${prefill.gps.accuracy.toFixed(1)}m
    `;
  }

  dom.confirmationsContainer.appendChild(clone);
  if (Object.keys(prefill).length === 0) {
    scheduleAutosave('section4');
  }
  return clone;
}

function setupConfirmations() {
  if (!dom.addConfirmationBtn || !dom.confirmationsContainer) return;
  dom.addConfirmationBtn.addEventListener('click', () => {
    createConfirmationItem();
  });
}

function preencherCamposConfirmacao(container, data, options = {}) {
  const cidade = data.cidade || `${data.localidade || ''}/${data.uf || ''}`;
  container.querySelector('.conf-street').value = data.logradouro || '';
  container.querySelector('.conf-district').value = data.bairro || '';
  container.querySelector('.conf-city').value = cidade;
  container.querySelector('.conf-address-1').style.display = 'grid';
  container.querySelector('.conf-address-2').style.display = 'grid';
  container.querySelector('.conf-address-3').style.display = 'block';
  // Não fazer focus() automaticamente para não roubar o foco de outros campos
  // const numberInput = container.querySelector('.conf-number');
  // if (numberInput) numberInput.focus();
  if (!options.skipAutosave) {
    scheduleAutosave('section4');
  }
}

export function initFormNavigation({ saveSections, removeFile }) {
  saveSectionsFn = saveSections;
  removeFileFn = removeFile;
  cacheDom();
  applyMasks();
  setupConditionalFields();
  attachNavigation();
  attachFormHandlers();
  attachCepHandlers();
  setupConfirmations();

  if (btnFill) btnFill.addEventListener('click', handleFillButton);
  if (btnSkip) btnSkip.addEventListener('click', handleSkipButton);

  // Rastrear foco em campos para prevenir autosave durante digitação
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input, textarea, select')) {
      activeInputField = e.target;
      console.log('[focus] Campo ganhou foco:', e.target.name || e.target.className);
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target === activeInputField) {
      console.log('[focus] Campo perdeu foco:', e.target.name || e.target.className);
      activeInputField = null;
      
      // Disparar autosave após perder o foco (usuário terminou de digitar)
      const section = e.target.closest('[id^="section"]');
      if (section) {
        const sectionId = section.id;
        if (sectionId === 'section1' || sectionId === 'section2' || sectionId === 'section4') {
          console.log('[focus] Agendando autosave após perda de foco');
          setTimeout(() => scheduleAutosave(sectionId), 100);
        }
      }
    }
  });

  subscribe((state) => {
    populateForm(state.activeVisit);
  });

  showSection(0);
}

