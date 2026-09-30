// Package calculator holds the pure arithmetic logic of the service. It has no
// dependency on net/http or any transport concern: it takes numbers, returns a
// number or a sentinel domain error, and nothing else. The api layer is
// responsible for mapping these sentinel errors to HTTP codes.
package calculator

import (
	"errors"
	"math"
	"sort"
)

// Operation is the identifier of a supported arithmetic operation.
type Operation string

const (
	Add        Operation = "add"
	Subtract   Operation = "subtract"
	Multiply   Operation = "multiply"
	Divide     Operation = "divide"
	Power      Operation = "power"
	Sqrt       Operation = "sqrt"
	Percentage Operation = "percentage"
)

// Sentinel domain errors. The api layer matches on these with errors.Is and
// translates them into stable error codes; they are never surfaced verbatim as
// internal errors to the client.
var (
	ErrUnknownOperation = errors.New("unknown operation")
	ErrInvalidArity     = errors.New("invalid number of operands for operation")
	ErrDivisionByZero   = errors.New("division by zero")
	ErrNegativeSqrt     = errors.New("square root of a negative number")
	ErrNonFiniteResult  = errors.New("result is not a finite number")
)

// spec describes one operation: how many operands it takes and how to compute it.
type spec struct {
	arity int
	fn    func(o []float64) (float64, error)
}

var registry = map[Operation]spec{
	Add:      {arity: 2, fn: func(o []float64) (float64, error) { return o[0] + o[1], nil }},
	Subtract: {arity: 2, fn: func(o []float64) (float64, error) { return o[0] - o[1], nil }},
	Multiply: {arity: 2, fn: func(o []float64) (float64, error) { return o[0] * o[1], nil }},
	Divide: {arity: 2, fn: func(o []float64) (float64, error) {
		if o[1] == 0 {
			return 0, ErrDivisionByZero
		}
		return o[0] / o[1], nil
	}},
	Power: {arity: 2, fn: func(o []float64) (float64, error) { return math.Pow(o[0], o[1]), nil }},
	Sqrt: {arity: 1, fn: func(o []float64) (float64, error) {
		if o[0] < 0 {
			return 0, ErrNegativeSqrt
		}
		return math.Sqrt(o[0]), nil
	}},
	// percentage(x) converts x to its percentage value, i.e. x / 100. It is a
	// unary operation to match the provided UI, where "%" acts on one operand.
	Percentage: {arity: 1, fn: func(o []float64) (float64, error) { return o[0] / 100, nil }},
}

// Info is the public description of an operation, used by the operations endpoint.
type Info struct {
	Operation Operation `json:"operation"`
	Arity     int       `json:"arity"`
}

// List returns the supported operations and their arity, sorted by name so the
// output is deterministic.
func List() []Info {
	out := make([]Info, 0, len(registry))
	for name, s := range registry {
		out = append(out, Info{Operation: name, Arity: s.arity})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Operation < out[j].Operation })
	return out
}

// Calculate runs op over operands. It validates the operation and its arity,
// delegates to the operation's function, and rejects non-finite results (Inf or
// NaN, e.g. from an overflowing power). All failures are sentinel errors above.
func Calculate(op Operation, operands []float64) (float64, error) {
	s, ok := registry[op]
	if !ok {
		return 0, ErrUnknownOperation
	}
	if len(operands) != s.arity {
		return 0, ErrInvalidArity
	}
	result, err := s.fn(operands)
	if err != nil {
		return 0, err
	}
	if math.IsInf(result, 0) || math.IsNaN(result) {
		return 0, ErrNonFiniteResult
	}
	return result, nil
}
