import React from 'react';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, readSessionToken } from '@/server/auth';
import { AppHeader } from '@/widgets/app-header';
import { SheetMap } from '@/widgets/sheet-map';

const SheetsPage = async () => {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <div className="min-h-screen flex-1 bg-[var(--paper)]">
      <AppHeader current="/sheets" memberId={session?.memberId} />

      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6">
        <SheetMap />
      </main>
    </div>
  );
};

export default SheetsPage;
