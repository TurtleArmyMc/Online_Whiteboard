package user

import (
	"fmt"
	"sync"

	"github.com/gorilla/websocket"
)

type Manager struct {
	sessions   map[Session]Id
	nextUserId Id

	connections map[connectionId]Connection
	nextConnId  connectionId

	names map[Id]string

	// Sessions, users and connections can be modified at any moment by new
	// websockets being created, so a mutex is necessary
	mu sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{sessions: map[Session]Id{}, connections: map[connectionId]Connection{}, names: map[Id]string{}}
}

func (users *Manager) ForSession(session Session) Id {
	users.mu.Lock()
	defer users.mu.Unlock()

	if u, ok := users.sessions[session]; ok {
		return u
	}

	users.nextUserId++ // Start ids at 1 and not 0
	users.sessions[session] = users.nextUserId
	return users.nextUserId
}

func (users *Manager) AddConnection(ws *websocket.Conn, u Id) Connection {
	users.mu.Lock()
	defer users.mu.Unlock()

	users.nextConnId++ // Start ids at 1 and not 0
	id := users.nextConnId

	outgoing := make(chan []byte, 64)

	c := Connection{outgoing, u, id}

	users.connections[c.id] = c

	// Write outgoing messages
	go func() {
		for msg := range outgoing {
			ws.WriteMessage(websocket.TextMessage, msg)
		}
	}()

	return c
}

func (users *Manager) RemoveConnection(c Connection) {
	users.mu.Lock()
	delete(users.connections, c.id)
	users.mu.Unlock()
}

func (users *Manager) ConnectionCount() int {
	users.mu.RLock()
	defer users.mu.RUnlock()
	return len(users.connections)
}

func (users *Manager) Online(u Id) bool {
	users.mu.RLock()
	defer users.mu.RUnlock()

	for _, c := range users.connections {
		if u == c.User {
			return true
		}
	}
	return false
}

func (users *Manager) Name(user Id) string {
	users.mu.RLock()
	defer users.mu.RUnlock()

	if name, ok := users.names[user]; ok {
		return name
	}
	return fmt.Sprintf("Anonymous %d", user)
}

func (users *Manager) SetName(user Id, name string) {
	users.mu.Lock()
	users.names[user] = name
	users.mu.Unlock()
}

func (users *Manager) SendToAll(packet OutgoingPacket) error {
	data, err := serializePacket(packet)
	if err != nil {
		return err
	}

	users.mu.RLock()
	for _, connection := range users.connections {
		connection.outgoing <- data
	}
	users.mu.RUnlock()
	return nil
}

func (users *Manager) SendFrom(packet OutgoingPacket, sender Connection) error {
	data, err := serializePacket(packet)
	if err != nil {
		return err
	}

	users.mu.RLock()
	for id, connection := range users.connections {
		if id != sender.id {
			connection.outgoing <- data
		}
	}
	users.mu.RUnlock()
	return nil
}
