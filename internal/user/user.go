package user

import (
	"crypto/rand"
	"encoding/base64"
)

type Id uint
type Session string

func NewSession() Session {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return Session(base64.RawURLEncoding.EncodeToString(bytes))
}
