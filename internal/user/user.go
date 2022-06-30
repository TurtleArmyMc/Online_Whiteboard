package user

import (
	"crypto/rand"
	"encoding/base64"
)

const ServerId = 0

type Id uint

type User struct {
	Id      Id
	Session string
}

type IdGenerator struct {
	nextId Id
}

func (gen *IdGenerator) Next() Id {
	gen.nextId++ // Start ids at 1 and not 0
	return gen.nextId
}

type Session string

func NewSession() Session {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return Session(base64.RawURLEncoding.EncodeToString(bytes))
}
