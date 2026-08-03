'use client';

import React from 'react';
import { PresetManager } from '@/widgets/preset-manager';

/**
 * 계정은 프리셋 한 곳에서만 관리한다.
 *
 * 예전에는 관리 계정 목록 탭이 따로 있어서 도그마루·서리펫만 그쪽에서, 나머지는 프리셋에서
 * 정해야 했다. 어디를 고쳐야 실행에 반영되는지가 대상마다 달라 새로 넣은 계정이 조용히
 * 빠지는 일이 있었다.
 */
export const SettingsWorkspace = () => {
  return <PresetManager />;
};
