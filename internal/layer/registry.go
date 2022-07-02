package layer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/user"
)

var registry = map[Type]func(id Id, owner user.Id) Layer{}

func Register(layerType Type, constructor func(id Id, owner user.Id) Layer) error {
	registry[layerType] = constructor
	return nil
}

func (layers *Manager) CreateLayer(layerType Type, owner user.Id) (Layer, error) {
	constructor, ok := registry[layerType]
	if !ok {
		return nil, fmt.Errorf("unknown layer type '%s'", layerType)
	}
	layers.nextId++
	return constructor(layers.nextId, owner), nil
}
