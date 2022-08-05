package layerpackets

import (
	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const c2s_type_layer_delete = "c2s_delete_layer"

// Layer heights must be synced between clients and the server, so layers must
// be deleted serverside
type c2sDeletePacket layer.Id

var _ = c2s.Register(c2s_type_layer_delete, func() layer.Handler { return new(c2sDeletePacket) })

func (layerId c2sDeletePacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	if _, _, err := layers.GetOwned(layer.Id(layerId), sender, "delete"); err != nil {
		return nil, err
	}
	layers.Remove(layer.Id(layerId))
	if err := users.SendToAll(s2cDeletePacket(layerId)); err != nil {
		return nil, err
	}
	return nil, nil
}
