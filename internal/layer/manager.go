package layer

import "github.com/turtlearmy/online-whiteboard/internal/user"

type Manager struct {
	// Stored in order of top to bottom
	Layers []Layer

	nextId Id
}

func (layers *Manager) validHeight(i int) bool {
	return 0 <= i && i < len(layers.Layers)
}

func (layers *Manager) TotalCount() int {
	return len(layers.Layers)
}

func (layers *Manager) Get(id Id) Layer {
	layer, _ := layers.GetWithHeight(id)
	return layer
}

func (layers *Manager) GetWithHeight(id Id) (Layer, int) {
	for height, layer := range layers.Layers {
		if id == layer.Id() {
			return layer, height
		}
	}
	return nil, -1
}

func (layers *Manager) GetAtHeight(i int) Layer {
	if !layers.validHeight(i) {
		return nil
	}
	return layers.Layers[i]
}

func (layers *Manager) Add(layer Layer) {
	layers.Layers = append(layers.Layers, layer)
}

// returns if insert was within bounds
func (layers *Manager) Insert(layer Layer, height int) bool {
	// Insert can be at the before existing layers or on top of them all
	if !layers.validHeight(height) && height != len(layers.Layers) {
		return false
	}

	// Extend number of layers by 1 and move all layers up level
	layers.Layers = append(layers.Layers, nil)
	for j := len(layers.Layers) - 1; j > height; j-- {
		layers.Layers[j] = layers.Layers[j-1]
	}

	layers.Layers[height] = layer
	return true
}

// returns whether remove was successful
func (layers *Manager) Remove(id Id) bool {
	layer, height := layers.GetWithHeight(id)
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
