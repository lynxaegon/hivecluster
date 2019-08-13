#!/bin/sh
curl --request GET -s --url https://api.digitalocean.com/v2/kubernetes/clusters/${DO_KUBE_CLUSTER}/kubeconfig --header "authorization: Bearer ${DO_API_KEY}" > ./kube_certs.yaml

cd src && npm install && cd ..

docker login

docker build -t hivecluster .
docker tag hivecluster lynxaegon/hivecluster
docker push lynxaegon/hivecluster

kubectl --kubeconfig="kube_certs.yaml" set image deployment exoskeleton-frontend exoskeleton-frontend=$(docker inspect --format='{{index .RepoDigests 0}}' lynxaegon/hivecluster:latest)

