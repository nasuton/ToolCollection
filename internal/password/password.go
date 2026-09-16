package password

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
)

const (
	lower   = "abcdefghijkmnopqrstuvwxyz"
	upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ"
	digits  = "23456789"
	symbols = "!@#$%^&*-_=+?"
)

type Options struct {
	Length     int
	UseUpper   bool
	UseDigits  bool
	UseSymbols bool
}

func Generate(o Options) (string, error) {
	if o.Length < 4 || o.Length > 128 {
		return "", errors.New("length must be between 4 and 128")
	}

	pool := lower
	if o.UseUpper {
		pool += upper
	}
	if o.UseDigits {
		pool += digits
	}
	if o.UseSymbols {
		pool += symbols
	}

	var sb strings.Builder
	sb.Grow(o.Length)
	max := big.NewInt(int64(len(pool)))
	for i := 0; i < o.Length; i++ {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		sb.WriteByte(pool[n.Int64()])
	}
	return sb.String(), nil
}
