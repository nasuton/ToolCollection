package uuid

import (
	"regexp"
	"testing"
)

var v4 = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestNewV4Format(t *testing.T) {
	for i := 0; i < 200; i++ {
		got, err := NewV4()
		if err != nil {
			t.Fatal(err)
		}
		if !v4.MatchString(got) {
			t.Fatalf("not a v4 UUID: %q", got)
		}
	}
}

func TestGenerateCount(t *testing.T) {
	got, err := Generate(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 10 {
		t.Fatalf("expected 10 uuids, got %d", len(got))
	}
	seen := make(map[string]bool)
	for _, u := range got {
		if seen[u] {
			t.Fatalf("duplicate uuid %q", u)
		}
		seen[u] = true
	}
}

func TestGenerateRejectsOutOfRange(t *testing.T) {
	for _, n := range []int{0, -1, 101} {
		if _, err := Generate(n); err == nil {
			t.Errorf("count %d: expected an error", n)
		}
	}
}
