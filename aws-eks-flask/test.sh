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

#Create IAM policy to Worker Node Role
aws iam create-policy --policy-name AWSLBControllerIAMPolicy --policy-document file://iam-sa-policy.json

#Attach IAM policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::312422985030:policy/AWSLBControllerIAMPolicy --role-name $NODE_ROLE_NAME

set +x
echo "========================"
echo "------IAM SA Create START-----"
echo "========================"
set -x

#eksctl create iamserviceaccount --cluster=$CLUSTER_NAME --namespace=default --name=aws-load-balancer-controller --attach-policy-arn="arn:aws:iam::312422985030:policy/AWSLBControllerIAMPolicy" --override-existing-serviceaccounts --approve --region ${REGION}

set +x
echo "========================"
echo "------IAM SA Create END-----"
echo "========================"
set -x

kubectl get sa

sed -i "s/CLUSTER_NAME/${CLUSTER_NAME}/g" aws-load-balancer-controller.yaml