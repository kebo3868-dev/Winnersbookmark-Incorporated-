import path from 'node:path';
if (!process.env.RESCUE_BASELINE_SOURCE) throw new Error('RESCUE_BASELINE_SOURCE required');
export default {
  root: process.cwd(), resolve: { alias: { '@': path.join(process.env.RESCUE_BASELINE_SOURCE, 'src') } },
  test: { include: ['tests-integration/baseline-reproduction.test.ts'], environment: 'node', maxWorkers: 1, testTimeout: 60000 },
};
