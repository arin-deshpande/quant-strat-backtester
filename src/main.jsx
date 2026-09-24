import React from 'react';
import { createRoot } from 'react-dom/client';
import QuantBacktest from './QuantBacktest';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QuantBacktest />
  </React.StrictMode>
);
