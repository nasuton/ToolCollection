package qr

import (
	"bytes"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"github.com/makiuchi-d/gozxing"
	zxingqr "github.com/makiuchi-d/gozxing/qrcode"
)

// Bound both the compressed input and decoded image memory in the browser.
const MaxImageBytes = 10 << 20
const maxImagePixels = 16_000_000

// DecodeImage reads one QR code from PNG, JPEG or the first frame of a GIF.
// The returned content is text; callers decide whether to offer a URL link.
func DecodeImage(data []byte) (string, error) {
	if len(data) == 0 || len(data) > MaxImageBytes {
		return "", errors.New("画像は空でない 10 MiB 以下のファイルを選択してください")
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return "", errors.New("画像を読み込めません。PNG・JPEG・GIF 形式の画像を選択してください")
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > maxImagePixels/config.Height {
		return "", errors.New("画像は 1600 万画素以下に縮小してください")
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", errors.New("画像データが破損しているため読み込めません")
	}
	bitmap, err := gozxing.NewBinaryBitmapFromImage(img)
	if err != nil {
		return "", errors.New("画像を解析できませんでした")
	}
	decoded, err := zxingqr.NewQRCodeReader().Decode(bitmap, map[gozxing.DecodeHintType]interface{}{
		gozxing.DecodeHintType_TRY_HARDER: true,
	})
	if err != nil {
		return "", errors.New("QR コードを読み取れませんでした。コード全体と周囲の余白が写った鮮明な画像を選択してください")
	}
	return decoded.GetText(), nil
}
