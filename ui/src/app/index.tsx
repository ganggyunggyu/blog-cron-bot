import React from 'react';
import { AppProviders } from '@/app/providers';
import { HomePage } from '@/pages/home';

export const App = () => {
  return (
    <React.Fragment>
      <AppProviders>
        <HomePage />
      </AppProviders>
    </React.Fragment>
  );
};
