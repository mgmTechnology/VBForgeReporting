import React from 'react';
import ForgeReconciler, { Heading, Stack } from '@forge/react';
import { VacationPlanner } from './components/VacationPlanner';

/**
 * Einstiegspunkt der Global Page: Urlaubsplanung für selbst definierte Teams.
 */
const App = () => (
  <Stack space="space.200" testId="app-root">
    <Heading size="large" testId="app-heading">Urlaubsplanung</Heading>
    <VacationPlanner />
  </Stack>
);

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
