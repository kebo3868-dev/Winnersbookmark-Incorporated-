import path from 'node:path';
export default {
  root: process.cwd(), resolve: { alias: { '@': path.resolve('src') } },
  test: { include: ['tests-integration/security.test.ts'], environment: 'node', maxWorkers: 1, testTimeout: 60000, hookTimeout: 60000 },
};
