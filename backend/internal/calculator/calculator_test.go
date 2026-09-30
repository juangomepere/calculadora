package calculator

import (
	"errors"
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name     string
		op       Operation
		operands []float64
		want     float64
		wantErr  error
	}{
		{name: "add", op: Add, operands: []float64{2, 3}, want: 5},
		{name: "add negatives", op: Add, operands: []float64{-2, -3}, want: -5},
		{name: "subtract", op: Subtract, operands: []float64{10, 4}, want: 6},
		{name: "multiply", op: Multiply, operands: []float64{6, 7}, want: 42},
		{name: "divide", op: Divide, operands: []float64{9, 3}, want: 3},
		{name: "divide fractional", op: Divide, operands: []float64{1, 4}, want: 0.25},
		{name: "power", op: Power, operands: []float64{2, 10}, want: 1024},
		{name: "power zero exponent", op: Power, operands: []float64{5, 0}, want: 1},
		{name: "sqrt", op: Sqrt, operands: []float64{144}, want: 12},
		{name: "sqrt zero", op: Sqrt, operands: []float64{0}, want: 0},
		{name: "percentage", op: Percentage, operands: []float64{250}, want: 2.5},
		{name: "percentage two operands rejected", op: Percentage, operands: []float64{200, 10}, wantErr: ErrInvalidArity},

		{name: "division by zero", op: Divide, operands: []float64{1, 0}, wantErr: ErrDivisionByZero},
		{name: "sqrt of negative", op: Sqrt, operands: []float64{-4}, wantErr: ErrNegativeSqrt},
		{name: "power overflow to inf", op: Power, operands: []float64{10, 400}, wantErr: ErrNonFiniteResult},
		{name: "unknown operation", op: Operation("modulo"), operands: []float64{1, 2}, wantErr: ErrUnknownOperation},
		{name: "too few operands", op: Add, operands: []float64{1}, wantErr: ErrInvalidArity},
		{name: "too many operands", op: Add, operands: []float64{1, 2, 3}, wantErr: ErrInvalidArity},
		{name: "sqrt with two operands", op: Sqrt, operands: []float64{4, 9}, wantErr: ErrInvalidArity},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.operands)
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("Calculate(%q, %v) error = %v, want %v", tt.op, tt.operands, err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("Calculate(%q, %v) unexpected error: %v", tt.op, tt.operands, err)
			}
			if math.Abs(got-tt.want) > 1e-9 {
				t.Fatalf("Calculate(%q, %v) = %v, want %v", tt.op, tt.operands, got, tt.want)
			}
		})
	}
}

func TestList(t *testing.T) {
	list := List()
	if len(list) != len(registry) {
		t.Fatalf("List() returned %d entries, want %d", len(list), len(registry))
	}
	// Must be sorted by operation name for deterministic output.
	for i := 1; i < len(list); i++ {
		if list[i-1].Operation > list[i].Operation {
			t.Fatalf("List() not sorted: %q before %q", list[i-1].Operation, list[i].Operation)
		}
	}
	// Spot-check a known arity.
	for _, info := range list {
		if info.Operation == Sqrt && info.Arity != 1 {
			t.Fatalf("sqrt arity = %d, want 1", info.Arity)
		}
	}
}
