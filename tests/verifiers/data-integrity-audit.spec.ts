// VERIFIER: data-integrity-audit
// STATUS: GREEN now that dashboard_monthly is regenerated and aggregates match.
// SPEC: /docs/specs/data-integrity-audit.md
//
// Contract (post-fix):
//   - Raw row count diff is EXPECTED (last-snapshot-per-month dedup of natural keys).
//     pickup_weekly: -24, stly_sales: -706 are documented.
//   - AGGREGATES (what the user sees in the dashboard) MUST be 0 mismatches.
//   - auditPassed === true and exit code === 0.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'audit-data-integrity.mjs');
const EXCEL_PATH = join(REPO_ROOT, 'docs', 'BORA_BORA_Informe_Ejecutivo FINAL.xlsx');

interface AuditReport {
  pickup: { excel: number; mysql: number; diff: number };
  stly: { excel: number; mysql: number; diff: number };
  channelSales: { excel: number; mysql: number; diff: number };
  dashboardMonthly: { excel: number; mysql: number; diff: number };
  aggregates: { totalCells: number; mismatches: number; mismatchesList: unknown[] };
  summary: {
    rawTablesWithDiff: string[];
    aggregateTablesWithDiff: string[];
    auditPassed: boolean;
  };
}

let CACHED: { stdout: string; exitCode: number; report: AuditReport | null } | null = null;

function runAudit() {
  if (CACHED) return CACHED;
  try {
    const stdout = execFileSync('node', [SCRIPT_PATH, EXCEL_PATH], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000,
    });
    CACHED = { stdout, exitCode: 0, report: parseReport(stdout) };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer; status?: number };
    const stdout = err.stdout ? err.stdout.toString('utf8') : '';
    CACHED = { stdout, exitCode: err.status ?? 1, report: parseReport(stdout) };
  }
  return CACHED;
}

function parseReport(stdout: string): AuditReport | null {
  const match = stdout.match(/===JSON-REPORT-START===\s*([\s\S]+?)\s*===JSON-REPORT-END===/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

describe('data-integrity-audit Verifier', () => {
  beforeAll(() => runAudit());

  describe('AC-4: Script exists and runs', () => {
    it('should have audit-data-integrity.mjs at scripts/audit-data-integrity.mjs', () => {
      expect(existsSync(SCRIPT_PATH)).toBe(true);
    });

    it('should emit a JSON report between ===JSON-REPORT-START=== markers', () => {
      const { report } = runAudit();
      expect(report).not.toBeNull();
    });
  });

  describe('AC-1: Report shape', () => {
    it('should have all 4 table summaries in the report', () => {
      const { report } = runAudit();
      expect(report).toMatchObject({
        pickup: expect.objectContaining({ excel: expect.any(Number), mysql: expect.any(Number), diff: expect.any(Number) }),
        stly: expect.objectContaining({ excel: expect.any(Number), mysql: expect.any(Number), diff: expect.any(Number) }),
        channelSales: expect.objectContaining({ excel: expect.any(Number), mysql: expect.any(Number), diff: expect.any(Number) }),
        dashboardMonthly: expect.objectContaining({ excel: expect.any(Number), mysql: expect.any(Number), diff: expect.any(Number) }),
      });
    });

    it('should have aggregates section with 48 cells (12 months × 4 years)', () => {
      const { report } = runAudit();
      expect(report!.aggregates.totalCells).toBe(48);
    });
  });

  describe('AC-2: Aggregate values MUST match exactly (this is what the user sees)', () => {
    it('aggregates.mismatches must be 0', () => {
      const { report } = runAudit();
      expect(report!.aggregates.mismatches).toBe(0);
    });

    it('summary.aggregateTablesWithDiff must be empty', () => {
      const { report } = runAudit();
      expect(report!.summary.aggregateTablesWithDiff).toEqual([]);
    });

    it('summary.auditPassed must be true', () => {
      const { report } = runAudit();
      expect(report!.summary.auditPassed).toBe(true);
    });

    it('script should exit with code 0 when audit passes', () => {
      const { exitCode } = runAudit();
      expect(exitCode).toBe(0);
    });
  });

  describe('AC-3: Raw row count audit (informational, dedup expected)', () => {
    // These are EXPECTED to have diff. Document them so future readers know it's not a bug.
    it('pickup_weekly raw diff is -24 (2 per month × 12 months, dedup of duplicate natural keys)', () => {
      const { report } = runAudit();
      expect(report!.pickup.diff).toBe(-24);
    });

    it('stly_sales raw diff is -706 (duplicates in Excel that collide on the unique key)', () => {
      const { report } = runAudit();
      expect(report!.stly.diff).toBe(-706);
    });

    it('channel_sales_month raw diff is 0 (no duplicates in source)', () => {
      const { report } = runAudit();
      expect(report!.channelSales.diff).toBe(0);
    });

    it('dashboard_monthly raw diff is 0 (no duplicates in source)', () => {
      const { report } = runAudit();
      expect(report!.dashboardMonthly.diff).toBe(0);
    });

    it('summary.rawTablesWithDiff should include pickup_weekly and stly_sales', () => {
      const { report } = runAudit();
      expect(report!.summary.rawTablesWithDiff).toEqual(
        expect.arrayContaining(['pickup_weekly', 'stly_sales'])
      );
    });
  });
});
