import assert from 'node:assert/strict';
import { PRODUCT_SHEET_ID, TEST_CONFIG } from './constants';
import {
  exportAllSheetsAPI,
  exportSheetAPI,
  importSheetAPI,
  syncAllSheetsAPI,
} from './cron-pages';
import {
  SURIPET_RESULT_SHEET_ID,
  SURIPET_SOURCE_SHEET_ID,
} from './lib/google-sheets/suripet-page-check';
import { isReadOnlySourceSheet } from './lib/google-sheets/write-target-guard';

const sourceFailure = new Error('source sync unavailable');
const pageExportFailure = new Error('page export unavailable');
const aggregateExportFailure = new Error('aggregate export unavailable');

const run = async (): Promise<void> => {
  assert.equal(SURIPET_SOURCE_SHEET_ID, PRODUCT_SHEET_ID);
  assert.equal(isReadOnlySourceSheet(SURIPET_SOURCE_SHEET_ID), true);
  assert.equal(SURIPET_RESULT_SHEET_ID, TEST_CONFIG.SHEET_ID);
  assert.equal(isReadOnlySourceSheet(SURIPET_RESULT_SHEET_ID), false);
  assert.notEqual(SURIPET_SOURCE_SHEET_ID, SURIPET_RESULT_SHEET_ID);

  await assert.rejects(
    syncAllSheetsAPI(async () => {
      throw sourceFailure;
    }),
    sourceFailure
  );

  await assert.rejects(
    importSheetAPI('pet', {
      importPet: async () => {
        throw sourceFailure;
      },
    }),
    sourceFailure
  );

  await assert.rejects(
    importSheetAPI('suripet', {
      importSuripet: async () => {
        throw sourceFailure;
      },
    }),
    sourceFailure
  );

  await assert.rejects(
    exportSheetAPI('pet', {
      exportPet: async () => {
        throw pageExportFailure;
      },
    }),
    pageExportFailure
  );

  await assert.rejects(
    exportSheetAPI('suripet', {
      exportSuripet: async () => {
        throw pageExportFailure;
      },
    }),
    pageExportFailure
  );

  await assert.rejects(
    exportAllSheetsAPI(async () => {
      throw aggregateExportFailure;
    }),
    aggregateExportFailure
  );
};

void run()
  .then(() => {
    process.stdout.write('cron pages fail-closed tests passed\n');
  })
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
