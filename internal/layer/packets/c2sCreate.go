package layerpackets

import (
	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const c2s_type_layer_create = "c2s_create_layer"

// s2cCreatePacket contains information about a layer's id and height which
// must be decided by the server, so a distinct packet must be used to request
// creating a new layer from the client
type c2sCreatePacket layer.Type

var _ = c2s.Register(c2s_type_layer_create, func() layer.Handler { return new(c2sCreatePacket) })

func (layerType c2sCreatePacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	layer, err := layers.CreateLayer(layer.Type(layerType), sender)
	if err != nil {
		return nil, err
	}
	height := layers.Add(layer)
	if err := users.SendToAll(NewS2CCreatePacket(layer, height)); err != nil {
		return nil, err
	}
	if err := users.SendToAll(layer.InitPacket()); err != nil {
		return nil, err
	}
	return nil, nil
}
