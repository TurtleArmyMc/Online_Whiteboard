package user

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Manager struct {
	sessions   map[Session]Id
	nextUserId Id

	connections map[connectionId]Connection
	nextConnId  connectionId

	mu sync.RWMutex
}

func NewManager() *Manager {
	return &Manager{sessions: map[Session]Id{}, connections: map[connectionId]Connection{}}
}

func (users *Manager) ForSession(session Session) Id {
	users.mu.Lock()
	defer users.mu.Unlock()

	if u, ok := users.sessions[session]; ok {
		return u
	}

	users.nextUserId++
	users.sessions[session] = users.nextUserId
	return users.nextUserId
}

func (users *Manager) AddConnection(ws *websocket.Conn, u Id) Connection {
	users.mu.Lock()
	defer users.mu.Unlock()

	users.nextConnId++
	id := users.nextConnId

	outgoing := make(chan []byte, 10)

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

func (users *Manager) SendFrom(packet OutgoingPacket, sender Connection) error {
	data, err := SerializePacket(packet)
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
