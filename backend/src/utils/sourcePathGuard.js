import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIR = path.resolve(__dirname, '../../..', '.SOURCE');

function normalizeForCompare(targetPath) {
    const normalized = path.normalize(targetPath);
    if (normalized.length > 1 && normalized.endsWith(path.sep)) {
        return normalized.slice(0, -1);
    }
    return normalized;
}

function normalizeCase(targetPath) {
    return process.platform === 'win32' ? targetPath.toLowerCase() : targetPath;
}

export function assertNotSourcePath(candidatePath, label = 'Path') {
    if (typeof candidatePath !== 'string' || candidatePath.trim() === '') {
        const error = new Error(`${label} is required`);
        error.statusCode = 400;
        throw error;
    }

    const resolvedPath = path.isAbsolute(candidatePath)
        ? path.resolve(candidatePath)
        : path.resolve(PROJECT_ROOT, candidatePath);

    const targetForCompare = normalizeCase(normalizeForCompare(resolvedPath));
    const sourceForCompare = normalizeCase(normalizeForCompare(SOURCE_DIR));

    if (
        targetForCompare === sourceForCompare ||
        targetForCompare.startsWith(`${sourceForCompare}${path.sep}`)
    ) {
        const error = new Error(`${label} cannot be inside .SOURCE`);
        error.statusCode = 400;
        throw error;
    }

    return resolvedPath;
}
