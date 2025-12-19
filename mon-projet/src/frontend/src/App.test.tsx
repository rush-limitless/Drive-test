import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

test('renders loading state on initial render', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<App />);
  });

  expect(container.textContent?.toLowerCase()).toContain('loading interface');

  act(() => {
    root.unmount();
  });
  document.body.removeChild(container);
});
