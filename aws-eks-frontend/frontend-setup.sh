#!/bin/bash

set -x

#Setup Env Vars
export REGION=$1
export NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

set +x
echo "================"
echo "--Instantiate Frontend Pods ==> START--"
echo "================"
set -x

npm install

npm run build

docker build -t demo-frontend .
docker tag demo-frontend:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/demo-frontend:latest

aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/demo-frontend:latest


#Instantiate frontend PODS

cd k8s-manifest

kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
kubectl apply -f frontend-ingress.yaml

#Check STATUS
kubectl get deploy
kubectl get svc
kubectl get pods
kubectl get ingress

set +x
echo "================"
echo "--Instantiate Frontend Pods ==> END--"
echo "================"
set -x

#Add cluster sg ingress rule from alb source
#CLUSTER_SG=$(aws eks describe-cluster --name $CLUSTER_NAME --query cluster.resourcesVpcConfig.clusterSecurityGroupId | tr -d '["]')

#aws ec2 authorize-security-group-ingress --group-id $CLUSTER_SG --protocol -1 --port -1 --source-group $sg