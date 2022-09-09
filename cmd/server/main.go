package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/turtlearmy/online-whiteboard/internal/room"
	"github.com/turtlearmy/online-whiteboard/internal/user"
)

// Gets the session cookie for the request, setting it if necessary
func getSession(c *gin.Context) user.Session {
	session, err := c.Cookie("session")
	if err != nil {
		session = string(user.NewSession())
		c.SetCookie("session", session, 24*24*60, "", "", false, false)
	}
	return user.Session(session)
}

func main() {
	room := room.New()

	r := gin.Default()
	r.StaticFile("/", "web/static/index.html")
	r.StaticFile("/workspace.html", "web/static/workspace.html")

	r.StaticFS("/javascript", http.Dir("web/static/javascript"))
	r.StaticFS("/css", http.Dir("web/static/css"))
	r.StaticFS("/icons", http.Dir("web/static/icons"))

	// Set session cookie for all connections
	r.Use(func(c *gin.Context) {
		getSession(c)
	})

	r.GET("/ws", func(c *gin.Context) {
		room.WsHandler(c.Writer, c.Request, getSession(c))
	})

	r.Run("0.0.0.0:8080")
}
