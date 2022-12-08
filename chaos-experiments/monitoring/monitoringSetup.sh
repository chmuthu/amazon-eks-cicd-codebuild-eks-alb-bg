#!/bin/bash

export NODE_ROLE_NAME=$1

set +x
echo "================"
echo "--Metrics Server Installation==> START--"
echo "================"
set -x
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
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

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts

sleep 5

helm install prometheus prometheus-community/prometheus --namespace prometheus --set alertmanager.persistentVolume.storageClass="gp2" --set server.persistentVolume.storageClass="gp2"

sleep 10

kubectl get all -n prometheus

sleep 5

helm install grafana grafana/grafana --namespace grafana --set persistence.storageClassName="gp2" --set persistence.enabled=true --set adminPassword='EKS' --values grafana.yaml --set service.type=LoadBalancer

sleep 10

kubectl get all -n grafana

sleep 5

echo "Grafana Endpoint: " kubectl get svc -n grafana

sleep 5

set +x
echo "================"
echo "--Prometheus/Grafana Installation ==> END--"
echo "================"
set -x

set +x
echo "================"
echo "--CloudWatch ContainerInsights Installation ==> START--"
echo "================"
set -x

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cloudwatch-namespace.yaml

sleep 5

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cwagent/cwagent-serviceaccount.yaml

sleep 5

kubectl apply -f cwagent-configmap.yaml

sleep 5

kubectl apply -f https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/cwagent/cwagent-daemonset.yaml

sleep 10

#Attach IAM policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy --role-name $NODE_ROLE_NAME

kubectl get pods -n amazon-cloudwatch

set +x
echo "================"
echo "--CloudWatch ContainerInsights Installation ==> END--"
echo "================"
set -x