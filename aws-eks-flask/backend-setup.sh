#!/bin/bash

set -x

#Setup Env Vars
export ACCOUNT_ID=$1
export REGION=$2
export NODE_ROLE_NAME=$3
export CLUSTER_NAME=$4

set +x
echo "================"
echo "--AWS LB CONTROLLER Installation==> START--"
echo "================"
set -x

#Associate IAM-OIDC-Provider
eksctl utils associate-iam-oidc-provider --region $REGION --cluster $CLUSTER_NAME --approve

sleep 5

#Check the OIDC provider associated to cluster
aws eks describe-cluster --name $CLUSTER_NAME --query "cluster.identity.oidc.issuer" --output text

sleep 5

cd k8s-manifest

#Create AWSLBController IAM policy to Worker Node Role
policyExists=$(aws iam list-policies | jq '.Policies[].PolicyName' | grep AWSLBControllerIAMPolicy | tr -d '["\r\n]')
if [[ "$policyExists" != "AWSLBControllerIAMPolicy" ]]; then
    echo "AWSLBControllerIAMPolicy Policy does not exist, creating..."
    aws iam create-policy --policy-name AWSLBControllerIAMPolicy --policy-document file://iam-sa-policy.json
fi

#Attach AWSLBController IAM policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/AWSLBControllerIAMPolicy --role-name $NODE_ROLE_NAME

#Attach ECR Access policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess --role-name $NODE_ROLE_NAME

sed -i "s/CLUSTER_NAME/$CLUSTER_NAME/g" aws-load-balancer-controller.yaml

kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v1.5.4/cert-manager.yaml

sleep 10

kubectl apply -f aws-load-balancer-controller.yaml

sleep 10

#Check
kubectl get deployment -n kube-system aws-load-balancer-controller
kubectl get sa aws-load-balancer-controller -n kube-system -o yaml

set +x
echo "================"
echo "--AWS LB CONTROLLER Installation==> END--"
echo "================"
set -x

#Check
kubectl get all -n kube-system

sleep 5
#kubectl logs -n kube-system $(kubectl get po -n kube-system | egrep -o "alb-ingress[a-zA-Z0-9-]+")

set +x
echo "================"
echo "--Application Pods Installation==> START--"
echo "================"
set -x
#Instantiate both backend PODS
#kubectl apply -f flask-deployment.yaml
#kubectl apply -f flask-service.yaml
#kubectl apply -f flask-ingress.yaml
#kubectl apply -f nodejs-deployment.yaml
#kubectl apply -f nodejs-service.yaml
#kubectl apply -f nodejs-ingress.yaml

sleep 15
#Check
kubectl get all
sleep 5
kubectl get ingress

sleep 5

set +x
echo "================"
echo "--Application Pods Installation==> END--"
echo "================"
set -x

set +x
echo "========================"
echo "------END EXECUTION-----"
echo "========================"