package qr

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"strings"
	"testing"
)

func qrPNG(t *testing.T, text string) []byte {
	t.Helper()
	url, err := EncodePNGDataURL(text, 256)
	if err != nil {
		t.Fatal(err)
	}
	data, err := base64.StdEncoding.DecodeString(strings.SplitN(url, ",", 2)[1])
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestDecodeGeneratedImages(t *testing.T) {
	for _, text := range []string{"https://example.com/path?q=test", "日本語のテキスト", "WIFI:S:example;T:WPA;P:password;;", "javascript:alert(1)"} {
		t.Run(text, func(t *testing.T) {
			data := qrPNG(t, text)
			img, err := png.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatal(err)
			}
			for _, format := range []string{"png", "jpeg", "gif"} {
				t.Run(format, func(t *testing.T) {
					var encoded bytes.Buffer
					switch format {
					case "png":
						encoded.Write(data)
					case "jpeg":
						err = jpeg.Encode(&encoded, img, &jpeg.Options{Quality: 85})
					case "gif":
						err = gif.Encode(&encoded, img, nil)
					}
					if err != nil {
						t.Fatal(err)
					}
					got, err := DecodeImage(encoded.Bytes())
					if err != nil || got != text {
						t.Fatalf("got %q, %v; want %q", got, err, text)
					}
				})
			}
		})
	}
}

func TestDecodeRotatedTransparentQR(t *testing.T) {
	img, err := png.Decode(bytes.NewReader(qrPNG(t, "https://example.com/rotated")))
	if err != nil {
		t.Fatal(err)
	}
	out := image.NewNRGBA(img.Bounds())
	for y := 0; y < 256; y++ {
		for x := 0; x < 256; x++ {
			r, _, _, _ := img.At(x, y).RGBA()
			if r < 0x8000 {
				out.SetNRGBA(255-y, x, color.NRGBA{A: 255})
			}
		}
	}
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, out); err != nil {
		t.Fatal(err)
	}
	got, err := DecodeImage(encoded.Bytes())
	if err != nil || got != "https://example.com/rotated" {
		t.Fatalf("got %q, %v", got, err)
	}
}

func TestDecodeRejectsInvalidImages(t *testing.T) {
	var blank bytes.Buffer
	if err := png.Encode(&blank, image.NewGray(image.Rect(0, 0, 128, 128))); err != nil {
		t.Fatal(err)
	}
	oversized := qrPNG(t, "oversized")
	// A valid PNG header with excessive dimensions is rejected before allocation.
	binary.BigEndian.PutUint32(oversized[16:20], 5000)
	binary.BigEndian.PutUint32(oversized[20:24], 5000)
	binary.BigEndian.PutUint32(oversized[29:33], crc32.ChecksumIEEE(oversized[12:29]))
	for name, data := range map[string][]byte{
		"empty":           nil,
		"text":            []byte("not an image"),
		"too many bytes":  make([]byte, MaxImageBytes+1),
		"too many pixels": oversized,
		"no QR":           blank.Bytes(),
		"truncated PNG":   qrPNG(t, "truncated")[:40],
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := DecodeImage(data); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}
