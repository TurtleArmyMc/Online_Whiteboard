package canvas

type Pos struct {
	X int `json:"x"`
	Y int `json:"y"`
}

func (pos Pos) Positive() bool {
	return pos.X >= 0 && pos.Y >= 0
}
