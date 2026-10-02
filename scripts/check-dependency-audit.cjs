'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const baselinePath = path.join(root, 'security/dependency-audit-baseline.json');
const reportPath = path.join(root, 'dependency-audit.json');
const levels = ['info', 'low', 'moderate', 'high', 'critical'];
const day = 86400000;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const ghsaPattern = /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

function date(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Invalid baseline date');
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  check(Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value,
    'Invalid baseline date');
  return timestamp;
}

function exactKeys(value, keys) {
  check(object(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|'),
    'Unknown or incomplete baseline structure');
}

function findings(value) {
  check(Array.isArray(value) && value.length > 0, 'Missing dependency findings');
  const versions = new Set();
  return value.map((finding) => {
    check(object(finding) && text(finding.version) && Array.isArray(finding.paths)
      && finding.paths.length > 0, 'Invalid dependency finding');
    const version = finding.version.trim();
    check(!versions.has(version), 'Duplicate dependency version');
    versions.add(version);
    const paths = finding.paths.map((item) => {
      check(text(item) && !/[\r\n\x00-\x1f]/.test(item), 'Invalid dependency path');
      const normalized = item.trim();
      check(normalized.split('>').every(text), 'Invalid dependency chain');
      return normalized;
    });
    return { version, paths: [...new Set(paths)].sort() };
  }).sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0);
}

function validateBaseline(baseline, now) {
  exactKeys(baseline, ['schemaVersion', 'createdAt', 'entries']);
  check(baseline.schemaVersion === 1 && Array.isArray(baseline.entries), 'Unsupported baseline schema');
  check(date(baseline.createdAt) <= now, 'Baseline creation date is in the future');
  const ids = new Set();
  const ghsas = new Set();
  const entries = baseline.entries.map((entry) => {
    exactKeys(entry, ['advisoryId', 'ghsa', 'package', 'severity', 'affectedRange', 'findings',
      'category', 'context', 'reason', 'approvedAt', 'reviewBy']);
    check(Number.isSafeInteger(entry.advisoryId) && entry.advisoryId > 0
      && typeof entry.ghsa === 'string' && ghsaPattern.test(entry.ghsa), 'Invalid baseline identity');
    check(!ids.has(entry.advisoryId) && !ghsas.has(entry.ghsa), 'Duplicate baseline identity');
    ids.add(entry.advisoryId);
    ghsas.add(entry.ghsa);
    check(entry.severity === 'high' && ['C', 'D'].includes(entry.category), 'Only C/D HIGH may be approved');
    check([entry.package, entry.affectedRange, entry.context, entry.reason].every(text),
      'Missing baseline review context');
    const approved = date(entry.approvedAt);
    const review = date(entry.reviewBy);
    check(approved >= date(baseline.createdAt) && approved <= now
      && review > approved && review - approved <= 30 * day, 'Invalid baseline review period');
    entry.findings.forEach((finding) => exactKeys(finding, ['version', 'paths']));
    return { ...entry, findings: findings(entry.findings), expired: now >= review };
  });
  return entries;
}

function parseAudit(raw) {
  let report;
  try { report = JSON.parse(raw); } catch { throw new Error('Invalid audit JSON'); }
  check(object(report) && !report.error && object(report.advisories)
    && object(report.metadata) && object(report.metadata.vulnerabilities)
    && Array.isArray(report.actions) && Array.isArray(report.muted) && report.muted.length === 0,
  'Unsupported or failed audit report');
  const counts = report.metadata.vulnerabilities;
  check(Object.keys(counts).every((level) => levels.includes(level)), 'Unsupported severity counts');
  levels.forEach((level) => check(Number.isSafeInteger(counts[level]) && counts[level] >= 0,
    'Invalid severity count'));
  const observed = Object.fromEntries(levels.map((level) => [level, 0]));
  const ghsas = new Set();
  const advisories = Object.entries(report.advisories).map(([key, advisory]) => {
    check(object(advisory) && Number.isSafeInteger(advisory.id) && String(advisory.id) === key
      && advisory.id > 0 && text(advisory.module_name) && text(advisory.vulnerable_versions)
      && levels.includes(advisory.severity) && typeof advisory.github_advisory_id === 'string'
      && ghsaPattern.test(advisory.github_advisory_id), 'Invalid advisory structure');
    check(!ghsas.has(advisory.github_advisory_id), 'Duplicate audit GHSA');
    ghsas.add(advisory.github_advisory_id);
    const normalized = findings(advisory.findings);
    check(normalized.every((finding) => finding.paths.every((chain) =>
      chain.split('>').at(-1) === advisory.module_name.trim())), 'Advisory package/path mismatch');
    observed[advisory.severity] += normalized.length;
    return { advisoryId: advisory.id, ghsa: advisory.github_advisory_id,
      package: advisory.module_name.trim(), severity: advisory.severity,
      affectedRange: advisory.vulnerable_versions.trim(), findings: normalized };
  });
  levels.forEach((level) => check(observed[level] === counts[level], 'Audit counts/findings mismatch'));
  return { report, counts, advisories };
}

function fingerprint(entry) {
  return JSON.stringify([entry.advisoryId, entry.ghsa, entry.package.trim(),
    entry.affectedRange.trim(), entry.findings]);
}

function evaluate(raw, baseline, now, status = 1, stderr = '', processError = false) {
  check(!processError && [0, 1].includes(status), 'Audit process failed or pnpm is unavailable');
  check(!/ERR_PNPM|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ERR_SOCKET|registry.*(?:error|failed)/i.test(stderr),
    'Audit registry/network failure');
  const audit = parseAudit(raw);
  check(status !== 1 || Object.values(audit.counts).some((count) => count > 0),
    'Audit returned an unexplained failure');
  const approved = validateBaseline(baseline, now);
  const byId = new Map(approved.map((entry) => [entry.advisoryId, entry]));
  const high = audit.advisories.filter((entry) => entry.severity === 'high');
  const known = high.filter((entry) => {
    const match = byId.get(entry.advisoryId);
    return match && !match.expired && fingerprint(match) === fingerprint(entry);
  });
  const expired = approved.filter((entry) => entry.expired);
  const unapproved = high.filter((entry) => !known.includes(entry));
  const removed = approved.filter((entry) => !high.some((finding) => finding.advisoryId === entry.advisoryId));
  return { counts: audit.counts, known, unapproved, expired, removed,
    pass: audit.counts.critical === 0 && unapproved.length === 0 && expired.length === 0 };
}

function pnpmCommand() {
  if (process.platform !== 'win32') return ['pnpm', ['audit', '--prod', '--json']];
  // Windows npm shims require a shell; invoke their installed Node launcher instead.
  const directories = (process.env.PATH || '').split(path.delimiter);
  for (const directory of directories) {
    for (const relative of ['node_modules/corepack/dist/pnpm.js', 'node_modules/pnpm/bin/pnpm.cjs']) {
      const file = path.join(directory, relative);
      if (fs.existsSync(file)) return [process.execPath, [file, 'audit', '--prod', '--json']];
    }
  }
  return ['pnpm.exe', ['audit', '--prod', '--json']];
}

function summary(result, error) {
  const counts = result?.counts;
  const lines = ['## Dependency audit',
    ...['critical', 'high', 'moderate', 'low'].map((level) => `${level}: ${counts?.[level] ?? 'unavailable'}`),
    `HIGH approved: ${result?.known.length ?? 'unavailable'}`,
    `HIGH new/unapproved: ${result?.unapproved.length ?? 'unavailable'}`,
    `HIGH baseline expired: ${result?.expired.length ?? 'unavailable'}`,
    `Result: ${result?.pass && !error ? 'PASS' : 'FAIL'}`];
  if (error) lines.push('Operational error or invalid baseline/report; review console output.');
  if (result?.removed.length) lines.push(`Removed HIGH: ${result.removed.length}; manual baseline cleanup available.`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n\n')}\n`);
}

function main() {
  let result;
  let error;
  try {
    // Never reuse a stale report when execution fails before producing valid JSON.
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
    const [command, args] = pnpmCommand();
    const execution = spawnSync(command, args, { cwd: root, encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024, timeout: 120000, windowsHide: true });
    const raw = execution.stdout || '';
    try {
      JSON.parse(raw);
      fs.writeFileSync(reportPath, raw);
    } catch { /* The policy fails below if no valid JSON was returned. */ }
    // One-line escaped JSON keeps registry data from becoming Actions commands.
    console.log(`Audit stdout: ${JSON.stringify(raw)}`);
    console.log(`Audit stderr: ${JSON.stringify(execution.stderr || '')}`);
    console.log(`Audit exit code: ${execution.status}`);
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    result = evaluate(raw, baseline, Date.now(), execution.status, execution.stderr || '',
      Boolean(execution.error || execution.signal));
    for (const [label, entries] of [['Approved HIGH (warning)', result.known],
      ['Unapproved HIGH', result.unapproved], ['Expired HIGH', result.expired], ['Removed HIGH', result.removed]]) {
      console.log(`${label}: ${JSON.stringify(entries)}`);
    }
  } catch (failure) {
    error = failure;
    // Do not print arbitrary registry payloads as stack traces or annotations.
    console.error(`Dependency policy error: ${JSON.stringify(failure.message)}`);
  }
  try { summary(result, error); } catch { error = new Error('Cannot write dependency audit summary'); }
  process.exitCode = error || !result?.pass ? 1 : 0;
}

function selfTest() {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const now = date(baseline.createdAt) + day;
  const report = { actions: [], muted: [], advisories: {}, metadata: { vulnerabilities: {} } };
  for (const entry of baseline.entries) report.advisories[entry.advisoryId] = {
    id: entry.advisoryId, github_advisory_id: entry.ghsa, module_name: entry.package,
    vulnerable_versions: entry.affectedRange, severity: entry.severity, findings: clone(entry.findings) };
  function recount(value) {
    value.metadata.vulnerabilities = Object.fromEntries(levels.map((level) => [level, 0]));
    Object.values(value.advisories).forEach((entry) => {
      value.metadata.vulnerabilities[entry.severity] += entry.findings.length;
    });
    return value;
  }
  recount(report);
  const run = (value = report, base = baseline, time = now, status = 1, stderr = '', processError = false) =>
    evaluate(typeof value === 'string' ? value : JSON.stringify(value), base, time, status, stderr, processError);
  const tests = [];
  function test(name, callback) { callback(); tests.push(name); console.log(`PASS ${name}`); }
  const firstId = baseline.entries[0].advisoryId;
  test('A: approved snapshot', () => { const result = run(); assert.equal(result.pass, true); assert.equal(result.known.length, 21); });
  test('B: empty baseline', () => { const result = run(report, { ...baseline, entries: [] }); assert.equal(result.pass, false); assert.equal(result.unapproved.length, 21); });
  test('C: critical synthetic', () => { const value = clone(report); value.advisories[firstId].severity = 'critical'; assert.equal(run(recount(value)).pass, false); });
  test('D: new high', () => { const value = clone(report); const entry = clone(value.advisories[firstId]); entry.id = 9999999; entry.github_advisory_id = 'GHSA-aaaa-bbbb-cccc'; value.advisories[entry.id] = entry; assert.equal(run(recount(value)).pass, false); });
  test('E: changed dependency context', () => { const value = clone(report); value.advisories[firstId].findings[0].paths[0] = `new-workspace>${value.advisories[firstId].module_name}`; assert.equal(run(value).pass, false); });
  test('F: expired baseline', () => assert.equal(run(report, baseline, date(baseline.entries[0].reviewBy)).pass, false));
  test('G: invalid JSON', () => assert.throws(() => run('{')));
  test('H: registry/process failures', () => {
    assert.throws(() => run('{"error":{"code":"ERR_PNPM_AUDIT"}}'));
    assert.throws(() => run(report, baseline, now, 2));
    assert.throws(() => run(report, baseline, now, null, '', true));
    assert.throws(() => run(report, baseline, now, 1, 'ECONNRESET'));
  });
  test('I: moderate/low only', () => { const value = clone(report); Object.values(value.advisories).forEach((entry, index) => { entry.severity = index % 2 ? 'moderate' : 'low'; }); assert.equal(run(recount(value)).pass, true); });
  test('Changed package/version/range', () => {
    const changedPackage = clone(report); changedPackage.advisories[firstId].module_name += '-changed';
    assert.throws(() => run(changedPackage));
    const changedRange = clone(report); changedRange.advisories[firstId].vulnerable_versions += '-changed';
    assert.equal(run(changedRange).pass, false);
    const value = clone(report); value.advisories[firstId].findings[0].version = '999.0.0'; assert.equal(run(value).pass, false);
  });
  test('Invalid baselines', () => {
    for (const change of [(b) => { b.entries[0].category = 'A'; }, (b) => { b.entries[0].severity = 'critical'; },
      (b) => { delete b.entries[0].reason; }, (b) => { b.entries.push(clone(b.entries[0])); },
      (b) => { b.entries[0].reviewBy = '2026-02-30'; }, (b) => { b.extra = true; },
      (b) => { b.entries[0].reviewBy = '2099-01-01'; }]) { const value = clone(baseline); change(value); assert.throws(() => run(report, value)); }
  });
  test('Removed high and stable order', () => {
    const value = clone(report); delete value.advisories[firstId]; const result = run(recount(value)); assert.equal(result.pass, true); assert.equal(result.removed.length, 1);
    const reversed = clone(baseline); reversed.entries.reverse(); assert.equal(run(report, reversed).pass, true);
  });
  test('Unsupported/inconsistent audit', () => {
    const value = clone(report); value.metadata.vulnerabilities.high++; assert.throws(() => run(value));
    assert.throws(() => run('{}')); assert.throws(() => run(recount({ ...clone(report), advisories: {} }), baseline, now, 1));
  });
  test('Summary includes decision and counts', () => {
    const previousSummary = process.env.GITHUB_STEP_SUMMARY;
    const previousAppend = fs.appendFileSync;
    const previousLog = console.log;
    let output = '';
    try {
      process.env.GITHUB_STEP_SUMMARY = 'in-memory-summary';
      fs.appendFileSync = (file, value) => { assert.equal(file, 'in-memory-summary'); output += value; };
      console.log = () => {};
      summary(run());
      assert.match(output, /critical: 0/); assert.match(output, /HIGH approved: 21/);
      assert.match(output, /HIGH new\/unapproved: 0/); assert.match(output, /HIGH baseline expired: 0/);
      assert.match(output, /Result: PASS/);
      summary(undefined, new Error('simulated operational failure'));
      assert.match(output, /Result: FAIL/);
    } finally {
      fs.appendFileSync = previousAppend;
      console.log = previousLog;
      if (previousSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
      else process.env.GITHUB_STEP_SUMMARY = previousSummary;
    }
  });
  console.log(`${tests.length} scenario groups passed; no network or files generated.`);
}

if (require.main === module) {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') selfTest();
  else if (process.argv.length === 2) main();
  else { console.error('Usage: node scripts/check-dependency-audit.cjs [--self-test]'); process.exitCode = 1; }
}

module.exports = { evaluate, parseAudit, validateBaseline };
