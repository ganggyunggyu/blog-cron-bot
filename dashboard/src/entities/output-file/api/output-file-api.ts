import { api } from '@/shared';
import type { OutputFileListResult } from '../model/types';

export const getOutputFileList = async () => {
  const { data } = await api.get<OutputFileListResult>('/outputs');
  return data;
};

export const getOutputDownloadUrl = (relativePath: string) =>
  `/api/outputs/download?path=${encodeURIComponent(relativePath)}`;
