import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './calculator.css';

export type BinaryOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'power';
export type UnaryOperation = 'sqrt' | 'percent';
export type Operation = BinaryOperation | UnaryOperation;

/** Único punto de entrada al backend. Rechaza la promesa con un Error cuyo `message` se mostrará al usuario. */
export type CalculateFn = (operation: Operation, operands: number[]) => Promise<number>;

export type CalculatorStatus = 'idle' | 'typing' | 'loading' | 'success' | 'error';

export interface CalculatorError {
  kind: 'validation' | 'backend';
  message: string;
}

export interface HistoryEntry {
  id: number;
  expression: string;
  result: string;
}

export interface CalculatorState {
  input: string;
  expression: string;
  pending: { operand: number; operation: BinaryOperation } | null;
  /** El siguiente dígito reemplaza el display (tras un resultado u operador). */
  overwrite: boolean;
  /** Hay operador pendiente y aún no se ha escrito el segundo operando. */
  awaitingOperand: boolean;
  status: CalculatorStatus;
  error: CalculatorError | null;
  history: HistoryEntry[];
}

export interface CalculatorProps {
  onCalculate: CalculateFn;
  theme?: 'system' | 'light' | 'dark';
  /** Escucha el teclado en window (true) o solo cuando el foco está dentro del componente (false). */
  globalKeyboard?: boolean;
  /** Por defecto: abierto en ≥768px, cerrado en móvil. */
  defaultHistoryOpen?: boolean;
  /** Útil para tests y Storybook. */
  initialState?: Partial<CalculatorState>;
  maxDigits?: number;
  historyLimit?: number;
  className?: string;
}

type KeyId =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'dot' | 'sign' | 'clear' | 'back' | 'equals' | Operation;

interface KeyDef {
  id: KeyId;
  label: ReactNode;
  aria: string;
  shortcut: string;
  variant: 'digit' | 'fn' | 'op' | 'equals';
  span?: 'col' | 'row';
}

const SYMBOL: Record<Operation, string> = {
  add: '+', subtract: '−', multiply: '×', divide: '÷', power: '^', sqrt: '√', percent: '%',
};

const BINARY = new Set<KeyId>(['add', 'subtract', 'multiply', 'divide', 'power']);

const BackspaceIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z" />
    <path d="m12 9.5 5 5m0-5-5 5" />
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </svg>
);

const digit = (d: KeyId): KeyDef => ({ id: d, label: d, aria: d, shortcut: d, variant: 'digit' });

const KEYS: KeyDef[] = [
  { id: 'clear', label: 'C', aria: 'Limpiar todo', shortcut: 'Escape', variant: 'fn' },
  { id: 'back', label: <BackspaceIcon />, aria: 'Borrar último dígito', shortcut: 'Backspace', variant: 'fn' },
  { id: 'percent', label: '%', aria: 'Porcentaje', shortcut: '%', variant: 'op' },
  { id: 'divide', label: '÷', aria: 'Dividir', shortcut: '/', variant: 'op' },
  { id: 'sqrt', label: '√', aria: 'Raíz cuadrada', shortcut: 'R', variant: 'op' },
  { id: 'power', label: <span>x<sup>y</sup></span>, aria: 'Potencia', shortcut: '^', variant: 'op' },
  { id: 'sign', label: '±', aria: 'Cambiar signo', shortcut: 'F9', variant: 'fn' },
  { id: 'multiply', label: '×', aria: 'Multiplicar', shortcut: '*', variant: 'op' },
  digit('7'), digit('8'), digit('9'),
  { id: 'subtract', label: '−', aria: 'Restar', shortcut: '-', variant: 'op' },
  digit('4'), digit('5'), digit('6'),
  { id: 'add', label: '+', aria: 'Sumar', shortcut: '+', variant: 'op' },
  digit('1'), digit('2'), digit('3'),
  { id: 'equals', label: '=', aria: 'Calcular resultado', shortcut: 'Enter', variant: 'equals', span: 'row' },
  { ...digit('0'), span: 'col' },
  { id: 'dot', label: '.', aria: 'Punto decimal', shortcut: '.', variant: 'digit' },
];

const KEYMAP: Record<string, KeyId> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': 'dot', ',': 'dot',
  '+': 'add', '-': 'subtract', '*': 'multiply', x: 'multiply', X: 'multiply', '/': 'divide',
  '^': 'power', r: 'sqrt', R: 'sqrt', '%': 'percent',
  Enter: 'equals', '=': 'equals',
  Escape: 'clear', Delete: 'clear', Backspace: 'back', F9: 'sign',
};

const INITIAL: CalculatorState = {
  input: '0',
  expression: '',
  pending: null,
  overwrite: false,
  awaitingOperand: false,
  status: 'idle',
  error: null,
  history: [],
};

export function formatNumber(n: number): string {
  if (Object.is(n, -0)) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e16 || abs < 1e-9)) return n.toExponential(8).replace(/\.?0+e/, 'e');
  return String(parseFloat(n.toPrecision(15)));
}

const pendingExpression = (p: NonNullable<CalculatorState['pending']>) =>
  `${formatNumber(p.operand)} ${SYMBOL[p.operation]}`;

const errorMessage = (err: unknown) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'No se pudo completar la operación';
};

export function Calculator({
  onCalculate,
  theme = 'system',
  globalKeyboard = true,
  defaultHistoryOpen,
  initialState,
  maxDigits = 16,
  historyLimit = 20,
  className,
}: CalculatorProps) {
  const [state, setState] = useState<CalculatorState>(() => ({ ...INITIAL, ...initialState }));
  const [pressed, setPressed] = useState<KeyId | null>(null);
  const [historyOpen, setHistoryOpen] = useState<boolean>(
    () => defaultHistoryOpen ?? (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches),
  );
  const historyId = useId();

  const stateRef = useRef(state);
  stateRef.current = state;
  const onCalculateRef = useRef(onCalculate);
  onCalculateRef.current = onCalculate;
  const requestId = useRef(0);
  const historySeq = useRef(initialState?.history?.length ?? 0);
  const pressTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    requestId.current += 1; // descarta respuestas tras desmontar
    window.clearTimeout(pressTimer.current);
  }, []);

  const patch = (p: Partial<CalculatorState>) => setState((s) => ({ ...s, ...p }));

  const invalid = (message: string) => patch({ status: 'error', error: { kind: 'validation', message } });

  const run = async (
    operation: Operation,
    operands: number[],
    loadingExpression: string,
    historyExpression: string,
    onSuccess: (formatted: string, result: number) => Partial<CalculatorState>,
  ) => {
    const id = ++requestId.current;
    patch({ status: 'loading', error: null, expression: loadingExpression });
    try {
      const result = await onCalculateRef.current(operation, operands);
      if (id !== requestId.current) return;
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('El resultado está fuera de rango');
      }
      const formatted = formatNumber(result);
      setState((s) => ({
        ...s,
        status: 'success',
        error: null,
        ...onSuccess(formatted, result),
        history: [
          { id: ++historySeq.current, expression: historyExpression, result: formatted },
          ...s.history,
        ].slice(0, historyLimit),
      }));
    } catch (err) {
      if (id !== requestId.current) return;
      setState((s) => ({
        ...s,
        status: 'error',
        error: { kind: 'backend', message: errorMessage(err) },
        pending: null,
        overwrite: true,
        awaitingOperand: false,
      }));
    }
  };

  const press = (id: KeyId) => {
    const s = stateRef.current;
    if (s.status === 'loading') return;
    const typingExpression = s.pending ? pendingExpression(s.pending) : '';

    if (/^\d$/.test(id)) {
      const current = s.overwrite ? '0' : s.input;
      if (!s.overwrite && current.replace(/[-.]/g, '').length >= maxDigits) {
        return invalid(`Máximo ${maxDigits} dígitos`);
      }
      const input = current === '0' ? id : current === '-0' ? `-${id}` : current + id;
      return patch({ input, overwrite: false, awaitingOperand: false, status: 'typing', error: null, expression: typingExpression });
    }

    switch (id) {
      case 'dot': {
        const current = s.overwrite ? '0' : s.input;
        if (current.includes('.')) return invalid('El número ya tiene punto decimal');
        return patch({ input: `${current}.`, overwrite: false, awaitingOperand: false, status: 'typing', error: null, expression: typingExpression });
      }
      case 'sign': {
        if (s.awaitingOperand) {
          return patch({ input: '-0', overwrite: false, awaitingOperand: false, status: 'typing', error: null });
        }
        const input = s.input.startsWith('-') ? s.input.slice(1) : `-${s.input}`;
        return patch({ input, status: 'typing', error: null });
      }
      case 'back': {
        if (s.overwrite) return patch({ error: null, status: s.status === 'error' ? 'idle' : s.status });
        let input = s.input.slice(0, -1);
        if (input === '' || input === '-') input = '0';
        return patch({ input, error: null, status: input === '0' && !s.pending ? 'idle' : 'typing' });
      }
      case 'clear':
        return setState((x) => ({ ...INITIAL, history: x.history }));
      case 'equals': {
        if (!s.pending) {
          if (s.status === 'success') return patch({ error: null });
          return invalid('Operación incompleta: elige un operador');
        }
        if (s.awaitingOperand) return invalid('Falta el segundo operando');
        const p = s.pending;
        const value = Number(s.input);
        const expr = `${formatNumber(p.operand)} ${SYMBOL[p.operation]} ${formatNumber(value)}`;
        return run(p.operation, [p.operand, value], `${expr} =`, expr, (f) => ({
          input: f, pending: null, expression: `${expr} =`, overwrite: true, awaitingOperand: false,
        }));
      }
      case 'sqrt':
      case 'percent': {
        const value = Number(s.input);
        const inner = id === 'sqrt' ? `√(${formatNumber(value)})` : `${formatNumber(value)}%`;
        const shown = s.pending ? `${pendingExpression(s.pending)} ${inner}` : `${inner} =`;
        return run(id, [value], shown, inner, (f) => ({
          input: f, expression: shown, overwrite: true, awaitingOperand: false,
        }));
      }
      default: {
        if (!BINARY.has(id)) return;
        const operation = id as BinaryOperation;
        if (s.pending && s.awaitingOperand) {
          const pending = { ...s.pending, operation };
          return patch({ pending, expression: pendingExpression(pending), status: 'typing', error: null });
        }
        const value = Number(s.input);
        if (!Number.isFinite(value)) return invalid('Número no válido');
        if (s.pending) {
          const p = s.pending;
          const expr = `${formatNumber(p.operand)} ${SYMBOL[p.operation]} ${formatNumber(value)}`;
          return run(p.operation, [p.operand, value], expr, expr, (f, r) => ({
            input: f,
            pending: { operand: r, operation },
            expression: `${f} ${SYMBOL[operation]}`,
            overwrite: true,
            awaitingOperand: true,
            status: 'typing',
          }));
        }
        const pending = { operand: value, operation };
        return patch({
          input: formatNumber(value), pending, expression: pendingExpression(pending),
          overwrite: true, awaitingOperand: true, status: 'typing', error: null,
        });
      }
    }
  };

  const pressRef = useRef(press);
  pressRef.current = press;

  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const id = KEYMAP[e.key];
    if (!id) return;
    // Enter sobre un botón que no es tecla (historial, toggle) conserva su acción nativa.
    if (e.key === 'Enter' && target instanceof HTMLButtonElement && !target.dataset.key) return;
    e.preventDefault();
    if (stateRef.current.status === 'loading') return;
    setPressed(id);
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressed(null), 140);
    pressRef.current(id);
  };
  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;

  useEffect(() => {
    if (!globalKeyboard) return;
    const listener = (e: KeyboardEvent) => handleKeyRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [globalKeyboard]);

  const recall = (entry: HistoryEntry) =>
    setState((x) => ({
      ...x,
      input: entry.result,
      overwrite: true,
      awaitingOperand: false,
      status: 'typing',
      error: null,
      expression: x.pending ? pendingExpression(x.pending) : '',
    }));

  const loading = state.status === 'loading';
  const display = state.input.replace('-', '−');
  const size = display.length > 13 ? 'sm' : display.length > 9 ? 'md' : 'lg';
  const count = state.history.length;

  return (
    <section
      className={['calc', className].filter(Boolean).join(' ')}
      data-theme={theme === 'system' ? undefined : theme}
      data-history={historyOpen ? 'open' : 'closed'}
      aria-label="Calculadora"
      aria-busy={loading}
      onKeyDown={globalKeyboard ? undefined : (e) => handleKey(e.nativeEvent)}
    >
      <div className="calc__layout">
        <div className="calc__main">
          <div className="calc__toolbar">
            <button
              type="button"
              className="calc__toggle"
              aria-expanded={historyOpen}
              aria-controls={historyId}
              onClick={() => setHistoryOpen((o) => !o)}
            >
              <HistoryIcon />
              <span>Historial</span>
              {count > 0 && <span className="calc__count" aria-label={`${count} operaciones`}>{count}</span>}
            </button>
          </div>

          <div className="calc__screen">
            <div className="calc__display" role="status" aria-live="polite" aria-atomic="true" data-status={state.status}>
              <div className="calc__expression">{state.expression || ' '}</div>
              <div className="calc__value" data-size={size}>{display}</div>
              {loading && <span className="calc__sr">Calculando…</span>}
            </div>
            <div className="calc__progress" data-active={loading} aria-hidden="true" />
            <p className="calc__message" data-kind={state.error?.kind} aria-live="polite">
              {state.error?.message}
            </p>
          </div>

          <div className="calc__keypad" role="group" aria-label="Teclado de la calculadora">
            {KEYS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="calc__key"
                data-key={k.id}
                data-variant={k.variant}
                data-span={k.span}
                data-pressed={pressed === k.id || undefined}
                aria-label={k.aria}
                aria-keyshortcuts={k.shortcut}
                aria-pressed={BINARY.has(k.id) ? state.awaitingOperand && state.pending?.operation === k.id : undefined}
                aria-disabled={loading || undefined}
                onClick={() => press(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <aside className="calc__history" id={historyId} hidden={!historyOpen} aria-label="Historial de operaciones">
          <div className="calc__history-head">
            <h2 className="calc__history-title">Historial</h2>
            {count > 0 && (
              <button type="button" className="calc__link" onClick={() => patch({ history: [] })} disabled={loading}>
                Borrar
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="calc__empty">Las operaciones que calcules aparecerán aquí.</p>
          ) : (
            <ol className="calc__history-list">
              {state.history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="calc__history-item"
                    onClick={() => recall(h)}
                    disabled={loading}
                    aria-label={`${h.expression} igual a ${h.result}. Usar resultado`}
                  >
                    <span className="calc__history-expr">{h.expression} =</span>
                    <span className="calc__history-result">{h.result}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}

export default Calculator;
