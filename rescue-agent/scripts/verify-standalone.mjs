import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = path.resolve(process.argv[2] ?? '.next/standalone');
const require = createRequire(path.join(root, 'package.json'));
const resolved = fs.realpathSync(require.resolve('sharp'));
assert(resolved.startsWith(root + path.sep), `Sharp escaped standalone package: ${resolved}`);
const sharp = require('sharp');
const expectFallback = process.env.EXPECT_AVIF_FALLBACK === '1';
if (!expectFallback) {
  assert(sharp.versions.heif, 'Standalone Sharp is missing its native codec metadata');
  assert(sharp.versions.aom, 'Standalone Sharp is missing its AV1 codec metadata');
}
const { imageOptimizer, detectContentType } = require('next/dist/server/image-optimizer.js');
const { defaultConfig } = require('next/dist/server/config-shared.js');
const source = await sharp({ create: { width: 256, height: 128, channels: 3, background: '#446688' } }).avif().toBuffer();
const sourceMetadata = await sharp(source).metadata();
assert.equal(await detectContentType(source), 'image/avif');
// Exercise the full pipeline, including its safety gate and original-image
// fallback, rather than calling the encoder below that gate directly.
const result = await imageOptimizer({ buffer: source, etag: 'avif-input', cacheControl: 'max-age=0' },
  { href: '/probe.avif', width: 64, quality: 60, mimeType: 'image/avif' }, defaultConfig, { isDev: false });
const output = result.buffer;
// The missing-metadata control intentionally makes Next block AVIF decoding.
// Its byte-identical fallback has the already measured input dimensions.
const metadata = expectFallback ? sourceMetadata : await sharp(output).metadata();
assert.equal(await detectContentType(output), 'image/avif');
if (expectFallback) {
  assert(source.equals(output), 'Expected missing metadata to trigger the AVIF safety gate');
  assert.equal(metadata.width, 256);
} else {
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 32);
  assert(!result.error, 'Image optimizer used its error fallback');
  assert(!source.equals(output), 'Image optimizer returned its input unchanged');
  assert.notEqual(result.etag, result.upstreamEtag, 'Optimizer kept the upstream ETag');
  assert(output.length < source.length, 'Expected the smaller solid image to use fewer bytes');
}
console.log(JSON.stringify({ sharp: sharp.versions, input: { width: 256, height: 128, bytes: source.length },
  output: { width: metadata.width, height: metadata.height, bytes: output.length, mime: 'image/avif',
    sha256: crypto.createHash('sha256').update(output).digest('hex') }, optimized: !source.equals(output),
    fallback: source.equals(output) }, null, 2));
