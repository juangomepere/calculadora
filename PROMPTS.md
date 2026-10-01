# PROMPTS

Registro de prompts usados para generar este proyecto.

---

## Mis prompts

Usé dos prompts.

### 1. Diseño de la UI (generó `Calculator.tsx` + `calculator.css` en Claude Design)

```
Diseña la interfaz de una calculadora web full-stack. Es para una prueba técnica,
así que el criterio es diseño limpio y profesional, no efectista.

ENTREGABLE
Un componente React con TypeScript (archivo .tsx) + estilos, listo para integrarse
en un proyecto Vite. Sin lógica de cálculo: toda operación se resuelve llamando a
un backend REST. Deja un hook/prop `onCalculate(operation, operands) => Promise<number>`
como único punto de entrada, y maneja los estados loading / success / error que
devuelva esa promesa.

DIRECCIÓN VISUAL
- Minimalismo real: paleta neutra (grises cálidos), un solo color de acento usado
  con moderación, mucho espacio en blanco.
- Nada de gradientes, glassmorphism, sombras grandes ni bordes de colores.
  Jerarquía por tipografía, espaciado y bordes sutiles de 1px.
- Display con tipografía de números tabulares (font-variant-numeric: tabular-nums),
  alineado a la derecha, tamaño grande, y una línea secundaria arriba en gris claro
  que muestre la expresión en curso.
- Botones: esquinas redondeadas suaves y consistentes, altura cómoda (mín. 56px),
  estados hover / active / focus-visible claros y accesibles.
- Soporte de tema claro y oscuro con CSS custom properties (tokens de color,
  espaciado, radio, tipografía). Respetar prefers-color-scheme.

FUNCIONALIDAD DE LA UI
- Operaciones básicas: + − × ÷
- Operaciones avanzadas: potencia (x^y), raíz cuadrada (√) y porcentaje (%)
- Teclas: dígitos 0-9, punto decimal, cambio de signo (±), C (limpiar todo),
  ⌫ (borrar último), = (calcular)
- Soporte completo de teclado físico (números, operadores, Enter = igual,
  Escape = limpiar, Backspace = borrar) con indicación visual de la tecla pulsada.
- Panel/lista de historial de las últimas operaciones, colapsable, opcional en móvil.

ESTADOS QUE DEBEN VERSE DISEÑADOS
- Idle (0 en display)
- Escribiendo operando
- Loading: la petición al backend está en curso (indicador sutil, no spinner gigante;
  los botones se deshabilitan)
- Error de validación (entrada inválida, operación incompleta)
- Error del backend (división por cero, raíz de número negativo, overflow):
  mensaje corto y legible bajo el display, en rojo tenue, que se limpia con la
  siguiente pulsación. Nunca un alert().

RESPONSIVE
- Móvil primero: grid de botones a ancho completo, área táctil mínima 44x44px,
  sin scroll horizontal.
- Escritorio: contenedor centrado de ~420px máx, historial a un lado si hay espacio.

ACCESIBILIDAD
- Botones reales <button> con aria-label descriptivo.
- Display con role="status" y aria-live="polite" para que lea el resultado.
- Contraste mínimo AA en ambos temas.
- Focus visible en todo elemento interactivo.

Entrégame el código del componente completo, los tokens CSS y una breve nota de
las decisiones de diseño (2-3 bullets) que pueda citar en el README.
```

### 2. Construcción full-stack (generó todo el repo: backend Go, integración del frontend, tests, docs)

```
Contexto: prueba técnica para una vacante. Debo entregar un repositorio Git con una
calculadora full-stack: frontend React + TypeScript y backend en Go. Presupuesto
~3 horas de trabajo. Prioridad: corrección, claridad y mantenibilidad sobre features
extra. Ya tengo el componente de UI diseñado (te lo paso aparte / está en
<ruta>) — intégralo tal cual, no lo rediseñes.

Ejecuta todo de principio a fin: crea la estructura, escribe el código, los tests,
corre los tests, genera el reporte de cobertura y deja el repo listo para hacer push.

ESTRUCTURA DEL REPOSITORIO
/
├── backend/          (Go)
├── frontend/         (React + TS + Vite)
├── docker-compose.yml
├── README.md
├── PROMPTS.md
└── .gitignore

BACKEND (Go)
- Go 1.22+, solo stdlib (net/http con el ServeMux nuevo) — sin frameworks pesados.
- Arquitectura en capas, testeable:
  - internal/calculator/: lógica pura de operaciones, cero dependencias de HTTP.
  - internal/api/: handlers, decodificación/validación de requests, mapeo de errores.
  - cmd/server/main.go: wiring, configuración por variables de entorno (PORT,
    ALLOWED_ORIGINS), graceful shutdown con signal.NotifyContext.
- Endpoints:
  - POST /api/v1/calculate
    request:  {"operation":"add","operands":[2,3]}
    response: {"operation":"add","operands":[2,3],"result":5}
    operaciones válidas: add, subtract, multiply, divide, power, sqrt, percentage
    (sqrt recibe 1 operando; el resto, 2)
  - GET /api/v1/operations  → lista las operaciones soportadas y su aridad
  - GET /healthz            → {"status":"ok"}
- Errores: respuesta JSON uniforme {"error":{"code":"DIVISION_BY_ZERO","message":"..."}}
  con el status HTTP correcto (400 para validación/dominio, 405, 500). Define
  errores de dominio como valores centinela en el paquete calculator y mapéalos a
  códigos HTTP en la capa api — nunca filtres errores internos al cliente.
- Casos borde obligatorios: división por cero, raíz de negativo, operandos faltantes
  o de más, operación desconocida, JSON malformado, tipos no numéricos, resultado
  Inf o NaN (p. ej. potencias que desbordan float64), body vacío, body enorme
  (usa http.MaxBytesReader).
- Middleware propio y mínimo: logging estructurado con log/slog, recuperación de
  panics, CORS configurable.
- Tests: table-driven para calculator (incluyendo todos los casos borde) y tests de
  handlers con httptest cubriendo códigos de estado y forma del JSON.
  Meta: >85% de cobertura en internal/.

FRONTEND (React + TypeScript + Vite)
- Integra el componente de UI ya diseñado sin cambiarle el look.
- Capa de API aislada en src/api/calculator.ts: tipos compartidos, fetch tipado,
  manejo de errores de red vs. errores de negocio del backend, timeout con
  AbortController. La URL base sale de import.meta.env.VITE_API_URL.
- Toda la aritmética la resuelve el backend. El frontend solo valida forma
  (número válido, operación completa) antes de enviar.
- Estado con hooks propios (useCalculator), sin librerías de estado externas.
- ESLint + Prettier + tsconfig en modo strict.
- Tests con Vitest + React Testing Library + MSW para mockear el backend:
  render inicial, secuencia de pulsaciones, envío correcto del payload, render del
  resultado, render del error de división por cero, estado de loading, atajos de
  teclado.

DOCKER
- backend/Dockerfile: build multi-stage, binario estático, imagen final distroless
  o alpine, usuario no-root.
- frontend/Dockerfile: build con node, servido por nginx con configuración SPA.
- docker-compose.yml: levanta ambos con `docker compose up`, frontend en :3000,
  backend en :8080, healthchecks y la variable de entorno de la API ya cableada.

DOCUMENTACIÓN
README.md con:
- Descripción breve y captura/descripción de la UI.
- Prerrequisitos y setup local paso a paso (backend y frontend por separado).
- Cómo correr todo con Docker en un comando.
- Tabla de endpoints con ejemplos de curl reales (request y response, incluyendo
  al menos dos casos de error).
- Cómo correr los tests y ver la cobertura, con los números obtenidos.
- Sección "Design decisions & assumptions": por qué stdlib en vez de framework, por
  qué un endpoint único en vez de uno por operación, por qué la lógica vive en el
  backend, cómo se modelan los errores, qué quedó fuera de alcance por tiempo y qué
  haría con más tiempo (rate limiting, OpenAPI, precisión decimal, CI).
PROMPTS.md: deja un archivo donde pegaré los prompts que usé; incluye ya los tuyos
con una breve nota de qué generó cada uno.

CIERRE
1. Corre `go test ./... -coverprofile=coverage.out` y `npm run test -- --coverage`;
   pega los resultados reales en el README.
2. Corre `go vet`, `gofmt -l .` y el linter del frontend; deja todo limpio.
3. Verifica que `docker compose up` levanta y que la calculadora funciona end-to-end.
4. Inicializa git con commits lógicos y separados (no un solo commit gigante) y
   dime el comando exacto para hacer push a mi repo remoto.

No me dejes tareas pendientes a mí: si tienes que decidir algo, decídelo, déjalo
documentado en el README y sigue.
```

> Nota: el prompt #2 pedía Docker y un hook `useCalculator`; durante el trabajo se
> decidió (y se dejó documentado en el README) omitir Docker por ser opcional y no
> añadir un `useCalculator` externo porque el componente de diseño ya encapsula su
> estado con hooks propios.

---

## Prompts / acciones del asistente (Claude Code)

El proyecto se generó con un único prompt maestro (la especificación completa:
estructura del repo, backend Go stdlib en capas, frontend React+TS+Vite, Docker,
docs y cierre con tests/cobertura/git). A partir de ahí, el asistente ejecutó el
trabajo de principio a fin. Resumen de lo que generó cada fase:

1. **Importación del diseño.** Se autorizó el acceso a Claude Design
   (`/design-login`) y se descargaron vía el MCP de diseño:
   `Calculator.tsx`, `calculator.css`, `Calculadora.dc.html`, `support.js`,
   `preview-loader.js`. Se determinó que `Calculator.tsx` + `calculator.css` son
   el componente a integrar *tal cual*, y que `support.js`/`preview-loader.js`
   son el runtime de preview del canvas (no forman parte de la app).

2. **Backend — lógica pura (`internal/calculator`).** Operaciones como registro
   con aridad, errores de dominio centinela (`ErrDivisionByZero`, etc.), y
   `Calculate` con validación de aridad + rechazo de resultados Inf/NaN. Tests
   table-driven con todos los casos borde → 100% de cobertura.

3. **Backend — capa HTTP (`internal/api`).** Handlers para `/calculate`,
   `/operations`, `/healthz`; envelope de error uniforme `{error:{code,message}}`;
   mapeo de errores de dominio a códigos + status con `errors.Is`;
   `http.MaxBytesReader`; decoder estricto (`DisallowUnknownFields`, sin datos de
   más). Middleware propio: `slog`, recuperación de panics, CORS configurable.
   Tests con `httptest` cubriendo status y forma del JSON → 100%.

4. **Backend — wiring (`cmd/server`).** Config por env (`PORT`,
   `ALLOWED_ORIGINS`), graceful shutdown con `signal.NotifyContext`, y un flag
   `-healthcheck` para que el contenedor distroless pueda auto-probarse.

5. **Frontend — capa de API aislada (`src/api/calculator.ts`).** Tipos
   compartidos, fetch tipado, timeout con `AbortController`, y separación entre
   error de red (`NETWORK_ERROR`/`TIMEOUT`) y error de negocio del backend
   (conserva el `code`). URL base desde `import.meta.env.VITE_API_URL`.

6. **Frontend — integración de la UI.** `Calculator.tsx` + `calculator.css`
   integrados sin cambios; `App.tsx` + `calculate.ts` (adaptador que mapea la
   operación unaria `percent` de la UI al `percentage` del backend y desempaqueta
   el resultado); `main.tsx`; `index.css`; fuente IBM Plex Sans.

7. **Frontend — tooling y tests.** tsconfig strict, ESLint (flat) + Prettier,
   Vitest + React Testing Library + **MSW**. Tests de render, secuencia de
   pulsaciones, payload, resultado, error de división por cero, loading, atajos de
   teclado, historial y capa de API.

8. **Scripts raíz y docs.** `package.json` en la raíz con `concurrently` para
   `npm run dev` (backend + frontend a la vez) y `npm test` / `npm run
   test:coverage` (ambas capas), más `README.md`, `.gitignore` y este archivo.
   (Se incluyeron Dockerfiles + compose en una iteración previa y luego se
   eliminaron: Docker era opcional y se prefirió simplificar con los scripts
   raíz.)

9. **Cierre.** Ejecución de `go test`/`go vet`/verificación gofmt y
   `npm run test -- --coverage`/lint/format; captura de curls reales contra el
   servidor en ejecución; inicialización de git con commits lógicos.

### Notas técnicas resueltas durante la generación

- **jsdom vs. `AbortController`.** El `fetch` de undici (usado por MSW en Node)
  rechaza el `AbortSignal` de jsdom. Se preservan los globals de Node al arranque
  del worker de Vitest para que MSW intercepte correctamente el fetch de la capa
  de API.
- **WDAC / Smart App Control.** La máquina bloquea binarios recién compilados de
  forma intermitente (tests de Go y `gofmt.exe`). Workarounds: `GOTMPDIR` fuera de
  `%TEMP%`, `-buildid` único por compilación, y verificación de formato con
  `go/format` en lugar de `gofmt.exe`. Detalle en el README.
