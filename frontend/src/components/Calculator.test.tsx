import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { Calculator } from './Calculator';
import { calculateForUi } from '../calculate';
import { server } from '../test/mswServer';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// Render the real component wired to the real API adapter; MSW stands in for the
// backend. defaultHistoryOpen is fixed so tests don't depend on matchMedia.
function renderCalculator() {
  return render(<Calculator onCalculate={calculateForUi} defaultHistoryOpen={false} />);
}

const display = () => document.querySelector('.calc__value') as HTMLElement;
const key = (name: string) => screen.getByRole('button', { name });

describe('Calculator', () => {
  beforeEach(() => {
    document.body.focus();
  });

  it('renders the initial state', () => {
    renderCalculator();
    expect(screen.getByRole('region', { name: 'Calculadora' })).toBeInTheDocument();
    expect(display()).toHaveTextContent('0');
    // A representative sample of keys is present.
    expect(key('Sumar')).toBeInTheDocument();
    expect(key('Calcular resultado')).toBeInTheDocument();
    expect(key('Raíz cuadrada')).toBeInTheDocument();
  });

  it('runs a keystroke sequence, sends the right payload and renders the result', async () => {
    const user = userEvent.setup();
    let captured: unknown = null;
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ operation: 'add', operands: [2, 3], result: 5 });
      })
    );

    renderCalculator();
    await user.click(key('2'));
    await user.click(key('Sumar'));
    await user.click(key('3'));
    await user.click(key('Calcular resultado'));

    await waitFor(() => expect(display()).toHaveTextContent('5'));
    expect(captured).toEqual({ operation: 'add', operands: [2, 3] });
  });

  it('renders the division-by-zero error from the backend', async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(key('5'));
    await user.click(key('Dividir'));
    await user.click(key('0'));
    await user.click(key('Calcular resultado'));

    const message = await screen.findByText('No se puede dividir entre cero');
    expect(message).toHaveAttribute('data-kind', 'backend');
  });

  it('shows a loading state while the request is in flight', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, async () => {
        await delay(60);
        return HttpResponse.json({ operation: 'add', operands: [2, 3], result: 5 });
      })
    );

    renderCalculator();
    await user.click(key('2'));
    await user.click(key('Sumar'));
    await user.click(key('3'));
    await user.click(key('Calcular resultado'));

    // The screen-reader "Calculando…" text only renders during loading.
    expect(await screen.findByText('Calculando…')).toBeInTheDocument();
    await waitFor(() => expect(display()).toHaveTextContent('5'));
    expect(screen.queryByText('Calculando…')).not.toBeInTheDocument();
  });

  it('supports keyboard shortcuts (global)', async () => {
    const user = userEvent.setup();
    let captured: unknown = null;
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ operation: 'multiply', operands: [6, 7], result: 42 });
      })
    );

    renderCalculator();
    await user.keyboard('6*7{Enter}');

    await waitFor(() => expect(display()).toHaveTextContent('42'));
    expect(captured).toEqual({ operation: 'multiply', operands: [6, 7] });
  });

  it('sends a single operand for the unary square root', async () => {
    const user = userEvent.setup();
    let captured: unknown = null;
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ operation: 'sqrt', operands: [144], result: 12 });
      })
    );

    renderCalculator();
    await user.click(key('1'));
    await user.click(key('4'));
    await user.click(key('4'));
    await user.click(key('Raíz cuadrada'));

    await waitFor(() => expect(display()).toHaveTextContent('12'));
    expect(captured).toEqual({ operation: 'sqrt', operands: [144] });
  });

  it('clears the display with C and edits with backspace/sign', async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(key('7'));
    await user.click(key('8'));
    expect(display()).toHaveTextContent('78');
    await user.click(key('Borrar último dígito'));
    expect(display()).toHaveTextContent('7');
    await user.click(key('Cambiar signo'));
    expect(display()).toHaveTextContent('−7');
    await user.click(key('Limpiar todo'));
    expect(display()).toHaveTextContent('0');
  });

  it('shows a validation error when equals is pressed without an operator', async () => {
    const user = userEvent.setup();
    renderCalculator();
    await user.click(key('5'));
    await user.click(key('Calcular resultado'));
    const message = await screen.findByText('Operación incompleta: elige un operador');
    expect(message).toHaveAttribute('data-kind', 'validation');
  });

  it('records successful operations in the history panel', async () => {
    const user = userEvent.setup();
    render(<Calculator onCalculate={calculateForUi} defaultHistoryOpen={true} />);

    await user.click(key('8'));
    await user.click(key('Sumar'));
    await user.click(key('1'));
    await user.click(key('Calcular resultado'));

    await waitFor(() => expect(display()).toHaveTextContent('9'));
    const history = screen.getByRole('complementary', { name: 'Historial de operaciones' });
    expect(within(history).getByText('8 + 1 =')).toBeInTheDocument();
  });
});
