// Isolated API layer: the only place the frontend talks to the backend. It owns
// the shared request/response types, a typed fetch, a timeout via AbortController,
// and the distinction between network failures and backend business errors.

export type Operation =
  'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'sqrt' | 'percentage';

export interface CalculateResponse {
  operation: string;
  operands: number[];
  result: number;
}

interface BackendErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/**
 * CalculatorError represents any failure surfaced to the UI. `code` is a stable
 * identifier: backend business errors keep the backend's code (e.g.
 * DIVISION_BY_ZERO); transport failures use TIMEOUT or NETWORK_ERROR.
 */
export class CalculatorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CalculatorError';
    this.code = code;
  }
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const TIMEOUT_MS = 10_000;

function isBackendErrorBody(value: unknown): value is BackendErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

export async function calculate(
  operation: Operation,
  operands: number[]
): Promise<CalculateResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation, operands }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new CalculatorError('TIMEOUT', 'La solicitud tardó demasiado. Inténtalo de nuevo.');
    }
    throw new CalculatorError('NETWORK_ERROR', 'No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timeout);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isBackendErrorBody(body)) {
      throw new CalculatorError(body.error.code, body.error.message);
    }
    throw new CalculatorError('HTTP_ERROR', `Error del servidor (${response.status}).`);
  }

  return body as CalculateResponse;
}
