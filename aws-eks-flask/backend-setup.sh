#!/bin/bash

set -x

#Setup Env Vars
export ACCOUNT_ID=$1
export REGION=$2
export APPS_NODE_ROLE_NAME=$3
export PF_NODE_ROLE_NAME=$4
export CB_INSTANCE_ROLE=$5
export CLUSTER_NAME=$6

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

#Create AWSLBController IAM Policy to Worker Node Role
policyExists=$(aws iam list-policies | jq '.Policies[].PolicyName' | grep AWSLBControllerIAMPolicy | tr -d '["\r\n]')
if [[ "$policyExists" != "AWSLBControllerIAMPolicy" ]]; then
    echo "AWSLBControllerIAMPolicy Policy does not exist, creating..."
    aws iam create-policy --policy-name AWSLBControllerIAMPolicy --policy-document file://iam-sa-policy.json
fi

#Attach AWSLBController IAM Policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/AWSLBControllerIAMPolicy --role-name $APPS_NODE_ROLE_NAME
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/AWSLBControllerIAMPolicy --role-name $PF_NODE_ROLE_NAME

#Attach ECR Access Policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess --role-name $APPS_NODE_ROLE_NAME
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess --role-name $PF_NODE_ROLE_NAME

#Attach CloudWatch Policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy --role-name $APPS_NODE_ROLE_NAME
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy --role-name $PF_NODE_ROLE_NAME

#Create AWSLBController IAM policy to Worker Node Role
policyExists=$(aws iam list-policies | jq '.Policies[].PolicyName' | grep ClusterAutoscalerPolicy | tr -d '["\r\n]')
if [[ "$policyExists" != "ClusterAutoscalerPolicy" ]]; then
    echo "ClusterAutoscalerPolicy Policy does not exist, creating..."
    aws iam create-policy --policy-name ClusterAutoscalerPolicy --policy-document file://cluster-autoscaler-policy.json
fi

#Attach ClusterAutoscaler Policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/ClusterAutoscalerPolicy --role-name $APPS_NODE_ROLE_NAME
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/ClusterAutoscalerPolicy --role-name $PF_NODE_ROLE_NAME

sed -i "s/CLUSTER_NAME/$CLUSTER_NAME/g" cluster-autoscaler.yaml

kubectl apply -f cluster-autoscaler.yaml

sleep 10

#Attach ECR Access Policy to CodeBuild Service Role
aws iam attach-role-policy --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess --role-name $CB_INSTANCE_ROLE

#Enable Container CW Insights
#kubectl apply -f container-insights.yaml

kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v1.5.4/cert-manager.yaml

sleep 10

sed -i "s/CLUSTER_NAME/$CLUSTER_NAME/g" aws-load-balancer-controller.yaml

kubectl apply -f aws-load-balancer-controller.yaml

sleep 10

kubectl apply -f https://github.com/kubernetes-sigs/aws-load-balancer-controller/releases/download/v2.4.4/v2_4_4_ingclass.yaml

sleep 10

#Check
kubectl get deployment -n kube-system aws-load-balancer-controller
kubectl get sa aws-load-balancer-controller -n kube-system -o yaml

sed -i "s/ACCOUNT_ID/$ACCOUNT_ID/g" flask-deployment.yaml
sed -i "s/REGION/$REGION/g" flask-deployment.yaml

set +x
echo "================"
echo "--AWS LB CONTROLLER Installation==> END--"
echo "================"
set -x

#Check
kubectl get all -n kube-system

sleep 5

set +x
echo "================"
echo "--Backend IngressObjects Installation==> START--"
echo "================"
set -x

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

aws ecr create-repository --repository-name demo-flask-backend --image-scanning-configuration scanOnPush=true --region $REGION

#Instantiate both backend PODS

kubectl apply -f flask-ingress.yaml
kubectl apply -f flask-service.yaml
kubectl apply -f nodejs-ingress.yaml
kubectl apply -f nodejs-service.yaml

cd ../../aws-eks-frontend/k8s-manifest

kubectl apply -f frontend-ingress.yaml
kubectl apply -f frontend-service.yaml

sleep 15
#Check
kubectl get all
sleep 5

kubectl get ingress
sleep 5

set +x
echo "================"
echo "--Backend IngressObjects Installation==> END--"
echo "================"
set -x

sleep 5

set +x
echo "================"
echo "--Istio Installation==> START--"
echo "================"
set -x

curl -L https://istio.io/downloadIstio | sh -

cd istio-1.16.*

export PATH=$PWD/bin:$PATH

istioctl install --set profile=demo -y

kubectl label namespace default istio-injection=enabled

kubectl get svc istio-ingressgateway -n istio-system

set +x
echo "================"
echo "--Istio Installation==> END--"
echo "================"
set -x

set +x
echo "========================"
echo "------END EXECUTION-----"
echo "========================"
