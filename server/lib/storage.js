const path = require('path');
const fse = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_DATA = {
  sections: {
    section1: {},
    section2: {},
    section3: {},
    section4: {},
  },
  status: 'rascunho',
  files: {},
  history: [],
  webhook: {
    attempts: 0,
    lastStatus: null,
    lastAttemptAt: null,
  },
};

class StorageProvider {
  constructor() {
    this.baseDir = null;
  }

  async init(baseDir) {
    this.baseDir = baseDir;
    await fse.ensureDir(this.baseDir);
  }

  assertReady() {
    if (!this.baseDir) {
      throw new Error('Storage não inicializado');
    }
  }

  getVisitDir(id) {
    this.assertReady();
    return path.join(this.baseDir, id);
  }

  getVisitDataPath(id) {
    return path.join(this.getVisitDir(id), 'dados.json');
  }

  getVisitFilesDir(id) {
    return path.join(this.getVisitDir(id), 'files');
  }

  async listVisits(status) {
    this.assertReady();
    const entries = await fse.readdir(this.baseDir);
    const visits = [];
    for (const entry of entries) {
      const dirPath = path.join(this.baseDir, entry);
      const stats = await fse.stat(dirPath).catch(() => null);
      if (!stats || !stats.isDirectory()) continue;
      const dataPath = this.getVisitDataPath(entry);
      if (!(await fse.pathExists(dataPath))) continue;
      const data = await fse.readJson(dataPath);
      if (!status || data.status === status) {
        visits.push(data);
      }
    }
    visits.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return visits;
  }

  async countAll() {
    this.assertReady();
    const entries = await fse.readdir(this.baseDir);
    let total = 0;
    for (const entry of entries) {
      const dirPath = path.join(this.baseDir, entry);
      const stats = await fse.stat(dirPath).catch(() => null);
      if (stats && stats.isDirectory()) {
        total += 1;
      }
    }
    return total;
  }

  async createVisit({ initialData = {}, sections = {}, status = 'rascunho', createdBy = null } = {}) {
    this.assertReady();
    const id = uuidv4();
    const visitDir = this.getVisitDir(id);
    const filesDir = this.getVisitFilesDir(id);

    await fse.ensureDir(filesDir);

    const now = new Date().toISOString();
    const data = {
      id,
      status,
      createdAt: now,
      updatedAt: now,
      createdBy,
      sections: { ...DEFAULT_DATA.sections, ...sections },
      files: { ...DEFAULT_DATA.files },
      history: [
        {
          type: 'create',
          at: now,
          by: createdBy,
        },
      ],
      webhook: { ...DEFAULT_DATA.webhook },
      metadata: {
        lastAutosaveAt: now,
        ...initialData.metadata,
      },
    };

    await fse.writeJson(this.getVisitDataPath(id), data, { spaces: 2 });
    return data;
  }

  async loadVisit(id) {
    const dataPath = this.getVisitDataPath(id);
    if (!(await fse.pathExists(dataPath))) {
      return null;
    }
    return fse.readJson(dataPath);
  }

  async saveVisit(id, updater) {
    const dataPath = this.getVisitDataPath(id);
    const visit = await this.loadVisit(id);
    if (!visit) throw new Error('Visita não encontrada');

    const next = typeof updater === 'function' ? updater(visit) : { ...visit, ...updater };
    next.updatedAt = new Date().toISOString();

    if (!next.history) next.history = visit.history || [];
    await fse.writeJson(dataPath, next, { spaces: 2 });
    return next;
  }

  async deleteVisit(id) {
    const dir = this.getVisitDir(id);
    await fse.remove(dir);
  }

  async saveSections(id, sections = {}, options = {}) {
    return this.saveVisit(id, (current) => {
      current.sections = {
        ...current.sections,
        ...sections,
      };
      current.metadata = {
        ...(current.metadata || {}),
        lastAutosaveAt: new Date().toISOString(),
        ...options.metadata,
      };
      if (options.status) {
        current.status = options.status;
      }
      if (options.appendHistory) {
        current.history = [...(current.history || []), options.appendHistory];
      }
      return current;
    });
  }

  async ensureFilesStructure(id, field) {
    const dir = path.join(this.getVisitFilesDir(id), field);
    await fse.ensureDir(dir);
    return dir;
  }

  async addFile(id, field, fileInfo) {
    return this.saveVisit(id, (current) => {
      if (!current.files) current.files = {};
      if (!current.files[field]) current.files[field] = [];
      current.files[field].push(fileInfo);
      current.history = [
        ...(current.history || []),
        {
          type: 'file-add',
          field,
          fileId: fileInfo.id,
          at: fileInfo.uploadedAt,
        },
      ];
      return current;
    });
  }

  async removeFile(id, field, fileId) {
    const visit = await this.loadVisit(id);
    if (!visit || !visit.files || !visit.files[field]) return null;
    const files = visit.files[field];
    const index = files.findIndex((file) => file.id === fileId);
    if (index === -1) return null;
    const [fileInfo] = files.splice(index, 1);
    visit.updatedAt = new Date().toISOString();
    visit.history = [
      ...(visit.history || []),
      {
        type: 'file-remove',
        field,
        fileId,
        at: visit.updatedAt,
      },
    ];
    await fse.writeJson(this.getVisitDataPath(id), visit, { spaces: 2 });
    const filePath = path.join(this.getVisitFilesDir(id), field, fileInfo.filename);
    await fse.remove(filePath);
    return fileInfo;
  }

  async markStatus(id, status, extra = {}) {
    return this.saveVisit(id, (current) => {
      const previousStatus = current.status;
      current.status = status;
      current.history = [
        ...(current.history || []),
        {
          type: 'status',
          from: previousStatus,
          to: status,
          at: new Date().toISOString(),
        },
      ];
      if (extra.webhook) {
        current.webhook = {
          ...(current.webhook || {}),
          ...extra.webhook,
        };
      }
      return current;
    });
  }
}

module.exports = new StorageProvider();

