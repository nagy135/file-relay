package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		healthcheck()
		return
	}
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		log.Fatal(err)
	}
	app, err := newRelay(cfg)
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := runServer(ctx, app); err != nil {
		log.Fatal(err)
	}
}
