#!/bin/bash

set -x

#Setup Env Vars
export ACCOUNT_ID=$1
export REGION=$2

set +x
echo "================"
echo "--Instantiate Frontend Pods ==> START--"
echo "================"
set -x

npm install

npm run build

docker build -t demo-frontend .
docker tag demo-frontend:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/demo-frontend:latest

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/demo-frontend:latest


#Instantiate frontend PODS

cd k8s-manifest

sed -i "s/ACCOUNT_ID/$ACCOUNT_ID/g" frontend-deployment.yaml
sed -i "s/REGION/$REGION/g" frontend-deployment.yaml

set +x
echo "================"
echo "--Instantiate Frontend Pods ==> END--"
echo "================"
set -x
