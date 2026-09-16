package jwt

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"strings"
	"testing"
)

func unsigned(header, payload string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(header)) + "." + base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func hsToken(header, payload, key string) string {
	message := unsigned(header, payload)
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(message))
	return message + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestHS256(t *testing.T) {
	token := hsToken(`{"alg":"HS256"}`, `{"sub":"日本語","exp":1,"large":9007199254740993}`, "secret")
	decoded, err := Decode(token)
	if err != nil || !strings.Contains(string(decoded.Payload), "9007199254740993") {
		t.Fatalf("decode: %+v, %v", decoded, err)
	}
	// Signature verification deliberately does not validate expiry.
	if err := Verify(token, "secret", "HS256"); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ token, key, alg string }{
		{token, "wrong", "HS256"}, {token, "secret", "RS256"}, {token, "", "HS256"},
		{unsigned(`{"alg":"HS256"}`, `{"sub":"tampered"}`) + "." + strings.Split(token, ".")[2], "secret", "HS256"},
		{unsigned(`{"alg":"none"}`, `{}`) + ".", "secret", "none"},
		{hsToken(`{"alg":"HS256","crit":["unknown"]}`, `{}`, "secret"), "secret", "HS256"},
		{hsToken(`{"alg":"HS256","b64":false}`, `{}`, "secret"), "secret", "HS256"},
		{hsToken(`{"alg":"HS256"}`, `{}`, "-----BEGIN PUBLIC KEY-----"), "-----BEGIN PUBLIC KEY-----", "HS256"},
	} {
		if err := Verify(tc.token, tc.key, tc.alg); err == nil {
			t.Errorf("accepted invalid verification: %+v", tc)
		}
	}
}

func TestPublicKeySignatures(t *testing.T) {
	rsaKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	ecKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	for _, alg := range []string{"RS256", "ES256"} {
		t.Run(alg, func(t *testing.T) {
			message := unsigned(`{"alg":"`+alg+`"}`, `{"sub":"test"}`)
			digest := sha256.Sum256([]byte(message))
			var signature []byte
			var public any
			if alg == "RS256" {
				signature, err = rsa.SignPKCS1v15(rand.Reader, rsaKey, crypto.SHA256, digest[:])
				if err != nil {
					t.Fatal(err)
				}
				public = &rsaKey.PublicKey
			} else {
				r, s, err := ecdsa.Sign(rand.Reader, ecKey, digest[:])
				if err != nil {
					t.Fatal(err)
				}
				signature = make([]byte, 64)
				r.FillBytes(signature[:32])
				s.FillBytes(signature[32:])
				public = &ecKey.PublicKey
			}
			der, err := x509.MarshalPKIXPublicKey(public)
			if err != nil {
				t.Fatal(err)
			}
			key := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der}))
			token := message + "." + base64.RawURLEncoding.EncodeToString(signature)
			if err := Verify(token, key, alg); err != nil {
				t.Fatal(err)
			}
			signature[0] ^= 1
			if err := Verify(message+"."+base64.RawURLEncoding.EncodeToString(signature), key, alg); err == nil {
				t.Fatal("accepted tampered signature")
			}
			if err := Verify(token, "invalid PEM", alg); err == nil {
				t.Fatal("accepted invalid key")
			}
			if err := Verify(message+".AA", key, alg); err == nil {
				t.Fatal("accepted short signature")
			}
		})
	}
}

func TestMalformed(t *testing.T) {
	for _, token := range []string{"", "a.b", "a.b.c.d", "!.e30.", unsigned(`[]`, `{}`) + ".", unsigned(`{}`, `null`) + ".", unsigned(`{}`, `{}`) + ".!!", strings.Repeat("x", 1<<20+1)} {
		if _, err := Decode(token); err == nil {
			t.Errorf("accepted malformed token: %.60s", token)
		}
	}
}
