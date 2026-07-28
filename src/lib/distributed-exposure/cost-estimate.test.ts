import assert from 'node:assert/strict';
import {
  estimateRailwayWorkerCost,
  formatRailwayCost,
} from './cost-estimate';

const estimate = estimateRailwayWorkerCost(30, 105_000, {
  RAILWAY_COST_ESTIMATE_VCPU: '1',
  RAILWAY_COST_ESTIMATE_MEMORY_GB: '1',
  RAILWAY_COST_ESTIMATE_KRW_PER_USD: '1400',
});

assert.ok(Math.abs(estimate.runUsd - 0.036435) < 0.0000001);
assert.ok(Math.abs(estimate.monthlyUsd - 899.424) < 0.0000001);
assert.equal(formatRailwayCost(estimate.runUsd, estimate.runKrw), '$0.036 (약 51원)');

process.stdout.write('distributed cost estimate tests passed\n');
