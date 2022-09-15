package layerpackets

import (
	"strings"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const type_layer_set_name = "set_layer_name"

type setNamePacket struct {
	Layer   layer.Id `json:"layer"`
	NewName string   `json:"new_name"`
}

var _ = c2s.Register(type_layer_set_name, func() layer.Handler { return new(setNamePacket) })

func (*setNamePacket) PacketType() string {
	return type_layer_set_name
}

func (p *setNamePacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	layer, _, err := layers.GetOwned(p.Layer, sender, "change name of")
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(p.NewName)
	if name == layer.Name() {
		return nil, nil
	}
	layer.SetName(name)
	return p, nil
}
