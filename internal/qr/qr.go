package qr

import (
	"encoding/base64"
	"errors"

	"github.com/skip2/go-qrcode"
)

func EncodePNGDataURL(text string, size int) (string, error) {
	if text == "" {
		return "", errors.New("text is required")
	}
	if size < 64 || size > 1024 {
		return "", errors.New("size must be between 64 and 1024")
	}
	png, err := qrcode.Encode(text, qrcode.Medium, size)
	if err != nil {
		return "", err
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png), nil
}
