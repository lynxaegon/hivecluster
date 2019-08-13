#!/bin/sh

curl --request GET -s --url https://api.digitalocean.com/v2/kubernetes/clusters/$DO_KUBE_CLUSTER/kubeconfig --header 'authorization: Bearer $DO_API_KEY' > ./certs.yaml

docker build -t hivecluster .
docker tag hivecluster lynxaegon/hivecluster
docker push lynxaegon/hivecluster

ls -lah
echo "------------------"
kubectl --kubeconfig="./certs.yaml" set image deployment exoskeleton-frontend exoskeleton-frontend=$(docker inspect --format='{{index .RepoDigests 0}}' lynxaegon/hivecluster:latest)
