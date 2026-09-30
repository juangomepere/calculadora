import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// Default handler mirrors the real backend for the happy path and the one error
// the UI tests care about (division by zero). Individual tests override as needed.
export const handlers = [
  http.post(`${API_URL}/api/v1/calculate`, async ({ request }) => {
    const { operation, operands } = (await request.json()) as {
      operation: string;
      operands: number[];
    };

    if (operation === 'divide' && operands[1] === 0) {
      return HttpResponse.json(
        { error: { code: 'DIVISION_BY_ZERO', message: 'No se puede dividir entre cero' } },
        { status: 400 }
      );
    }

    const table: Record<string, (o: number[]) => number> = {
      add: (o) => o[0] + o[1],
      subtract: (o) => o[0] - o[1],
      multiply: (o) => o[0] * o[1],
      divide: (o) => o[0] / o[1],
      power: (o) => Math.pow(o[0], o[1]),
      sqrt: (o) => Math.sqrt(o[0]),
      percentage: (o) => (o[0] * o[1]) / 100,
    };

    const fn = table[operation];
    if (!fn) {
      return HttpResponse.json(
        { error: { code: 'UNKNOWN_OPERATION', message: 'unknown operation' } },
        { status: 400 }
      );
    }
    return HttpResponse.json({ operation, operands, result: fn(operands) });
  }),
];

export const server = setupServer(...handlers);
