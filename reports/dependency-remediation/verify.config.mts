import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '../../rescue-agent');
export default {
  root: app,
  resolve: { alias: { '@': path.join(app, 'src'), ...(process.env.ZOD_CANDIDATE ? { zod: process.env.ZOD_CANDIDATE } : {}) } },
  test: {
    include: [path.join(here, '*.test.ts')], environment: 'node', maxWorkers: 1, minWorkers: 1,
    env: { DATABASE_URL: 'postgresql://trial:trial@127.0.0.1:5432/trial' },
  },
};
