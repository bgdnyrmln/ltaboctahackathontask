import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { footer, hero, kpiSection, nav, privacy, scorePreview, steps } from '../content/landing.ts';
import { KPI_DEFS, octaRecommendation, TIP_TEMPLATES } from '../data/score/interimScore.ts';
import { dScore } from '../data/score/dScore.ts';
import { profileRisk } from '../data/score/profileRisk.ts';
import { LV } from './lv/index.ts';
import { translate } from './translate.ts';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'i18n' || name === 'data' || name === 'assets') continue;
      sourceFiles(p, out);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

const unescape = (s: string) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');

// Literal first arguments of t('...') and both literals of tn(n, '...', '...').
function usedLiterals(): Set<string> {
  const found = new Set<string>();
  const t = /\bt\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g;
  const tn = /\btn\([^,()]+(?:\([^)]*\))?[^,()]*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'/g;
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(t)) found.add(unescape(m[1] ?? m[2]));
    for (const m of text.matchAll(tn)) {
      found.add(unescape(m[1]));
      found.add(unescape(m[2]));
    }
  }
  return found;
}

// String values of named constant objects/arrays that are passed through t(variable) at render time.
function constantValues(): Set<string> {
  const found = new Set<string>();
  const wanted: Array<[string, string[]]> = [
    ['pages/app/Home.tsx', ['CONFIDENCE_TEXT', 'BAND_TEXT']],
    ['pages/app/Trips.tsx', ['SOURCE_LABEL']],
    ['pages/app/TripDetail.tsx', ['SOURCE_LABEL']],
    ['pages/Login.tsx', ['ERROR_TEXT']],
    ['insurer/InsurerPortal.tsx', ['BAND_TEXT']],
    ['pages/app/AppLayout.tsx', ['TABS']],
    ['components/TripReplayMap.tsx', ['SPEEDS']],
  ];
  for (const [file, names] of wanted) {
    const text = readFileSync(join(SRC, file), 'utf8');
    for (const name of names) {
      const start = text.indexOf(`const ${name}`);
      assert.notEqual(start, -1, `${name} not found in ${file}`);
      const ends = [text.indexOf('\n]', start), text.indexOf('\n}', start)].filter((i) => i > -1);
      const end = Math.min(...ends);
      const block = text.slice(start, end);
      for (const m of block.matchAll(/(?:label|[a-z_]+):\s*'((?:\\.|[^'\\])*)'/g)) {
        if (/^(M|\/app)/.test(m[1]) || m[1].length < 3) continue;
        found.add(unescape(m[1]));
      }
    }
  }
  return found;
}

function walkStrings(value: unknown, skipKeys: Set<string>, out: Set<string>) {
  if (typeof value === 'string') out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => walkStrings(v, skipKeys, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (!skipKeys.has(k)) walkStrings(v, skipKeys, out);
  }
}

function dataLayerStrings(): Set<string> {
  const found = new Set<string>();
  const skip = new Set(['href', 'icon', 'impact', 'value', 'decimals', 'suffix', 'name', 'outlined']);
  for (const part of [nav, hero, kpiSection, steps, scorePreview, privacy, footer]) walkStrings(part, skip, found);
  for (const tpl of Object.values(TIP_TEMPLATES)) found.add(tpl);
  for (const def of KPI_DEFS) {
    found.add(def.label);
    found.add(def.unit);
  }
  const totals = {
    trips: 10, distanceKm: 150, drivingSec: 10000, secOverLimit: 900, secOver10: 300, secOver20: 50,
    secOverPct10: 250, secOverPct20: 80, secOverPct40: 20, secPhoneUse: 100, secTooSlow: 100,
    harshBrakeCount: 9, harshAccelCount: 6, nightKm: 18, maxContinuousMin: 50, coverage: 0.95,
  };
  for (const k of dScore(totals, []).kpis) {
    found.add(k.label);
    found.add(k.unit);
  }
  for (const band of ['low', 'moderate_low', 'moderate', 'elevated'] as const) {
    const r = octaRecommendation({ score: 50, confidence: 'medium', band, kpis: [] });
    found.add(r.label);
    found.add(r.disclaimer);
  }
  found.add(octaRecommendation({ score: null, confidence: 'insufficient', band: null, kpis: [] }).label);
  const inputs = {
    licenseSince: '2020-01-01', claimsLast5y: 1, penaltyPoints: 1, vehicleYear: 2010, powerKw: 100, massKg: 1000,
    inspectionOverdue: true, driverAge: 30,
  };
  for (const f of profileRisk(inputs, new Date('2026-10-28'), true).factors) found.add(f.label);
  // Fixed texts built in the score module.
  found.add('Drive at least 30 km this week to get a score. Missing data never lowers your score.');
  found.add('Some night drives ran over 2 hours without a stop. Plan a short break every 2 hours.');
  return found;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every t() literal used in the app has a Latvian entry', () => {
  const missing = [...usedLiterals()].filter((s) => !(s in LV));
  assert.deepEqual(missing, [], `Missing Latvian entries:\n${missing.map((m) => `  ${m}`).join('\n')}`);
});

test('text passed to t() through constants has a Latvian entry', () => {
  const missing = [...constantValues()].filter((s) => !(s in LV));
  assert.deepEqual(missing, [], `Missing Latvian entries:\n${missing.map((m) => `  ${m}`).join('\n')}`);
});

test('landing content, score text and profile factors have a Latvian entry', () => {
  const missing = [...dataLayerStrings()].filter((s) => !(s in LV));
  assert.deepEqual(missing, [], `Missing Latvian entries:\n${missing.map((m) => `  ${m}`).join('\n')}`);
});

test('Latvian entries keep the same placeholders as the English text', () => {
  const bad = Object.entries(LV).filter(([en, lv]) => placeholders(en) !== placeholders(lv));
  assert.deepEqual(bad.map(([en]) => en), []);
});

test('translate fills placeholders and falls back to English', () => {
  assert.equal(translate('en', 'Hi, {name}', { name: 'Anna' }), 'Hi, Anna');
  assert.equal(translate('lv', 'Hi, {name}', { name: 'Anna' }), 'Sveiki, Anna');
  assert.equal(translate('lv', 'A text without a translation'), 'A text without a translation');
  assert.equal(translate('lv', 'Hi, {name}'), 'Sveiki, {name}');
});
