package qr

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestEncodePNGDataURL(t *testing.T) {
	got, err := EncodePNGDataURL("https://example.com", 256)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got, "data:image/png;base64,") {
		t.Fatalf("unexpected prefix: %.40q", got)
	}

	raw, err := base64.StdEncoding.DecodeString(strings.SplitN(got, ",", 2)[1])
	if err != nil {
		t.Fatalf("payload is not valid base64: %v", err)
	}
	if string(raw[1:4]) != "PNG" {
		t.Errorf("payload is not a PNG")
	}
}

func TestEncodeRejectsInvalidInput(t *testing.T) {
	cases := []struct {
		name string
		text string
		size int
	}{
		{"empty text", "", 256},
		{"size too small", "hello", 32},
		{"size too large", "hello", 2048},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := EncodePNGDataURL(c.text, c.size); err == nil {
				t.Error("expected an error")
			}
		})
	}
}
