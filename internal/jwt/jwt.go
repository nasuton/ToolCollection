// Package jwt decodes compact JWTs and verifies explicitly selected signatures.
package jwt

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

type Decoded struct {
	Header  json.RawMessage `json:"header"`
	Payload json.RawMessage `json:"payload"`
}

func Decode(token string) (Decoded, error) {
	var result Decoded
	if len(token) > 1<<20 {
		return result, errors.New("JWT must be at most 1 MiB")
	}
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) != 3 {
		return result, errors.New("JWT must contain three dot-separated segments")
	}
	for i, target := range []*json.RawMessage{&result.Header, &result.Payload} {
		data, err := base64.RawURLEncoding.Strict().DecodeString(parts[i])
		if err != nil {
			return result, fmt.Errorf("invalid JWT segment: %w", err)
		}
		var object map[string]json.RawMessage
		if err := json.Unmarshal(data, &object); err != nil || object == nil {
			return result, errors.New("JWT header and payload must be JSON objects")
		}
		*target = data
	}
	if _, err := base64.RawURLEncoding.Strict().DecodeString(parts[2]); err != nil {
		return result, fmt.Errorf("invalid JWT signature encoding: %w", err)
	}
	return result, nil
}

// Verify checks the signature only, not exp, nbf, iss or aud claims.
// expectedAlgorithm is selected by the caller, never inferred from the token.
func Verify(token, key, expectedAlgorithm string) error {
	decoded, err := Decode(token)
	if err != nil {
		return err
	}
	var header struct {
		Algorithm string          `json:"alg"`
		Critical  json.RawMessage `json:"crit"`
		B64       json.RawMessage `json:"b64"`
	}
	if err := json.Unmarshal(decoded.Header, &header); err != nil {
		return err
	}
	if header.Algorithm != expectedAlgorithm {
		return errors.New("JWT algorithm does not match the selected algorithm")
	}
	if len(header.Critical) != 0 || len(header.B64) != 0 {
		return errors.New("JWT crit and b64 header extensions are not supported")
	}
	parts := strings.Split(strings.TrimSpace(token), ".")
	signature, _ := base64.RawURLEncoding.Strict().DecodeString(parts[2])
	message := []byte(parts[0] + "." + parts[1])
	digest := sha256.Sum256(message)
	switch expectedAlgorithm {
	case "HS256":
		if key == "" {
			return errors.New("HMAC secret must not be empty")
		}
		if strings.Contains(key, "-----BEGIN ") {
			return errors.New("HS256 requires a shared secret, not a PEM key")
		}
		mac := hmac.New(sha256.New, []byte(key))
		mac.Write(message)
		if !hmac.Equal(signature, mac.Sum(nil)) {
			return errors.New("invalid JWT signature")
		}
	case "RS256", "ES256":
		publicKey, err := parsePublicKey(key)
		if err != nil {
			return err
		}
		if expectedAlgorithm == "RS256" {
			public, ok := publicKey.(*rsa.PublicKey)
			if !ok {
				return errors.New("RS256 requires an RSA public key")
			}
			if public.N.BitLen() < 2048 {
				return errors.New("RSA public key must be at least 2048 bits")
			}
			if err := rsa.VerifyPKCS1v15(public, crypto.SHA256, digest[:], signature); err != nil {
				return errors.New("invalid JWT signature")
			}
		} else {
			public, ok := publicKey.(*ecdsa.PublicKey)
			if !ok || public.Curve != elliptic.P256() {
				return errors.New("ES256 requires a P-256 public key")
			}
			if len(signature) != 64 || !ecdsa.Verify(public, digest[:], new(big.Int).SetBytes(signature[:32]), new(big.Int).SetBytes(signature[32:])) {
				return errors.New("invalid JWT signature")
			}
		}
	default:
		return errors.New("supported JWT algorithms are HS256, RS256 and ES256; unsigned JWTs are rejected")
	}
	return nil
}

func parsePublicKey(key string) (any, error) {
	block, rest := pem.Decode([]byte(key))
	if block == nil || strings.TrimSpace(string(rest)) != "" {
		return nil, errors.New("provide one PEM public key or certificate")
	}
	switch block.Type {
	case "PUBLIC KEY":
		return x509.ParsePKIXPublicKey(block.Bytes)
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	case "CERTIFICATE":
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		return certificate.PublicKey, nil
	default:
		return nil, errors.New("expected a PEM public key or certificate")
	}
}
