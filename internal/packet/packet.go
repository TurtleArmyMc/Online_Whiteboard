package packet

import (
	"github.com/turtlearmy/online-whiteboard/internal/canvas"
	"github.com/turtlearmy/online-whiteboard/internal/conn"
)

type Packet interface {
	// Returns whether or not the packet should be broadcast to other connections
	// Apply(currentCanvas *canvas.Canvas, users *UserManager, sender conn.Id) (bool, error)
	Apply(currentCanvas canvas.Canvas, sender conn.Id) (bool, error)
	Encoded() ([]byte, error)
}
