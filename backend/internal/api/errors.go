package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"calculadora/internal/calculator"
)

// errorResponse is the uniform error envelope returned to clients.
type errorResponse struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// apiError carries the HTTP status and stable code for a failure.
type apiError struct {
	status  int
	code    string
	message string
}

// mapDomainError translates a calculator sentinel error into an apiError.
// Unknown errors collapse to a generic 500 so internals never leak to clients.
func mapDomainError(err error) apiError {
	// Client-facing messages are in Spanish to match the UI; the Go sentinel
	// errors themselves stay in English per Go convention.
	switch {
	case errors.Is(err, calculator.ErrUnknownOperation):
		return apiError{http.StatusBadRequest, "UNKNOWN_OPERATION", "Operación desconocida"}
	case errors.Is(err, calculator.ErrInvalidArity):
		return apiError{http.StatusBadRequest, "INVALID_OPERAND_COUNT", "Número de operandos inválido para la operación"}
	case errors.Is(err, calculator.ErrDivisionByZero):
		return apiError{http.StatusBadRequest, "DIVISION_BY_ZERO", "No se puede dividir entre cero"}
	case errors.Is(err, calculator.ErrNegativeSqrt):
		return apiError{http.StatusBadRequest, "NEGATIVE_SQRT", "No existe la raíz cuadrada de un número negativo"}
	case errors.Is(err, calculator.ErrNonFiniteResult):
		return apiError{http.StatusBadRequest, "NON_FINITE_RESULT", "El resultado está fuera de rango"}
	default:
		return apiError{http.StatusInternalServerError, "INTERNAL_ERROR", "Error interno del servidor"}
	}
}

// writeJSON serializes v as JSON with the given status.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeError writes the uniform error envelope.
func writeError(w http.ResponseWriter, e apiError) {
	writeJSON(w, e.status, errorResponse{Error: errorDetail{Code: e.code, Message: e.message}})
}
