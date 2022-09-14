package layerpackets

import (
	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const type_layer_move = "c2s_move_layer"

type moveLayerPacket struct {
	Layer  layer.Id `json:"layer"`
	MoveBy int      `json:"move_by"`
}

var _ = c2s.Register(type_layer_move, func() layer.Handler { return new(moveLayerPacket) })

func (p *moveLayerPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	layer, height, err := layers.GetOwned(p.Layer, sender, "change height of")
	if err != nil {
		return nil, err
	}
	newHeight := height + p.MoveBy
	if newHeight < 0 {
		newHeight = 0
	} else if newHeight >= len(layers.Layers) {
		newHeight = len(layers.Layers) - 1
	}
	layers.Remove(p.Layer)
	layers.Insert(layer, newHeight)

	users.SendToAll(&s2cSetLayerHeightPacket{p.Layer, newHeight})
	return nil, nil
}
