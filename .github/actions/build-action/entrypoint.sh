#!/bin/sh
# Pull Kube Certificates from DO
curl --request GET -s --url https://api.digitalocean.com/v2/kubernetes/clusters/${DO_KUBE_CLUSTER}/kubeconfig --header "authorization: Bearer ${DO_API_KEY}" > ./kube_certs.yaml

# Docker login
docker login

# Docker build
docker build -t hivecluster .
docker tag hivecluster lynxaegon/hivecluster
docker push lynxaegon/hivecluster

# Kube image update
kubectl --kubeconfig="kube_certs.yaml" set image deployment exoskeleton-frontend exoskeleton-frontend=$(docker inspect --format='{{index .RepoDigests 0}}' lynxaegon/hivecluster:latest)
