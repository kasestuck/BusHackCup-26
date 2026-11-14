#!/usr/bin/env node
/**
 * Check existing video IDs through YouTube oEmbed without changing the catalog.
 * Usage: node scripts/validate-exercise-videos.mjs [catalog.json]
 * Requires Node.js 22 or newer; no packages or API key are needed.
 *
 * A successful oEmbed probe confirms metadata and matching embed markup, not
 * playback in every browser/region or the instructional quality of the video.
 * Manual playback/content review is still required before setting verified=true.
 * References: https://oembed.com/
 * https://developers.google.com/youtube/player_parameters
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CONCURRENCY = 3;
const TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 65536;
const EMBED_HOSTS = new Set([
  'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com',
]);

function matchingIframe(html, id) {
  if (typeof html !== 'string' || html.length > MAX_RESPONSE_BYTES) return false;
  const frames = [...html.matchAll(/<iframe\b[^>]*>/gi)];
  if (frames.length !== 1 || !/<\/iframe\s*>/i.test(html)) return false;
  if (/<(?:script|object|embed)\b/i.test(html)) return false;
  const sources = [...frames[0][0].matchAll(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)];
  if (sources.length !== 1) return false;
  try {
    const url = new URL((sources[0][1] ?? sources[0][2]).replaceAll('&amp;', '&'));
    return url.protocol === 'https:'
      && EMBED_HOSTS.has(url.hostname)
      && url.username === '' && url.password === '' && url.port === ''
      && url.pathname === `/embed/${id}`;
  } catch {
    return false;
  }
}

function validMetadata(value, id) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && value.type === 'video' && value.version === '1.0'
    && value.provider_name === 'YouTube'
    && typeof value.title === 'string' && value.title.trim().length > 0
    && Number.isInteger(value.width) && value.width > 0
    && Number.isInteger(value.height) && value.height > 0
    && matchingIframe(value.html, id);
}

async function readBoundedResponse(response) {
  if (!response.body) throw new Error('empty_response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('response_too_large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function probe({ slug, id }) {
  const endpoint = new URL('https://www.youtube.com/oembed');
  endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${id}`);
  endpoint.searchParams.set('format', 'json');
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      const unavailable = [400, 401, 403, 404, 410].includes(response.status);
      return {
        slug, ok: false,
        reason: `${unavailable ? 'unavailable_or_not_embeddable' : 'unresolved_http'} (HTTP ${response.status}; exact cause not confirmed)`,
      };
    }
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel();
      return { slug, ok: false, reason: 'invalid_response (expected JSON metadata)' };
    }
    let metadata;
    try {
      metadata = JSON.parse(await readBoundedResponse(response));
    } catch (error) {
      if (['AbortError', 'TimeoutError'].includes(error.name)) throw error;
      return { slug, ok: false, reason: 'invalid_response (unreadable or oversized JSON metadata)' };
    }
    if (!validMetadata(metadata, id)) {
      return { slug, ok: false, reason: 'invalid_response (metadata or matching YouTube iframe missing)' };
    }
    return { slug, ok: true };
  } catch (error) {
    const kind = ['AbortError', 'TimeoutError'].includes(error.name) ? 'timeout' : 'network';
    return { slug, ok: false, reason: `unresolved_${kind} (availability and embedding not validated)` };
  }
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Node.js 22 or newer is required.');
  }
  if (process.argv.length > 3) {
    throw new Error('Usage: node scripts/validate-exercise-videos.mjs [catalog.json]');
  }
  const catalogPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : fileURLToPath(new URL('./exercises.seed.json', import.meta.url));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('The catalog must be a nonempty JSON array.');
  }
  const jobs = [];
  const results = [];
  const slugs = new Set();
  let skipped = 0;
  for (const [index, entry] of catalog.entries()) {
    const slug = entry?.slug;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slugs.has(slug)) {
      results.push({ slug: `row_${index + 1}`, ok: false, reason: 'invalid_catalog (missing, invalid or duplicate slug)' });
      continue;
    }
    slugs.add(slug);
    if (entry.video_youtube_id === null) {
      skipped += 1;
      if (entry.verified !== false) {
        results.push({ slug, ok: false, reason: 'invalid_catalog (a missing video cannot be marked verified)' });
      }
      continue;
    }
    if (typeof entry.video_youtube_id !== 'string' || !VIDEO_ID.test(entry.video_youtube_id)) {
      results.push({ slug, ok: false, reason: 'invalid_video_id (expected an existing 11-character YouTube ID or null)' });
      continue;
    }
    jobs.push({ slug, id: entry.video_youtube_id });
  }

  const checked = new Array(jobs.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const index = cursor++;
      checked[index] = await probe(jobs[index]);
    }
  }));
  results.push(...checked);
  for (const result of results) {
    console.log(result.ok
      ? `PASS: ${result.slug}: YouTube oEmbed metadata and matching iframe received.`
      : `FAIL: ${result.slug}: ${result.reason}.`);
  }
  if (skipped > 0) {
    console.log(`SKIP: ${skipped} exercises have no video_youtube_id.`);
  }
  const passed = results.filter(result => result.ok).length;
  const problems = results.length - passed;
  console.log(`Catalog rows: ${catalog.length}; checked: ${jobs.length}; passed: ${passed}; problems: ${problems}; skipped: ${skipped}.`);
  if (jobs.length === 0) console.log('No video was validated; no network requests were made.');
  console.log('The catalog was not modified. Manual playback and content review are required before setting verified=true.');
  if (problems > 0) process.exitCode = 1;
}

await main().catch(error => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
