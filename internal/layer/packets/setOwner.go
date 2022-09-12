package layerpackets

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/c2s"
	"github.com/turtlearmy/online-whiteboard/internal/layer"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

const type_layer_set_owner = "set_layer_owner"

type setOwnerPacket struct {
	Layer    layer.Id `json:"layer"`
	NewOwner user.Id  `json:"new_owner"`
}

var _ = c2s.Register(type_layer_set_owner, func() layer.Handler { return new(setOwnerPacket) })

func (*setOwnerPacket) PacketType() string {
	return type_layer_set_owner
}

func (p *setOwnerPacket) Handle(layers *layer.Manager, users *user.Manager, sender user.Id) (user.OutgoingPacket, error) {
	layer, _, err := layers.GetOwnedOrUnowned(p.Layer, sender, "change owner of")
	if err != nil {
		return nil, err
	}
	// This prevents users setting other users as the owner of an unowned layer
	if layer.Owner() != sender && p.NewOwner != sender {
		return nil, fmt.Errorf("user %d attempted to set user %d as owner of unowned layer %d", sender, p.NewOwner, p.Layer)
	}
	layer.SetOwner(p.NewOwner)

	// The sender must also receive the packet as a confirmation of the
	// requested change. This is to avoid race conditions where multiple users
	// attempt to claim a free layer
	users.SendToAll(p)
	return nil, nil
}
