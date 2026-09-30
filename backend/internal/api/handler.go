package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"calculadora/internal/calculator"
)

// maxBodyBytes caps request bodies to protect against oversized payloads.
const maxBodyBytes = 1 << 20 // 1 MiB

// calcRequest is the POST /calculate request shape. Operands is []float64, so a
// non-numeric element fails JSON decoding and is reported as invalid input.
type calcRequest struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
}

type calcResponse struct {
	Operation string    `json:"operation"`
	Operands  []float64 `json:"operands"`
	Result    float64   `json:"result"`
}

// Handler holds dependencies for the HTTP handlers.
type Handler struct{}

// NewHandler builds the handler set.
func NewHandler() *Handler { return &Handler{} }

// Routes registers the endpoints on a new ServeMux. Method matching in the
// Go 1.22 mux yields an automatic 405 for wrong methods on a matched path.
func (h *Handler) Routes() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", h.calculate)
	mux.HandleFunc("GET /api/v1/operations", h.operations)
	mux.HandleFunc("GET /healthz", h.healthz)
	return mux
}

func (h *Handler) calculate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	var req calcRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, apiError{http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "La petición es demasiado grande"})
			return
		}
		msg := "El cuerpo de la petición no es un JSON válido"
		if errors.Is(err, io.EOF) {
			msg = "El cuerpo de la petición está vacío"
		}
		writeError(w, apiError{http.StatusBadRequest, "INVALID_JSON", msg})
		return
	}
	// Reject trailing data after the first JSON value.
	if dec.More() {
		writeError(w, apiError{http.StatusBadRequest, "INVALID_JSON", "El cuerpo debe contener un único objeto JSON"})
		return
	}

	result, err := calculator.Calculate(calculator.Operation(req.Operation), req.Operands)
	if err != nil {
		writeError(w, mapDomainError(err))
		return
	}

	writeJSON(w, http.StatusOK, calcResponse{
		Operation: req.Operation,
		Operands:  req.Operands,
		Result:    result,
	})
}

func (h *Handler) operations(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"operations": calculator.List()})
}

func (h *Handler) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
