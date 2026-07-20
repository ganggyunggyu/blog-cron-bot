import assert from 'node:assert/strict';
import {
  getExposureConcurrency,
  getExposureKeywordBatchSize,
  getExposureMaxPages,
  getExposureRetryDelayMs,
  getGuestRetryAttempts,
  getLoginRetryAttempts,
  splitConcurrencyBudget,
} from './exposure-run-config';

assert.equal(getExposureConcurrency({}), 8);
assert.equal(getExposureConcurrency({ EXPOSURE_CONCURRENCY: '4' }), 4);
assert.equal(getExposureConcurrency({ PAGE_CHECK_CONCURRENCY: '5' }), 5);
assert.equal(
  getExposureConcurrency({
    EXPOSURE_CONCURRENCY: 'invalid',
    PAGE_CHECK_CONCURRENCY: '3',
  }),
  3
);
assert.equal(getExposureConcurrency({ EXPOSURE_CONCURRENCY: '99' }), 8);
assert.equal(getExposureConcurrency({ EXPOSURE_CONCURRENCY: '1.5' }), 8);
assert.equal(getExposureKeywordBatchSize({}), 50);
assert.equal(
  getExposureKeywordBatchSize({ EXPOSURE_KEYWORD_BATCH_SIZE: '25' }),
  25
);
assert.equal(
  getExposureKeywordBatchSize({ EXPOSURE_KEYWORD_BATCH_SIZE: 'invalid' }),
  50
);

assert.equal(getExposureMaxPages(1, {}), 1);
assert.equal(getExposureMaxPages(4, { EXPOSURE_MAX_PAGES: '7' }), 7);
assert.equal(getExposureMaxPages(4, { PAGE_CHECK_MAX_PAGES: '9' }), 9);
assert.equal(getExposureMaxPages(4, { EXPOSURE_MAX_PAGES: '99' }), 9);
assert.equal(
  getExposureMaxPages(4, {
    EXPOSURE_MAX_PAGES: '0',
    PAGE_CHECK_MAX_PAGES: '5',
  }),
  5
);
assert.equal(getExposureMaxPages(4, { EXPOSURE_MAX_PAGES: 'invalid' }), 4);
assert.equal(getGuestRetryAttempts({}), 2);
assert.equal(getGuestRetryAttempts({ FAST_EXPOSURE_MODE: 'true' }), 1);
assert.equal(getLoginRetryAttempts(5, {}), 5);
assert.equal(getLoginRetryAttempts(5, { FAST_EXPOSURE_MODE: 'true' }), 2);
assert.equal(
  getLoginRetryAttempts(5, { EXPOSURE_LOGIN_RETRIES: '3' }),
  3
);
assert.equal(getExposureRetryDelayMs(60_000, {}), 60_000);
assert.equal(
  getExposureRetryDelayMs(60_000, { FAST_EXPOSURE_MODE: 'true' }),
  3_000
);
assert.equal(
  getExposureRetryDelayMs(60_000, { EXPOSURE_RETRY_DELAY_MS: '1500' }),
  1_500
);

assert.deepEqual(splitConcurrencyBudget(6, 1), {
  taskConcurrency: 1,
  perTaskConcurrency: 6,
});
assert.deepEqual(splitConcurrencyBudget(6, 3), {
  taskConcurrency: 3,
  perTaskConcurrency: 2,
});
assert.deepEqual(splitConcurrencyBudget(6, 9), {
  taskConcurrency: 6,
  perTaskConcurrency: 1,
});

process.stdout.write('exposure run config tests passed\n');
