#!/bin/bash
set -e
cd "${0%/*}"

IMAGE_NAME="199658938451.dkr.ecr.us-east-2.amazonaws.com/openreplay/chalice"

echo 'Logging into AWS ECR'
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin $IMAGE_NAME

git_sha=$(git rev-parse --short HEAD)
envarg="default-foss"
SSO_TAG="${git_sha}-sso"

cp Dockerfile.dockerignore .dockerignore

docker buildx create --use --name=crossplat --node=crossplat 2>/dev/null || docker buildx use crossplat
docker buildx build \
    --output "type=image,push=true" \
    --platform linux/amd64,linux/arm64 \
    --build-arg envarg=$envarg --build-arg GIT_SHA=$git_sha \
    --tag "$IMAGE_NAME:${SSO_TAG}" .
