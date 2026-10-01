# PROMPTS

Registro de prompts usados para generar este proyecto.

---

## Mis prompts

<!-- Pega aquí los prompts que usaste tú. -->

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
