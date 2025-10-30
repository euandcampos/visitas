const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const createAuthMiddleware = require('./middleware/auth');
const storage = require('./lib/storage');
const visitsRouter = require('./routes/visits');

const PORT = process.env.PORT || 4000;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data', 'visitas');

async function bootstrap() {
  await storage.init(DATA_DIR);

  const app = express();

  app.set('trust proxy', 1);

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  const authMiddleware = createAuthMiddleware(process.env.API_TOKEN);

  app.use('/api', authMiddleware);

  app.use('/api/visits', visitsRouter);

  // rota de status simples
  app.get('/status', async (_req, res) => {
    const total = await storage.countAll();
    res.json({
      status: 'ok',
      totalVisits: total,
    });
  });

  // servir arquivos estáticos da pasta public (frontend)
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error('[ERRO] Middleware final:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Erro interno do servidor',
    });
  });

  app.listen(PORT, () => {
    console.log(`[OK] Servidor iniciado na porta ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[ERRO] Falha ao iniciar servidor:', err);
  process.exit(1);
});

