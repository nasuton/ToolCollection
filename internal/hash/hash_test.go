package hash

import (
	"strings"
	"testing"
)

func TestSHA256(t *testing.T) {
	for input, want := range map[string]string{
		"":    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		"abc": "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
	} {
		if got := SHA256(input); got != want {
			t.Errorf("SHA256(%q) = %s", input, got)
		}
	}
}

func TestBcrypt(t *testing.T) {
	first, err := Bcrypt("日本語 password", 4)
	if err != nil {
		t.Fatal(err)
	}
	second, err := Bcrypt("日本語 password", 4)
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("expected random salts")
	}
	for _, tc := range []struct {
		password string
		want     bool
	}{{"日本語 password", true}, {"wrong", false}} {
		got, err := CompareBcrypt(tc.password, first)
		if err != nil || got != tc.want {
			t.Fatalf("compare: got %v, %v", got, err)
		}
	}
	if _, err := CompareBcrypt("test", "not a hash"); err == nil {
		t.Fatal("accepted invalid hash")
	}
	if _, err := CompareBcrypt("test", "$2a$31$"+strings.Repeat("a", 53)); err == nil {
		t.Fatal("accepted excessive cost")
	}
}

func TestBcryptLimits(t *testing.T) {
	for _, cost := range []int{0, 3, 13, 31} {
		if _, err := Bcrypt("test", cost); err == nil {
			t.Errorf("accepted cost %d", cost)
		}
	}
	if _, err := Bcrypt(strings.Repeat("あ", 25), 4); err == nil {
		t.Fatal("accepted >72 bytes")
	}
	hash, err := Bcrypt(strings.Repeat("a", 72), 4)
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := CompareBcrypt(strings.Repeat("a", 73), hash); err == nil || ok {
		t.Fatal("accepted >72 byte comparison")
	}
}
