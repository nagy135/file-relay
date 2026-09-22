FROM golang:1.26-alpine@sha256:8ac98ca534ac3f51e1f420a1dd2c15e74c75cfa0f23f3ad27eb5d7236c349a0c AS build
WORKDIR /src
COPY go.mod ./
COPY *.go index.html ./
RUN go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /file-relay . \
    && mkdir /data && chown 65532:65532 /data

FROM scratch
COPY --from=build /file-relay /file-relay
COPY --from=build --chown=65532:65532 /data /data
USER 65532:65532
ENV DATA_DIR=/data
EXPOSE 8080
ENTRYPOINT ["/file-relay"]
