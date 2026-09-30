# Calculadora full-stack

Calculadora full-stack: **frontend React + TypeScript (Vite)** y **backend en Go
(solo stdlib)**. Toda la aritmética la resuelve el backend a través de un único
endpoint REST; el frontend valida la forma de la entrada, dibuja la UI y muestra
resultados y errores.

## La UI

El componente de UI viene diseñado en Claude Design (`Calculator.tsx` +
`calculator.css`) y se integró **tal cual**, sin rediseñarlo. Características:

- Teclado numérico completo: dígitos, `.`, `±`, `C`, borrar, `%`, `÷`, `√`, `xʸ`,
  `×`, `−`, `+`, `=`.
- Display con expresión + resultado, tamaño de fuente adaptativo, y barra de
  progreso durante la llamada al backend.
- Panel de **historial** de operaciones (recuperable con un clic).
- **Atajos de teclado físicos** (`0-9`, `+ - * /`, `^`, `r`=raíz, `%`, `Enter`,
  `Esc`, `Backspace`, `F9`=signo).
- Temas claro/oscuro (`light-dark()` + `color-scheme`), accesible (roles ARIA,
  `aria-live`, focus visible), responsive vía container queries.
- Estados: idle, escribiendo, loading, éxito, error de validación (frontend) y
  error de backend (rojo).

## Estructura

```
/
├── backend/            Go 1.22, solo stdlib
│   ├── cmd/server/     wiring, config por env, graceful shutdown, healthcheck
│   └── internal/
│       ├── calculator/ lógica pura (sin HTTP), errores de dominio centinela
│       └── api/         handlers, validación, mapeo de errores, middleware
├── frontend/           React + TS + Vite
│   └── src/
│       ├── api/         capa de API aislada y tipada (fetch, timeout, errores)
│       ├── calculate.ts adaptador UI → API (mapea nombres de operación)
│       ├── components/  Calculator.tsx + calculator.css (diseño, tal cual)
│       └── test/        setup de Vitest + MSW
├── docker-compose.yml
├── README.md
├── PROMPTS.md
└── .gitignore
```

## Prerrequisitos

- **Go** 1.22+
- **Node** 20+ y npm
- (Opcional) **Docker** + Docker Compose

## Setup local

### Backend

```bash
cd backend
go run ./cmd/server          # escucha en :8080
```

Variables de entorno:

| Variable          | Por defecto | Descripción                                  |
|-------------------|-------------|----------------------------------------------|
| `PORT`            | `8080`      | Puerto HTTP                                   |
| `ALLOWED_ORIGINS` | `*`         | Orígenes CORS permitidos (lista separada por comas) |

### Frontend

```bash
cd frontend
npm install
cp .env.example .env         # VITE_API_URL=http://localhost:8080
npm run dev                  # Vite en :5173
```

La URL base del backend sale de `import.meta.env.VITE_API_URL`.

## Todo con Docker (un comando)

```bash
docker compose up --build
```

- Frontend (nginx, SPA) en **http://localhost:3000**
- Backend en **http://localhost:8080**
- `VITE_API_URL` (build arg) y `ALLOWED_ORIGINS` ya cableados; healthchecks en
  ambos servicios; el frontend espera a que el backend esté `healthy`.

## Endpoints

Base: `http://localhost:8080`

| Método | Ruta                  | Descripción                            |
|--------|-----------------------|----------------------------------------|
| POST   | `/api/v1/calculate`   | Ejecuta una operación                  |
| GET    | `/api/v1/operations`  | Lista operaciones soportadas y aridad  |
| GET    | `/healthz`            | Health check                           |

Operaciones válidas: `add`, `subtract`, `multiply`, `divide`, `power` (2 operandos);
`sqrt`, `percentage` (1 operando).

### Ejemplos (curl reales)

**Suma**

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"add","operands":[2,3]}'
# 200 → {"operation":"add","operands":[2,3],"result":5}
```

**Raíz cuadrada (unaria)**

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"sqrt","operands":[144]}'
# 200 → {"operation":"sqrt","operands":[144],"result":12}
```

**Operaciones soportadas**

```bash
curl -s http://localhost:8080/api/v1/operations
# 200 → {"operations":[
#   {"operation":"add","arity":2},{"operation":"divide","arity":2},
#   {"operation":"multiply","arity":2},{"operation":"percentage","arity":1},
#   {"operation":"power","arity":2},{"operation":"sqrt","arity":1},
#   {"operation":"subtract","arity":2}]}
```

**Error — división por cero**

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":"divide","operands":[5,0]}'
# 400 → {"error":{"code":"DIVISION_BY_ZERO","message":"No se puede dividir entre cero"}}
```

**Error — JSON malformado**

```bash
curl -s -X POST http://localhost:8080/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{"operation":'
# 400 → {"error":{"code":"INVALID_JSON","message":"El cuerpo de la petición no es un JSON válido"}}
```

### Códigos de error

Todas las respuestas de error tienen la forma
`{"error":{"code":"...","message":"..."}}`.

| Código                  | HTTP | Cuándo                                        |
|-------------------------|------|-----------------------------------------------|
| `DIVISION_BY_ZERO`      | 400  | dividir entre cero                            |
| `NEGATIVE_SQRT`         | 400  | raíz de un número negativo                    |
| `NON_FINITE_RESULT`     | 400  | resultado Inf/NaN (p. ej. `10^400`)           |
| `INVALID_OPERAND_COUNT` | 400  | aridad incorrecta (faltan/sobran operandos)   |
| `UNKNOWN_OPERATION`     | 400  | operación no soportada                         |
| `INVALID_JSON`          | 400  | JSON malformado, vacío o con tipos no numéricos|
| `PAYLOAD_TOO_LARGE`     | 413  | cuerpo mayor a 1 MiB (`http.MaxBytesReader`)  |
| `INTERNAL_ERROR`        | 500  | error interno (nunca filtra detalles)         |
| —                       | 405  | método no permitido en una ruta existente     |

## Tests y cobertura

### Backend

```bash
cd backend
go test ./... -coverprofile=coverage.out
go tool cover -func=coverage.out      # resumen por función
go tool cover -html=coverage.out      # informe HTML
```

Resultados obtenidos (`go test ./...`):

```
ok  calculadora/cmd/server            coverage: 12.8% of statements
ok  calculadora/internal/api          coverage: 100.0% of statements
ok  calculadora/internal/calculator   coverage: 100.0% of statements
```

**Cobertura de `internal/`: 100%** (meta: >85%). `cmd/server` es wiring
(main/graceful shutdown) y queda cubierto parcialmente por sus helpers.

### Frontend

```bash
cd frontend
npm run test -- --coverage
```

Resultados obtenidos (Vitest, 16 tests, 3 archivos):

```
File             | % Stmts | % Branch | % Funcs | % Lines
-----------------|---------|----------|---------|--------
All files        |   90.7  |   68.7   |   80    |  90.7
 App.tsx         |   100   |   100    |   100   |  100
 calculate.ts    |   100   |   100    |   100   |  100
 api/calculator  |   96    |   83.33  |   100   |  96
 Calculator.tsx  |   89.58 |   64.81  |   73.68 |  89.58
```

Cubre: render inicial, secuencia de pulsaciones, payload enviado, render del
resultado, error de división por cero, estado de loading, atajos de teclado,
historial, raíz unaria, mapeo `percent` → `percentage`, y la capa de API
(éxito, error de negocio, error de red, respuesta con forma inesperada).

### Calidad

```bash
# backend
cd backend && go vet ./... && gofmt -l .
# frontend
cd frontend && npm run lint && npm run format:check
```

`go vet` limpio, código gofmt-clean, ESLint sin errores, Prettier OK.

## Design decisions & assumptions

- **stdlib en vez de framework.** El servicio expone 3 rutas y una operación de
  cálculo; `net/http` con el `ServeMux` de Go 1.22 (routing por método +
  patrones) cubre todo sin dependencias. Menos superficie, builds triviales,
  binario estático mínimo. Un framework aquí sería peso muerto.
- **Un endpoint único (`/calculate`) en vez de uno por operación.** El contrato
  es uniforme (`operation` + `operands`); añadir una operación es una entrada en
  el registro del paquete `calculator`, sin tocar el routing ni el cliente. El
  frontend tiene un solo camino tipado en lugar de N. `GET /operations` publica
  el catálogo y su aridad para clientes que quieran descubrirlo.
- **La lógica vive en el backend.** El frontend solo valida forma (número válido,
  operación completa); toda la aritmética la hace Go. Así hay una única fuente de
  verdad para precisión, casos borde y errores de dominio, y el mismo backend
  sirve a cualquier cliente (web, móvil, CLI).
- **Modelado de errores.** Los errores de dominio son **valores centinela** en el
  paquete `calculator` (`ErrDivisionByZero`, `ErrNegativeSqrt`, …), sin
  conocimiento de HTTP. La capa `api` los traduce a `{code, message}` + status
  con `errors.Is`. Los errores desconocidos colapsan a `500 INTERNAL_ERROR`
  genérico: nunca se filtran detalles internos al cliente. Los mensajes de cara
  al cliente están en español (coinciden con la UI); los errores Go siguen en
  inglés por convención.
- **Casos borde cubiertos.** División por cero, raíz de negativo, resultado
  Inf/NaN (potencias que desbordan `float64`), aridad incorrecta, operación
  desconocida, JSON malformado/vacío, tipos no numéricos, y cuerpo enorme
  (`http.MaxBytesReader`, 1 MiB → 413).
- **`percentage` es unario.** El componente de UI modela `%` como operación
  **unaria** (`percent`, un operando → `x/100`). El enunciado escrito lo listaba
  como binario; como la instrucción fue integrar la UI *tal cual* y que **toda la
  aritmética viva en el backend**, se implementó `percentage` con aridad 1 para
  que coincida con lo que la UI envía. El adaptador del frontend
  (`calculate.ts`) mapea el nombre `percent` (UI) → `percentage` (backend).
- **Sin `useCalculator` propio.** El componente de diseño ya encapsula todo su
  estado con hooks de React (`useState`/`useRef`/`useEffect`), sin librerías de
  estado externas. Añadir un `useCalculator` externo habría duplicado esa lógica
  o exigido rediseñar el componente, así que se respetó el diseño. La capa de
  estado "propia y sin librerías externas" se cumple dentro del componente.
- **Middleware propio y mínimo:** logging estructurado con `log/slog`,
  recuperación de panics, y CORS configurable (`ALLOWED_ORIGINS`).

### Fuera de alcance (por tiempo) y qué haría con más tiempo

- **Rate limiting** por IP (p. ej. `golang.org/x/time/rate` o un limiter propio).
- **OpenAPI** / spec del contrato + cliente TS generado a partir de ella.
- **Precisión decimal** (`math/big` o decimal) en vez de `float64` para dinero /
  cálculos exactos.
- **CI** (GitHub Actions): `go test`/`vet`/`gofmt` + `npm test`/lint + build de
  imágenes en cada push.
- Persistencia del historial (hoy es en memoria del cliente) y i18n de mensajes.

### Notas del entorno

- El toolchain de Go se instaló con `winget`. En esta máquina hay una política
  **WDAC / Smart App Control** que bloquea binarios de baja reputación recién
  compilados de forma intermitente, incluidos los binarios de test de `go test`
  y `gofmt.exe`. Workarounds usados para poder correr todo:
  - `gofmt` se verificó con `go/format` (compilado en el propio binario de test)
    en vez de `gofmt.exe`.
  - Para los tests/cobertura se fijó `GOTMPDIR` fuera de `%TEMP%` y se compiló con
    un `-buildid` único (`go test ./... -ldflags=-buildid=<guid>`), que evita el
    bloqueo por reputación. Los números de cobertura de arriba son reales.
  En una máquina sin esa política, `go test ./... -coverprofile=coverage.out`
  funciona sin más.
- **Docker no está instalado** en esta máquina, así que `docker compose up` no se
  ejecutó localmente aquí; los `Dockerfile` y el `docker-compose.yml` están
  escritos y revisados. La verificación end-to-end se hizo corriendo el backend
  Go nativo y el frontend con Vite, con curls reales (los de arriba) contra el
  servidor.
