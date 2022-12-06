#!/bin/bash

set -x

#Setup Env Vars
export REGION=$1
export NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

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

#Attach IAM policy to Worker Node Role
aws iam put-role-policy --role-name $NODE_ROLE_NAME --policy-name AWSLBControllerIAMPolicy --policy-document file://iam-policy.json

sleep 5

kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v1.5.4/cert-manager.yaml

sleep 10

sed -i "s/- --cluster-name/- --cluster-name=$CLUSTER_NAME/g" aws-load-balancer-controller.yaml

sleep 2

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

#Update Ingress Resource file and spawn ALB
#sg=$(aws ec2 describe-security-groups --filters Name=tag:aws:cloudformation:stack-name,Values=CdkStackALBEksBg | jq '.SecurityGroups[0].GroupId' | tr -d '["]')
#vpcid=$(aws ec2 describe-security-groups --filters Name=tag:aws:cloudformation:stack-name,Values=CdkStackALBEksBg | jq '.SecurityGroups[0].VpcId' | tr -d '["]')
#subnets=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[0].SubnetId' | tr -d '["]')
#subnets="$subnets, $(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[1].SubnetId' | tr -d '["]')"
#subnets="$subnets, $(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcid" "Name=tag:aws-cdk:subnet-name,Values=Public" | jq '.Subnets[2].SubnetId' | tr -d '["]')"


set +x
echo "================"
echo "--Application Pods Installation==> START--"
echo "================"
set -x
#Instantiate both backend PODS
kubectl apply -f flask-deployment.yaml
kubectl apply -f flask-service.yaml
#kubectl apply -f flask-ingress.yaml
kubectl apply -f nodejs-deployment.yaml
kubectl apply -f nodejs-service.yaml
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

#Add cluster sg ingress rule from alb source
CLUSTER_SG=$(aws eks describe-cluster --name $CLUSTER_NAME --query cluster.resourcesVpcConfig.clusterSecurityGroupId | tr -d '["]')

aws ec2 authorize-security-group-ingress \
    --group-id $CLUSTER_SG \
    --protocol -1 \
    --port -1 \
    --source-group $sg
