#!/bin/sh
$KUBE_CERTS_DOWNLOADER

docker build -t hivecluster .
docker tag hivecluster lynxaegon/hivecluster
docker push lynxaegon/hivecluster

kubectl --kubeconfig="certs.yaml" set image deployment exoskeleton-frontend exoskeleton-frontend=$(docker inspect --format='{{index .RepoDigests 0}}' lynxaegon/hivecluster:latest)
