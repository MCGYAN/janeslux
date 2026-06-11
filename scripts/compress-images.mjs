#!/usr/bin/env node
/**
 * Compress all raster images in public/ in place.
 *
 * - JPEG: re-encoded with mozjpeg (quality 72)
 * - PNG:  lossy palette quantization (quality 80) — keeps transparency
 * - Anything larger than MAX_DIMENSION px on its longest edge is resized down
 * - A file is only overwritten when the result is smaller than the original
 *
 * Usage: node scripts/compress-images.mjs [--dry-run]
 */

import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 72;
const PNG_QUALITY = 80;
const DRY_RUN = process.argv.includes('--dry-run');

// Tiny assets where recompression is pointless / risky
const SKIP_FILES = new Set(['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function fmt(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

async function compressFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!['.png', '.jpg', '.jpeg'].includes(ext)) return null;
  if (SKIP_FILES.has(path.basename(file))) return null;

  const input = await readFile(file);
  const image = sharp(input, { animated: false });
  const meta = await image.metadata();
  if (!meta.width || !meta.height) return null;

  let pipeline = sharp(input);
  const longest = Math.max(meta.width, meta.height);
  if (longest > MAX_DIMENSION) {
    pipeline = pipeline.resize({
      width: meta.width >= meta.height ? MAX_DIMENSION : undefined,
      height: meta.height > meta.width ? MAX_DIMENSION : undefined,
      withoutEnlargement: true,
    });
  }

  let output;
  if (ext === '.png') {
    output = await pipeline
      .png({ palette: true, quality: PNG_QUALITY, compressionLevel: 9, effort: 9 })
      .toBuffer();
  } else {
    output = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  }

  if (output.length >= input.length) {
    return { file, before: input.length, after: input.length, skipped: true };
  }

  if (!DRY_RUN) await writeFile(file, output);
  return { file, before: input.length, after: output.length, skipped: false };
}

async function main() {
  let totalBefore = 0;
  let totalAfter = 0;
  const results = [];

  for await (const file of walk(PUBLIC_DIR)) {
    try {
      const result = await compressFile(file);
      if (!result) continue;
      results.push(result);
      totalBefore += result.before;
      totalAfter += result.after;
    } catch (err) {
      console.error(`✗ ${path.relative(PUBLIC_DIR, file)}: ${err.message}`);
    }
  }

  results.sort((a, b) => (b.before - b.after) - (a.before - a.after));
  for (const r of results) {
    const rel = path.relative(PUBLIC_DIR, r.file);
    if (r.skipped) {
      console.log(`= ${rel} (${fmt(r.before)}, already optimal)`);
    } else {
      const pct = Math.round((1 - r.after / r.before) * 100);
      console.log(`✓ ${rel}: ${fmt(r.before)} → ${fmt(r.after)} (-${pct}%)`);
    }
  }

  console.log(`\nTotal: ${fmt(totalBefore)} → ${fmt(totalAfter)} (saved ${fmt(totalBefore - totalAfter)})${DRY_RUN ? ' [dry run — nothing written]' : ''}`);
}

main();
