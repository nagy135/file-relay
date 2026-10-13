package main

import (
	"errors"
	"io"
	"strconv"
	"time"
)

var errRetention = errors.New("expires_in must be an integer number of seconds between 3600 and 2592000 (30 days)")

// Bound the small text field without buffering the uploaded file.
func readRetention(r io.Reader) (time.Duration, error) {
	b, err := io.ReadAll(io.LimitReader(r, 21))
	if err != nil {
		return 0, err
	}
	if len(b) == 0 || len(b) > 20 {
		return 0, errRetention
	}
	for _, c := range b {
		if c < '0' || c > '9' {
			return 0, errRetention
		}
	}
	seconds, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil || seconds < int64(defaultRetention/time.Second) || seconds > int64(maxRetention/time.Second) {
		return 0, errRetention
	}
	return time.Duration(seconds) * time.Second, nil
}
