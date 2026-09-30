import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { calculate, CalculatorError } from './calculator';
import { server } from '../test/mswServer';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

describe('calculate', () => {
  it('sends the payload and returns the parsed result', async () => {
    const res = await calculate('add', [2, 3]);
    expect(res).toEqual({ operation: 'add', operands: [2, 3], result: 5 });
  });

  it('maps a backend business error to a CalculatorError with its code', async () => {
    await expect(calculate('divide', [1, 0])).rejects.toMatchObject({
      name: 'CalculatorError',
      code: 'DIVISION_BY_ZERO',
    });
  });

  it('reports a network failure as NETWORK_ERROR', async () => {
    server.use(http.post(`${API_URL}/api/v1/calculate`, () => HttpResponse.error()));
    await expect(calculate('add', [1, 2])).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('falls back to HTTP_ERROR when the error body is not the expected shape', async () => {
    server.use(
      http.post(`${API_URL}/api/v1/calculate`, () =>
        HttpResponse.json({ nope: true }, { status: 500 })
      )
    );
    const err = await calculate('add', [1, 2]).catch((e) => e);
    expect(err).toBeInstanceOf(CalculatorError);
    expect(err.code).toBe('HTTP_ERROR');
  });
});
