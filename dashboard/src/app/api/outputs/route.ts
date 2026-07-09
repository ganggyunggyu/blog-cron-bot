import { NextResponse } from 'next/server';
import { listOutputFiles } from '@/server/output-scanner';

export const GET = async () => {
  return NextResponse.json(listOutputFiles());
};
