package layer

import (
	"fmt"

	"github.com/turtlearmy/online-whiteboard/internal/user"
)

type Manager struct {
	// Stored in order of top to bottom. Height 0 is the top layer
	Layers []Layer

	nextId Id
}

func (layers *Manager) validHeight(i int) bool {
	return 0 <= i && i < len(layers.Layers)
}

func (layers *Manager) TotalCount() int {
	return len(layers.Layers)
}

func (layers *Manager) Get(id Id) (l Layer, height int) {
	for height, layer := range layers.Layers {
		if id == layer.Id() {
			return layer, height
		}
	}
	return nil, 0
}

// Does not include unowned layers
func (layers *Manager) GetOwned(id Id, owner user.Id, action string) (l Layer, height int, err error) {
	l, height, err = layers.GetOwnedOrUnowned(id, owner, action)
	if err == nil && l.Owner() == 0 {
		return nil, 0, fmt.Errorf("user %d attempted to %s unowned layer %d", owner, action, id)
	}
	return
}

func (layers *Manager) GetOwnedOrUnowned(id Id, owner user.Id, action string) (l Layer, height int, err error) {
	l, height = layers.Get(id)
	if l == nil {
		return nil, 0, fmt.Errorf("user %d attempted to %s non-existant layer %d", owner, action, id)
	}
	// Unowned layers have an owner of 0
	if l.Owner() != owner && l.Owner() != 0 {
		return nil, 0, fmt.Errorf("user %d attempted to %s layer %d owned by user %d", owner, action, id, l.Owner())
	}
	return
}

func (layers *Manager) GetAtHeight(i int) Layer {
	if !layers.validHeight(i) {
		return nil
	}
	return layers.Layers[i]
}

// Adds a layer at the bottom. Returns height the layer was added at
func (layers *Manager) Add(layer Layer) int {
	layers.Layers = append(layers.Layers, layer)
	return len(layers.Layers) - 1
}

// returns if insert was within bounds. 0 is the top height
func (layers *Manager) Insert(layer Layer, height int) bool {
	// Insert can be on top of existing layers or below them all
	if !layers.validHeight(height) && height != len(layers.Layers) {
		return false
	}

	// Extend number of layers by 1 and move all layers down a level
	layers.Layers = append(layers.Layers, nil)
	for j := len(layers.Layers) - 1; j > height; j-- {
		layers.Layers[j] = layers.Layers[j-1]
	}

	layers.Layers[height] = layer
	return true
}

// returns whether remove was successful
func (layers *Manager) Remove(id Id) bool {
	layer, height := layers.Get(id)
	if layer == nil {
		return false
	}

	for height++; height < len(layers.Layers); height++ {
		layers.Layers[height-1] = layers.Layers[height]
	}
	layers.Layers = layers.Layers[:len(layers.Layers)-1]
	return true
}

func (layers *Manager) OwnedLayers(u user.Id) []Layer {
	ret := []Layer{}
	for _, l := range layers.Layers {
		if l.Owner() == u {
			ret = append(ret, l)
		}
	}
	return ret
}

func GetOwnedOfType[T Layer](layers *Manager, id Id, owner user.Id, action string) (l T, height int, err error) {
	var gotLayer Layer
	gotLayer, height, err = layers.GetOwned(id, owner, action)
	if err != nil {
		return
	}
	l, ok := gotLayer.(T)
	if !ok {
		err = fmt.Errorf("user %d attempted to %s %s %d, but got a %s", owner, action, l.LayerType(), id, gotLayer.LayerType())
	}
	return
}
