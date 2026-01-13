#!/usr/bin/env node

/*
  Olympia trace analyzer

  Input: text logs (browser console export / Vercel logs) containing lines like:
    [Olympia][Trace] {"layer":"server",...}

  Output: markdown summary with p50/p95/p99 for key metrics.

  Usage:
    node scripts/olympia-trace-analyze.cjs path/to/logs.txt [moreFiles...]
*/
import fs from "node:fs";
import path from "node:path";

/** @typedef {{ layer?: string, traceId?: string, action?: string, event?: string, ts?: string, payloadBytes?: number, [k: string]: unknown }} TraceEvent */

function readAll(files) {
  const out = [];
  for (const file of files) {
    const abs = path.resolve(process.cwd(), file);
    const text = fs.readFileSync(abs, "utf8");
    out.push({ file, text });
  }
  return out;
}

function tryExtractJsonObject(line) {
  const idx = line.indexOf("{");
  if (idx === -1) return null;
  const candidate = line.slice(idx).trim();
  // Heuristic: drop trailing characters after last '}'
  const last = candidate.lastIndexOf("}");
  if (last === -1) return null;
  const jsonText = candidate.slice(0, last + 1);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const a = sorted[base];
  const b = sorted[Math.min(base + 1, sorted.length - 1)];
  return a + (b - a) * rest;
}

function summarize(values) {
  const nums = values
    .filter(isFiniteNumber)
    .slice()
    .sort((a, b) => a - b);
  return {
    n: nums.length,
    p50: quantile(nums, 0.5),
    p95: quantile(nums, 0.95),
    p99: quantile(nums, 0.99),
    min: nums.length ? nums[0] : null,
    max: nums.length ? nums[nums.length - 1] : null,
  };
}

function fmtMs(v) {
  if (!isFiniteNumber(v)) return "";
  return String(Math.round(v));
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/olympia-trace-analyze.cjs <logFile...>");
    process.exit(2);
  }

  /** @type {TraceEvent[]} */
  const events = [];

  for (const { file, text } of readAll(files)) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (!line.includes("[Olympia][Trace]")) continue;
      const obj = tryExtractJsonObject(line);
      if (!obj || typeof obj !== "object") continue;
      events.push({ ...obj, __file: file });
    }
  }

  // Buckets
  const clientAwaitByAction = new Map();
  const serverTotalByAction = new Map();
  const receiveLagByTable = new Map();

  for (const e of events) {
    const layer = typeof e.layer === "string" ? e.layer : "";
    const action = typeof e.action === "string" ? e.action : "unknown";
    const event = typeof e.event === "string" ? e.event : "unknown";

    if (layer === "client" && event === "end" && isFiniteNumber(e.msAwaitServerAction)) {
      const key = action;
      const list = clientAwaitByAction.get(key) ?? [];
      list.push(e.msAwaitServerAction);
      clientAwaitByAction.set(key, list);
    }

    if (layer === "server" && event === "end" && isFiniteNumber(e.msTotal)) {
      const key = action;
      const list = serverTotalByAction.get(key) ?? [];
      list.push(e.msTotal);
      serverTotalByAction.set(key, list);
    }

    if (
      layer === "client-receive" &&
      event.startsWith("receive:") &&
      isFiniteNumber(e.receiveLagMs)
    ) {
      const table = event.slice("receive:".length);
      const list = receiveLagByTable.get(table) ?? [];
      list.push(e.receiveLagMs);
      receiveLagByTable.set(table, list);
    }
  }

  const now = new Date().toISOString();

  const lines = [];
  lines.push(`# Olympia Trace Analysis`);
  lines.push(``);
  lines.push(`Generated at: ${now}`);
  lines.push(`Inputs: ${files.join(", ")}`);
  lines.push(`Parsed events: ${events.length}`);
  lines.push(``);

  lines.push(`## A) Client msAwaitServerAction (p50/p95/p99)`);
  lines.push(`| action | n | p50(ms) | p95(ms) | p99(ms) | min | max |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const [action, vals] of Array.from(clientAwaitByAction.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const s = summarize(vals);
    lines.push(
      `| ${action} | ${s.n} | ${fmtMs(s.p50)} | ${fmtMs(s.p95)} | ${fmtMs(s.p99)} | ${fmtMs(s.min)} | ${fmtMs(s.max)} |`
    );
  }
  if (clientAwaitByAction.size === 0) {
    lines.push(`| (no data) | 0 |  |  |  |  |  |`);
  }
  lines.push(``);

  lines.push(`## B) Server msTotal (p50/p95/p99)`);
  lines.push(`| action | n | p50(ms) | p95(ms) | p99(ms) | min | max |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const [action, vals] of Array.from(serverTotalByAction.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const s = summarize(vals);
    lines.push(
      `| ${action} | ${s.n} | ${fmtMs(s.p50)} | ${fmtMs(s.p95)} | ${fmtMs(s.p99)} | ${fmtMs(s.min)} | ${fmtMs(s.max)} |`
    );
  }
  if (serverTotalByAction.size === 0) {
    lines.push(`| (no data) | 0 |  |  |  |  |  |`);
  }
  lines.push(``);

  lines.push(`## C) Realtime receiveLagMs (commit_timestamp → receive)`);
  lines.push(`| table | n | p50(ms) | p95(ms) | p99(ms) | min | max |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|`);
  for (const [table, vals] of Array.from(receiveLagByTable.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const s = summarize(vals);
    lines.push(
      `| ${table} | ${s.n} | ${fmtMs(s.p50)} | ${fmtMs(s.p95)} | ${fmtMs(s.p99)} | ${fmtMs(s.min)} | ${fmtMs(s.max)} |`
    );
  }
  if (receiveLagByTable.size === 0) {
    lines.push(`| (no data) | 0 |  |  |  |  |  |`);
  }
  lines.push(``);

  lines.push(`## D) Gợi ý lọc log`);
  lines.push(`- Lọc theo prefix: [Olympia][Trace]`);
  lines.push(`- Client actions: layer=client, event=end`);
  lines.push(`- Server actions: layer=server, event=end`);
  lines.push(`- Receive lag: layer=client-receive, event=receive:<table>`);

  process.stdout.write(lines.join("\n"));
}

main();
