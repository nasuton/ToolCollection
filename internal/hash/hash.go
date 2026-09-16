// Package hash provides text hashing and bcrypt password comparison.
package hash

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// MaxCost bounds CPU usage in the browser.
const MaxCost = 12

func SHA256(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func Bcrypt(password string, cost int) (string, error) {
	if cost < bcrypt.MinCost || cost > MaxCost {
		return "", errors.New("bcrypt cost must be between 4 and 12")
	}
	value, err := bcrypt.GenerateFromPassword([]byte(password), cost)
	return string(value), err
}

func CompareBcrypt(password, encoded string) (bool, error) {
	if len([]byte(password)) > 72 {
		return false, bcrypt.ErrPasswordTooLong
	}
	cost, err := bcrypt.Cost([]byte(encoded))
	if err != nil {
		return false, err
	}
	if cost > MaxCost {
		return false, errors.New("bcrypt cost exceeds browser limit of 12")
	}
	err = bcrypt.CompareHashAndPassword([]byte(encoded), []byte(password))
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return false, nil
	}
	return err == nil, err
}
