package main

import (
	"github.com/gin-gonic/gin"
	"github.com/turtlearmy/online-whiteboard/internal/comm"
	"github.com/turtlearmy/online-whiteboard/internal/room"
)

func main() {
	room := room.New()

	r := gin.Default()
	r.StaticFile("/", "web/static/index.html")
	r.StaticFile("/workspace.html", "web/static/workspace.html")
	r.StaticFile("/workspace.js", "web/static/workspace.js")

	r.GET("/ws", func(c *gin.Context) {
		room.WsHandler(c.Writer, c.Request, comm.NewSession())
	})

	r.Run("0.0.0.0:8080")
}
