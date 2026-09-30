import type { CalculateFn } from './components/Calculator';
import { calculate } from './api/calculator';

/**
 * Bridges the UI component to the API layer. The design component models "%" as
 * a unary `percent`; the backend exposes it as `percentage`. All arithmetic is
 * resolved by the backend — this only maps names and unwraps the result.
 */
export const calculateForUi: CalculateFn = async (operation, operands) => {
  const apiOperation = operation === 'percent' ? 'percentage' : operation;
  const { result } = await calculate(apiOperation, operands);
  return result;
};
