package uuid

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
)

const maxCount = 100

// NewV4 returns a random (version 4, RFC 4122) UUID such as
// "3b241101-e2bb-4255-8caf-4136c566a962".
func NewV4() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant RFC 4122

	var buf [36]byte
	hex.Encode(buf[0:8], b[0:4])
	buf[8] = '-'
	hex.Encode(buf[9:13], b[4:6])
	buf[13] = '-'
	hex.Encode(buf[14:18], b[6:8])
	buf[18] = '-'
	hex.Encode(buf[19:23], b[8:10])
	buf[23] = '-'
	hex.Encode(buf[24:36], b[10:16])
	return string(buf[:]), nil
}

// Generate returns n version 4 UUIDs.
func Generate(n int) ([]string, error) {
	if n < 1 || n > maxCount {
		return nil, errors.New("count must be between 1 and 100")
	}
	out := make([]string, 0, n)
	for i := 0; i < n; i++ {
		u, err := NewV4()
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, nil
}
