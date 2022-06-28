package comm

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/turtlearmy/online-whiteboard/internal/canvas"
)

type UserManager struct {
	connections map[*Connection]struct{}
	nextConnId  uint

	session2User map[string]uint
	nextUserId   uint

	mu sync.RWMutex
}

func NewUserManager() *UserManager {
	return &UserManager{map[*Connection]struct{}{}, 1, map[string]uint{}, 1, sync.RWMutex{}}
}

func (users *UserManager) SessionToUserId(session string) uint {
	users.mu.RLock()
	defer users.mu.RUnlock()
	return users.sessionToUserId(session)
}

// Caller must lock mutex
func (users *UserManager) sessionToUserId(session string) uint {
	if userId, ok := users.session2User[session]; ok {
		return userId
	}
	userId := users.nextUserId
	users.nextUserId++
	users.session2User[session] = userId
	return userId
}

// Broadcasts data to everyone but the sender
func (users *UserManager) BroadcastFrom(packet Packet, sender uint) error {
	users.mu.Lock()
	defer users.mu.Unlock()

	encoded, err := packet.encoded()
	if err != nil {
		return err
	}
	for conn := range users.connections {
		if conn.id != sender {
			conn.listener <- encoded
		}
	}

	return nil
}

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:  canvas.Height * canvas.Width * 10, // 1024,
	WriteBufferSize: canvas.Height * canvas.Width * 10, // 1024,

}

func (users *UserManager) AddConnection(writer http.ResponseWriter, req *http.Request, session string, incomingListener chan *Message) (*Connection, error) {
	ws, err := wsupgrader.Upgrade(writer, req, nil)
	if err != nil {
		return nil, err
	}

	outgoingListener := make(chan []byte, 10)

	users.mu.Lock()
	connId := users.nextConnId
	users.nextConnId++
	conn := &Connection{outgoingListener, connId, users.sessionToUserId(session)}
	users.connections[conn] = struct{}{}
	users.mu.Unlock()

	// Send outgoing messages
	go func() {
		for msg := range outgoingListener {
			ws.WriteMessage(websocket.TextMessage, msg)
		}
	}()

	// Read incoming messages
	go func() {
		for {
			t, msgData, err := ws.ReadMessage()
			if err != nil {
				break
			}
			if t == websocket.TextMessage {
				if packet, err := decode(msgData); err != nil {
					log.Printf("error decoding incoming packet: %v\n", err)
				} else {
					incomingListener <- &Message{packet, connId}
				}
			}
		}

		users.removeConnection(conn)
	}()

	return conn, nil
}

func (users *UserManager) removeConnection(connection *Connection) {
	users.mu.Lock()
	delete(users.connections, connection)
	users.mu.Unlock()
}
