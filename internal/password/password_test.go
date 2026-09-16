package password

import (
	"regexp"
	"testing"
)

func TestGenerateLength(t *testing.T) {
	for _, n := range []int{4, 20, 128} {
		got, err := Generate(Options{Length: n, UseUpper: true, UseDigits: true, UseSymbols: true})
		if err != nil {
			t.Fatalf("length %d: unexpected error: %v", n, err)
		}
		if len(got) != n {
			t.Errorf("length %d: got %d characters", n, len(got))
		}
	}
}

func TestGenerateRejectsOutOfRange(t *testing.T) {
	for _, n := range []int{0, 3, 129} {
		if _, err := Generate(Options{Length: n}); err == nil {
			t.Errorf("length %d: expected an error", n)
		}
	}
}

func TestGenerateRespectsCharset(t *testing.T) {
	got, err := Generate(Options{Length: 64})
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[a-z]+$`).MatchString(got) {
		t.Errorf("expected lowercase only, got %q", got)
	}
}

func TestGenerateExcludesAmbiguousCharacters(t *testing.T) {
	for i := 0; i < 50; i++ {
		got, err := Generate(Options{Length: 128, UseUpper: true, UseDigits: true, UseSymbols: true})
		if err != nil {
			t.Fatal(err)
		}
		if regexp.MustCompile(`[l1I0O]`).MatchString(got) {
			t.Fatalf("ambiguous character leaked into %q", got)
		}
	}
}

func TestGenerateIsNotDeterministic(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		got, err := Generate(Options{Length: 24, UseUpper: true, UseDigits: true, UseSymbols: true})
		if err != nil {
			t.Fatal(err)
		}
		if seen[got] {
			t.Fatalf("duplicate password after %d draws: %q", i, got)
		}
		seen[got] = true
	}
}
