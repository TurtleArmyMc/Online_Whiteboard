package comm

import (
	"crypto/rand"
	"encoding/base64"
)

func NewSession() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return base64.RawURLEncoding.EncodeToString(bytes)
}
