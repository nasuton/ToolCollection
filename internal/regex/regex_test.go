package regex

import (
	"strings"
	"testing"
)

func TestCapturesAndByteOffsets(t *testing.T) {
	got, err := Test(Options{Pattern: `(?P<word>猫)(x)?`, Text: "a猫b"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Matches) != 1 {
		t.Fatalf("unexpected matches: %+v", got)
	}
	m := got.Matches[0]
	if m.Text != "猫" || m.Start != 1 || m.End != 4 || m.Groups[0].Name != "word" || m.Groups[1].Start != -1 {
		t.Fatalf("unexpected captures: %+v", m)
	}
}

func TestFlagsAndEmptyMatches(t *testing.T) {
	for _, tc := range []struct {
		pattern, text, flags string
		count                int
	}{
		{"^abc$", "x\nABC\ny", "im", 1}, {"a.b", "a\nb", "s", 1},
		{"z", "abc", "", 0}, {"", "猫", "", 2},
	} {
		got, err := Test(Options{Pattern: tc.pattern, Text: tc.text, Flags: tc.flags})
		if err != nil || len(got.Matches) != tc.count {
			t.Fatalf("%+v: %+v, %v", tc, got, err)
		}
	}
}

func TestInvalidAndLimits(t *testing.T) {
	for _, opt := range []Options{{Pattern: "["}, {Pattern: "(?=a)"}, {Pattern: `(a)\1`}, {Flags: "g"}, {Text: strings.Repeat("a", 1<<20+1)}, {Pattern: strings.Repeat("a", 16<<10+1)}} {
		if _, err := Test(opt); err == nil {
			t.Fatal("accepted invalid input")
		}
	}
	got, err := Test(Options{Pattern: "a", Text: strings.Repeat("a", 1001)})
	if err != nil || len(got.Matches) != 1000 || !got.Truncated {
		t.Fatalf("unexpected truncation: %v", err)
	}
}
