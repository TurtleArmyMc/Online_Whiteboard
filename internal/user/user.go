package user

import (
	"crypto/rand"
	"encoding/base64"
)

// Used to identify different users. A single user can have multiple
// connections by having multiple tabs open
type Id uint
type Session string // Stored in a cookie to identify users

func NewSession() Session {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return Session(base64.RawURLEncoding.EncodeToString(bytes))
}
