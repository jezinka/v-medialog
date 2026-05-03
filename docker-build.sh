#!/bin/bash
docker compose build
docker save medialog | gzip > medialog.tar.gz
scp medialog.tar.gz ubuntu@51.158.147.19:/home/ubuntu/medialog
