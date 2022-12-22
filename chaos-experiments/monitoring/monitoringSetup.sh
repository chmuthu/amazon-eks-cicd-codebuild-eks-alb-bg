#!/bin/bash

export APPS_NODE_ROLE_NAME=$1
export PF_NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

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
set +x
echo "================"
echo "--CloudWatch Container Insights Installation ==> START--"
echo "================"
set -x

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cwagent/cwagent-serviceaccount.yaml

sed -i "s/CLUSTER_NAME/$CLUSTER_NAME/g" cwagent-configmap.yaml

kubectl apply -f cwagent-configmap.yaml

sleep 10

kubectl get pods -n amazon-cloudwatch

set +x
echo "================"
echo "--CloudWatch Container Insights Installation ==> END--"
echo "================"
set -x
