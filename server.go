package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"time"
)

func healthcheck() {
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/healthz")
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		os.Exit(1)
	}
}

func runServer(ctx context.Context, app *relay) error {
	go app.cleanupLoop(ctx)
	server := &http.Server{
		Addr:              listenAddress,
		Handler:           app.handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Minute,
		IdleTimeout:       time.Minute,
		MaxHeaderBytes:    32 << 10,
	}
	done := make(chan struct{})
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Printf("shutdown: %v", err)
		}
		close(done)
	}()
	log.Printf("listening on %s; public URL %s; default file lifetime %s, maximum %s", server.Addr, app.baseURL, defaultRetention, maxRetention)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	<-done
	return nil
}
