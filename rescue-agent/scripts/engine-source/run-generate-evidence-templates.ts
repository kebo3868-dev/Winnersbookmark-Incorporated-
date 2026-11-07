import path from 'node:path';
import { generateEvidenceTemplates } from './generate-evidence-templates';

generateEvidenceTemplates(path.resolve(__dirname, '../..'));
