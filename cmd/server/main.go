package main

import (
	"github.com/gin-gonic/gin"
	"github.com/turtlearmy/online-whiteboard/internal/room"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

func main() {
	room := room.New()

	r := gin.Default()
	r.StaticFile("/", "web/static/index.html")
	r.StaticFile("/workspace.html", "web/static/workspace.html")
	r.StaticFile("/workspace.js", "web/static/workspace.js")

	r.GET("/ws", func(c *gin.Context) {
		session, err := c.Cookie("session")
		if err != nil {
			session = string(user.NewSession())
			c.SetCookie("session", session, 24*24*60, "", "", false, false)
		}
		room.WsHandler(c.Writer, c.Request, user.Session(session))
	})

	r.Run("0.0.0.0:8080")
}
