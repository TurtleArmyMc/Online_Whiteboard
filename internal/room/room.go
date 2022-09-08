package room

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/layer/canvas"
	layerpackets "github.com/turtlearmy/online-whiteboard/internal/layer/packets"
	"github.com/turtlearmy/online-whiteboard/internal/layer/paintlayer"
	_ "github.com/turtlearmy/online-whiteboard/internal/layer/textlayer" // Needs to be imported to register layer and its packet
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type Room struct {
	incomingMessages chan *message
	connRequests     chan user.ConnectionRequest
	closeConns       chan user.Connection

	layers *layer.Manager
	users  *user.Manager

	open bool
}

func New() *Room {
	room := &Room{
		make(chan *message, 256),
		make(chan user.ConnectionRequest, 8),
		make(chan user.Connection, 8),
		&layer.Manager{},
		user.NewManager(),
		true,
	}

	go room.handleEvents()

	return room
}

func (room *Room) WsHandler(writer http.ResponseWriter, req *http.Request, session user.Session) {
	err := room.addConnection(writer, req, session)
	if err != nil {
		log.Printf("error adding websocket connection: %v\n", err)
		return
	}
}

func (room *Room) addConnection(writer http.ResponseWriter, req *http.Request, session user.Session) error {
	ws, err := wsupgrader.Upgrade(writer, req, nil)
	if err != nil {
		return err
	}

	outgoing := make(chan []byte, 256)

	// Write outgoing messages
	go func() {
		for msg := range outgoing {
			ws.WriteMessage(websocket.TextMessage, msg)
		}
	}()

	// Register and receive handle to connection
	receiveConn := make(chan user.Connection)
	room.connRequests <- user.NewConnectionRequest(outgoing, session, receiveConn)
	connHandle := <-receiveConn

	// Read incoming messages
	go func() {
		for {
			t, msgData, err := ws.ReadMessage()
			if err != nil {
				break
			}
			if t == websocket.BinaryMessage {
				log.Printf("warning: received binary message `%s`", msgData)
			}
			if t == websocket.TextMessage {
				if packet, err := c2s.Deserialize(msgData); err != nil {
					log.Printf("error decoding incoming packet: %v\n", err)
				} else {
					room.incomingMessages <- &message{packet, connHandle}
				}
			}
		}

		// Send connection to be closed when done receiving messages
		room.closeConns <- connHandle
	}()

	return nil
}

func (room *Room) setupNewConnection(req user.ConnectionRequest) error {
	previouslyOnline := room.users.OnlineUsers()

	c := room.users.AddConnection(req)

	if onlineUsers := room.users.OnlineUsers(); len(previouslyOnline) != len(onlineUsers) {
		// Inform existing connections that user is now online
		room.users.SendFrom(onlineUsers, c)
	}

	// Send user id to client
	if err := c.Send(user.SetUserIdPacket(c.User)); err != nil {
		return err
	}

	// Send usernames to client
	if err := c.Send(room.users.NewMapNamesPacket()); err != nil {
		return err
	}

	// Send list of which users are online to client
	if err := c.Send(room.users.OnlineUsers()); err != nil {
		return err
	}

	// Create new layer for user if none are owned
	if len(room.layers.OwnedLayers(c.User)) == 0 {
		l, err := room.layers.CreateLayer(paintlayer.LAYER_TYPE, c.User)
		if err != nil {
			return err
		}

		height := room.layers.Add(l)

		// Inform other connections of new layer
		if err := room.users.SendFrom(layerpackets.NewS2CCreatePacket(l, height), c); err != nil {
			return err
		}
		if err := room.users.SendFrom(l.InitPacket(), c); err != nil {
			return err
		}

	}

	// Inform connection of all existing layers
	for layerHeight, l := range room.layers.Layers {
		if err := c.Send(layerpackets.NewS2CCreatePacket(l, layerHeight)); err != nil {
			return err
		}
		if err := c.Send(l.InitPacket()); err != nil {
			return err
		}
	}
	return nil
}

func (room *Room) removeConnection(c user.Connection) {
	room.users.RemoveConnection(c)

	// Send online users if this was a user's last connection
	if !room.users.Online(c.User) {
		if err := room.users.SendToAll(room.users.OnlineUsers()); err != nil {
			log.Printf("error broadcasting disconnect notification packet: %v\n", err)
		}
	}
	if room.users.ConnectionCount() == 0 {
		// TODO: Remove room when empty
	}
}

func (room *Room) handleEvents() {
	for room.open {
		select {
		case conn := <-room.connRequests:
			if err := room.setupNewConnection(conn); err != nil {
				if err != nil {
					log.Printf("error setting up new connection: %v\n", err)
				}
			}
		case conn := <-room.closeConns:
			room.removeConnection(conn)
		case msg := <-room.incomingMessages:
			broadcast, err := msg.Packet.Handle(room.layers, room.users, msg.Sender.User)
			if err != nil {
				log.Printf("error applying packet: %v\n", err)
			}
			if broadcast != nil {
				if err := room.users.SendFrom(broadcast, msg.Sender); err != nil {
					log.Printf("error broadcasting packet: %v\n", err)
				}
			}
		}
	}
}

var wsupgrader = websocket.Upgrader{
	ReadBufferSize:    canvas.Height * canvas.Width * 4 * 10, // 1024,
	WriteBufferSize:   canvas.Height * canvas.Width * 4 * 10, // 1024,
	EnableCompression: true,
}
