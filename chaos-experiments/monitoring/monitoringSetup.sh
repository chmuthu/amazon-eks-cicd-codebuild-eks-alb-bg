#!/bin/bash

export APPS_NODE_ROLE_NAME=$1
export PF_NODE_ROLE_NAME=$2

set +x
echo "================"
echo "--Metrics Server Installation==> START--"
echo "================"
set -x
kubectl apply -f metrics-server.yaml
sleep 10
#Check

kubectl get all -n kube-system

set +x
echo "================"
echo "--Metrics Server Installation==> END--"
echo "================"
set -x

set +x
echo "================"
echo "--Prometheus/Grafana Installation==> START--"
echo "================"
set -x

kubectl create ns prometheus
kubectl create ns grafana

sleep 5

kubectl apply -f kiali.yaml
kubectl apply -f prometheus.yaml
kubectl apply -f grafana.yaml

sleep 5

kubectl patch svc grafana -p '{"spec": {"type": "LoadBalancer"}}' -n istio-system
kubectl patch svc kiali -p '{"spec": {"type": "LoadBalancer"}}' -n istio-system

sleep 5

set +x
echo "================"
echo "--Prometheus/Grafana Installation ==> END--"
echo "================"
set -x
