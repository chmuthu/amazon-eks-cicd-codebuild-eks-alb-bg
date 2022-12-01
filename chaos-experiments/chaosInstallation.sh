#!/bin/bash

set +x
echo "================"
echo "--LitmusChaos Installation ==> START--"
echo "================"
set -x

helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm/
helm repo list

sleep 10

kubectl create ns litmus
helm install chaos litmuschaos/litmus --namespace=litmus
sleep 10

kubectl get pods -n litmus

sleep 5

kubectl patch svc chaos-litmus-frontend-service -p '{"spec": {"type": "LoadBalancer"}}' -n litmus

kubectl get svc -n litmus

sleep 5

echo "Litmust Chaos Center Endpoint: " kubectl get svc chaos-litmus-frontend-service -n litmus

set +x
echo "================"
echo "--LitmusChaos Installation==> END--"
echo "================"
set -x

set +x
echo "================"
echo "--Experiments ServiceAccounts Installation==> START--"
echo "================"
set -x

cd ..

kubectl apply -f https://litmuschaos.github.io/litmus/litmus-operator-v1.13.8.yaml

kubectl apply -f https://hub.litmuschaos.io/api/chaos/1.13.8?file=charts/generic/experiments.yaml

kubectl apply -f chaos-experiments-sa/

#kubectl apply -f chaos-experiments/

sleep 5

kubectl get sa

kubectl get crds | grep chaos

kubectl api-resources | grep chaos

set +x
echo "================"
echo "--Experiments ServiceAccounts Installation==> END--"
echo "================"
set -x