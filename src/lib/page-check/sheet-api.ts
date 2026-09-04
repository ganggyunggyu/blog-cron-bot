import axios from 'axios';
import type { PageCheckSheetType } from '../../database';
import { logger } from '../logger';
import { PAGE_CHECK_SHEET_TYPE_NAMES } from './config';
import {
  exportPetSheetDirect,
  exportSuripetSheetDirect,
  syncPetKeywordsFromSheetToDB,
  syncSuripetKeywordsFromSheetToDB,
} from './sheet-direct';

const getPageCheckApi = (): string =>
  process.env.PAGE_CHECK_API || 'http://localhost:3000';

interface ImportAllResponse {
  data: {
    stats: Array<{ label: string; inserted: number }>;
    totalInserted: number;
  };
}

interface SheetCountResponse {
  data: {
    inserted?: number;
    count?: number;
  };
}

interface SheetExportResponse {
  data: {
    totalRows?: number;
    count?: number;
    updatedCells?: string | number;
  };
}

type ImportAllRequest = () => Promise<ImportAllResponse>;
type ImportSheetRequest = (
  sheetType: PageCheckSheetType
) => Promise<SheetCountResponse>;
type ExportSheetRequest = (
  sheetType: PageCheckSheetType
) => Promise<SheetExportResponse>;
type ExportAllRequest = () => Promise<SheetExportResponse>;

interface ImportSheetDependencies {
  importPageSheet: ImportSheetRequest;
  importPet: () => Promise<number>;
  importSuripet: () => Promise<number>;
}

interface ExportSheetDependencies {
  exportPageSheet: ExportSheetRequest;
  exportPet: () => Promise<void>;
  exportSuripet: () => Promise<void>;
}

export const syncAllSheetsAPI = async (
  request: ImportAllRequest = () =>
    axios.post(`${getPageCheckApi()}/api/page-check/import-all`)
): Promise<number> => {
  try {
    const res = await request();
    const { stats, totalInserted } = res.data;

    for (const result of stats) {
      logger.success(`  ${result.label}: ${result.inserted}개 동기화`);
    }

    return totalInserted;
  } catch (error) {
    logger.error(`시트 동기화 실패: ${(error as Error).message}`);
    throw error;
  }
};

export const exportSheetAPI = async (
  sheetType: PageCheckSheetType,
  dependencies: Partial<ExportSheetDependencies> = {}
): Promise<void> => {
  const exportPageSheet =
    dependencies.exportPageSheet ??
    ((targetSheetType: PageCheckSheetType) =>
      axios.post(`${getPageCheckApi()}/api/page-check/export`, {
        sheetType: targetSheetType,
      }));
  const exportSuripet =
    dependencies.exportSuripet ?? exportSuripetSheetDirect;
  const exportPet = dependencies.exportPet ?? exportPetSheetDirect;

  try {
    if (sheetType === 'pet') return await exportPet();
    if (sheetType === 'suripet') return await exportSuripet();

    const res = await exportPageSheet(sheetType);
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  ${PAGE_CHECK_SHEET_TYPE_NAMES[sheetType]}: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
  } catch (error) {
    logger.error(
      `  ${PAGE_CHECK_SHEET_TYPE_NAMES[sheetType]} 내보내기 실패: ${(error as Error).message}`
    );
    throw error;
  }
};

export const importSheetAPI = async (
  sheetType: PageCheckSheetType,
  dependencies: Partial<ImportSheetDependencies> = {}
): Promise<number> => {
  const importPageSheet =
    dependencies.importPageSheet ??
    ((targetSheetType: PageCheckSheetType) =>
      axios.post(`${getPageCheckApi()}/api/page-check/import`, {
        sheetType: targetSheetType,
      }));
  const importSuripet =
    dependencies.importSuripet ?? syncSuripetKeywordsFromSheetToDB;
  const importPet = dependencies.importPet ?? syncPetKeywordsFromSheetToDB;

  try {
    if (sheetType === 'pet') return await importPet();
    if (sheetType === 'suripet') return await importSuripet();

    const res = await importPageSheet(sheetType);
    const inserted = res.data.inserted ?? res.data.count ?? 0;
    logger.success(
      `  ${PAGE_CHECK_SHEET_TYPE_NAMES[sheetType]}: ${inserted}개 동기화`
    );
    return inserted;
  } catch (error) {
    logger.error(
      `  ${PAGE_CHECK_SHEET_TYPE_NAMES[sheetType]} 불러오기 실패: ${(error as Error).message}`
    );
    throw error;
  }
};

export const exportAllSheetsAPI = async (
  request: ExportAllRequest = () =>
    axios.post(`${getPageCheckApi()}/api/page-check/export-all`)
): Promise<void> => {
  try {
    const res = await request();
    const totalRows = res.data.totalRows ?? res.data.count ?? 0;
    const updatedCells = res.data.updatedCells ?? '';
    logger.success(
      `  종합: ${totalRows}개 내보내기${updatedCells ? ` (${updatedCells}셀)` : ''}`
    );
  } catch (error) {
    logger.error(`  종합 내보내기 실패: ${(error as Error).message}`);
    throw error;
  }
};
