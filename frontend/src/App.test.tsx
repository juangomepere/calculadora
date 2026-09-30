import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import App from './App';
import { calculateForUi } from './calculate';
import { server } from './test/mswServer';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

describe('App', () => {
  it('renders the calculator', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Calculadora' })).toBeInTheDocument();
  });

  it('computes an end-to-end result through the real adapter', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard('9-4{Enter}');
    await waitFor(() => expect(document.querySelector('.calc__value')).toHaveTextContent('5'));
  });

  it('maps the UI "percent" operation to the backend "percentage"', async () => {
    let captured: unknown = null;
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ operation: 'percentage', operands: [50], result: 0.5 });
      })
    );

    const result = await calculateForUi('percent', [50]);
    expect(result).toBe(0.5);
    expect(captured).toEqual({ operation: 'percentage', operands: [50] });
  });
});
