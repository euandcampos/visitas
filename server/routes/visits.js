const express = require('express');
const multer = require('multer');
const path = require('path');
const fse = require('fs-extra');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const axios = require('axios');

const storage = require('../lib/storage');

const router = express.Router();

function parseSections(sections) {
  if (!sections || typeof sections !== 'object') return {};
  const allowed = ['section1', 'section2', 'section3', 'section4'];
  return allowed.reduce((acc, key) => {
    if (sections[key] && typeof sections[key] === 'object') {
      acc[key] = sections[key];
    }
    return acc;
  }, {});
}

router.post('/', async (req, res, next) => {
  try {
    const { sections, status, metadata, createdBy } = req.body || {};
    const visit = await storage.createVisit({
      sections: parseSections(sections),
      status: status || 'rascunho',
      createdBy: createdBy || null,
      initialData: { metadata: metadata || {} },
    });
    res.status(201).json(visit);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const visits = await storage.listVisits(status);
    res.json(visits);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const visit = await storage.loadVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: 'Visita não encontrada' });
    }

    const filesDir = storage.getVisitFilesDir(req.params.id);
    const enhancedFiles = {};
    for (const [field, files] of Object.entries(visit.files || {})) {
      enhancedFiles[field] = files.map((file) => ({
        ...file,
        downloadUrl: `/api/visits/${visit.id}/files/${file.id}?field=${encodeURIComponent(field)}`,
      }));
    }

    res.json({
      ...visit,
      files: enhancedFiles,
      paths: {
        files: filesDir,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { sections, status, metadata, markSaved } = req.body || {};
    const visit = await storage.saveSections(
      req.params.id,
      parseSections(sections),
      {
        status: status || (markSaved ? 'salva' : undefined),
        metadata,
        appendHistory: {
          type: markSaved ? 'save' : 'autosave',
          at: new Date().toISOString(),
          by: req.body.updatedBy || null,
        },
      },
    );
    res.json(visit);
  } catch (error) {
    if (error.message === 'Visita não encontrada') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await storage.deleteVisit(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const field = req.body.field;
        if (!field) {
          return cb(new Error('Campo "field" é obrigatório'));
        }
        const visit = await storage.loadVisit(req.params.id);
        if (!visit) {
          return cb(new Error('Visita não encontrada'));
        }
        const dir = await storage.ensureFilesStructure(req.params.id, field);
        cb(null, dir);
      } catch (error) {
        cb(error);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB por arquivo
    files: 10,
  },
});

router.post('/:id/files', upload.array('files', 10), async (req, res, next) => {
  try {
    const visit = await storage.loadVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: 'Visita não encontrada' });
    }
    const field = req.body.field;
    if (!field) {
      return res.status(400).json({ error: 'Campo "field" é obrigatório' });
    }

    const filesMeta = [];
    for (const file of req.files || []) {
      const meta = {
        id: uuidv4(),
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };
      await storage.addFile(req.params.id, field, meta);
      filesMeta.push({
        ...meta,
        downloadUrl: `/api/visits/${req.params.id}/files/${meta.id}?field=${encodeURIComponent(field)}`,
      });
    }

    res.status(201).json({
      field,
      files: filesMeta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/files/:fileId', async (req, res, next) => {
  try {
    const { id, fileId } = req.params;
    const { field } = req.query;
    if (!field) {
      return res.status(400).json({ error: 'Campo "field" é obrigatório' });
    }

    const visit = await storage.loadVisit(id);
    if (!visit) {
      return res.status(404).json({ error: 'Visita não encontrada' });
    }
    const fieldFiles = (visit.files || {})[field] || [];
    const fileInfo = fieldFiles.find((file) => file.id === fileId);
    if (!fileInfo) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    const filePath = path.join(storage.getVisitFilesDir(id), field, fileInfo.filename);
    if (!(await fse.pathExists(filePath))) {
      return res.status(410).json({ error: 'Arquivo não está mais disponível' });
    }

    res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileInfo.originalName)}"`);
    
    const fileBuffer = await fse.readFile(filePath);
    return res.send(fileBuffer);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/files/:fileId', async (req, res, next) => {
  try {
    const { id, fileId } = req.params;
    const { field } = req.query;
    if (!field) {
      return res.status(400).json({ error: 'Campo "field" é obrigatório' });
    }
    const removed = await storage.removeFile(id, field, fileId);
    if (!removed) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    res.json({ removed });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  const visitId = req.params.id;
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'WEBHOOK_URL não configurada' });
  }
  try {
    const visit = await storage.loadVisit(visitId);
    if (!visit) {
      return res.status(404).json({ error: 'Visita não encontrada' });
    }

    const attemptsInfo = {
      attempts: (visit.webhook?.attempts || 0) + 1,
      lastAttemptAt: new Date().toISOString(),
      lastStatus: 'enviando',
    };
    await storage.markStatus(visitId, 'enviando', { webhook: attemptsInfo });

    function buildFormData(v) {
      const form = new FormData();
      const section1 = v.sections.section1 || {};
      const section2 = v.sections.section2 || {};
      const section4 = v.sections.section4 || {};

      const appendIf = (key, value) => {
        if (value !== undefined && value !== null && value !== '') {
          form.append(key, value);
        }
      };

      appendIf('nomeMotoboy', section1.sender);
      appendIf('nomeCliente', section1.clientName);
      appendIf('idadeCliente', section1.age);
      appendIf('cpfCliente', section1.cpf);
      appendIf('whatsappCliente', section1.whatsapp);
      appendIf('ruaCliente', section1.street);
      appendIf('numeroCliente', section1.number);
      appendIf('bairroCliente', section1.district);
      appendIf('cidadeCliente', section1.city);
      appendIf('cepCliente', section1.cep);
      appendIf('complementoCliente', section1.complement);
      appendIf('quantasPessoasMoram', section1.residents);
      appendIf('tipoCasa', section1.houseType);
      appendIf('valorAluguel', section1.rentValue);

      if (section1.localizacaoVisita) {
        appendIf('latitudeVisita', section1.localizacaoVisita.latitude);
        appendIf('longitudeVisita', section1.localizacaoVisita.longitude);
        appendIf('precisaoVisita', section1.localizacaoVisita.precisao);
        appendIf('timestampVisita', section1.localizacaoVisita.timestamp);
        appendIf('linkMapsVisita', section1.localizacaoVisita.linkMaps);
      }

      appendIf('recebeBeneficio', section2.benefit);
      appendIf('valorBeneficio', section2.benefitValue);
      appendIf('trabalhaRegistrado', section2.works);
      appendIf('nomeEmpresa', section2.companyName);
      appendIf('tempoRegistro', section2.workTime);
      appendIf('cepTrabalho', section2.workCep);
      appendIf('ruaTrabalho', section2.workStreet);
      appendIf('numeroTrabalho', section2.workNumber);
      appendIf('bairroTrabalho', section2.workDistrict);
      appendIf('cidadeTrabalho', section2.workCity);
      appendIf('profissao', section2.profession);
      appendIf('rendaMensal', section2.income);
      appendIf('casado', section2.married);
      appendIf('temFilhos', section2.children);
      appendIf('idadeFilhos', section2.childrenAge);
      appendIf('filhoTrabalhaRegistrado', section2.childrenWorks);
      appendIf('conjugeTrabalhaRegistrado', section2.spouseWorks);
      appendIf('nomeEmpresaConjuge', section2.spouseCompanyName);
      appendIf('tempoRegistroConjuge', section2.spouseWorkTime);
      appendIf('cepTrabalhoConjuge', section2.spouseWorkCep);
      appendIf('ruaTrabalhoConjuge', section2.spouseWorkStreet);
      appendIf('numeroTrabalhoConjuge', section2.spouseWorkNumber);
      appendIf('bairroTrabalhoConjuge', section2.spouseWorkDistrict);
      appendIf('cidadeTrabalhoConjuge', section2.spouseWorkCity);
      appendIf('conjugeFazBico', section2.spouseSideJob);
      appendIf('profissaoConjuge', section2.spouseProfession);
      appendIf('rendaMensalConjuge', section2.spouseIncome);

      const confirmations = Array.isArray(section4.confirmations) ? section4.confirmations : [];
      confirmations.forEach((conf, index) => {
        appendIf(`confirmacoesEndereco[${index}][nomeParente]`, conf.nome);
        appendIf(`confirmacoesEndereco[${index}][whatsappParente]`, conf.whatsapp);
        appendIf(`confirmacoesEndereco[${index}][qualParente]`, conf.qualParente);
        appendIf(`confirmacoesEndereco[${index}][cep]`, conf.cep);
        appendIf(`confirmacoesEndereco[${index}][numero]`, conf.numero);
        appendIf(`confirmacoesEndereco[${index}][rua]`, conf.rua);
        appendIf(`confirmacoesEndereco[${index}][bairro]`, conf.bairro);
        appendIf(`confirmacoesEndereco[${index}][cidade]`, conf.cidade);
        appendIf(`confirmacoesEndereco[${index}][tipoCasa]`, conf.tipoCasa);
        if (conf.gps) {
          appendIf(`confirmacoesEndereco[${index}][latitude]`, conf.gps.latitude);
          appendIf(`confirmacoesEndereco[${index}][longitude]`, conf.gps.longitude);
          appendIf(`confirmacoesEndereco[${index}][precisao]`, conf.gps.accuracy);
          appendIf(`confirmacoesEndereco[${index}][timestamp]`, conf.gps.timestamp);
        }
      });

      appendIf('timestamp', new Date().toISOString());

      const filesDir = storage.getVisitFilesDir(visitId);
      const filesMap = v.files || {};
      for (const [field, files] of Object.entries(filesMap)) {
        files.forEach((file, index) => {
          const filePath = path.join(filesDir, field, file.filename);
          if (fs.existsSync(filePath)) {
            const stream = fs.createReadStream(filePath);
            form.append(`${field}[${index}]`, stream, {
              filename: file.originalName,
              contentType: file.mimeType,
            });
          }
        });
      }

      return form;
    }

    function buildCandidates(baseUrl) {
      const list = [];
      try {
        const u = new URL(baseUrl);
        const normalized = u.toString().replace(/\/$/, '');
        list.push(normalized);
        if (!u.pathname.startsWith('/webhook/')) {
          const u2 = new URL(normalized);
          u2.pathname = ('/webhook' + (u.pathname.startsWith('/') ? u.pathname : '/' + u.pathname)).replace(/\/\/+/, '/');
          list.push(u2.toString());
        }
      } catch (_e) {
        list.push(baseUrl);
      }
      return Array.from(new Set(list));
    }

    const candidates = buildCandidates(webhookUrl);
    const attemptErrors = [];
    let successResponse = null;
    for (const url of candidates) {
      const formData = buildFormData(visit);
      const headers = formData.getHeaders();
      if (process.env.WEBHOOK_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.WEBHOOK_TOKEN}`;
      }
      const resp = await axios.post(url, formData, {
        headers,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
      });
      if (resp.status === 200 || resp.status === 201) {
        successResponse = resp;
        break;
      }
      const errorText = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      attemptErrors.push(`POST ${url} -> HTTP ${resp.status}: ${errorText}`);
    }

    if (!successResponse) {
      await storage.markStatus(visitId, 'erro', {
        webhook: {
          attempts: attemptsInfo.attempts,
          lastStatus: attemptErrors.join(' | '),
          lastAttemptAt: new Date().toISOString(),
        },
      });
      throw new Error(`Erro no webhook: ${attemptErrors.join(' | ')}`);
    }

    await storage.deleteVisit(visitId);
    res.json({ status: 'ok', webhookResponse: successResponse.data });
  } catch (error) {
    console.error('[webhook] erro ao enviar visita', error);
    try {
      await storage.markStatus(visitId, 'erro', {
        webhook: {
          attempts: ((await storage.loadVisit(visitId))?.webhook?.attempts || 0) + 1,
          lastStatus: error.message,
          lastAttemptAt: new Date().toISOString(),
        },
      });
    } catch (markError) {
      console.error('[webhook] falha ao registrar erro', markError);
    }
    next(error);
  }
});

module.exports = router;

