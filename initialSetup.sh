#!/bin/bash

set -x

#Setup Env Vars
#export REGION=$1
#export NODE_ROLE_NAME=$2
#export CLUSTER_NAME=$3

set +x
echo "================"
echo "--Prerequisites Setup ==> START--"
echo "================"
set -x

sudo yum install -y jq
sudo yum install -y bash-completion
export ACCOUNT_ID=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.accountId')
export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}
aws configure get default.region

INSTANCE_ROLE=$(aws cloudformation describe-stack-resources --stack-name CdkStackALBEksBg | jq .StackResources[].PhysicalResourceId | grep CdkStackALBEksBg-ClusterNodegroupDefaultCapacityNo | tr -d '["\r\n]')
CLUSTER_NAME=$(aws cloudformation describe-stack-resources --stack-name CdkStackALBEksBg | jq '.StackResources[] | select(.ResourceType=="Custom::AWSCDK-EKS-Cluster").PhysicalResourceId' | tr -d '["\r\n]')
echo "INSTANCE_ROLE = " $INSTANCE_ROLE 
echo "CLUSTER_NAME = " $CLUSTER_NAME

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
export PATH=/usr/local/bin:$PATH
source ~/.bash_profile
aws --version

sudo curl -o /usr/local/bin/kubectl  https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/kubectl
sudo chmod +x /usr/local/bin/kubectl
echo "kubectl version: " kubectl version --client=true --short=true

curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv -v /tmp/eksctl /usr/local/bin
echo "eksctl version: " eksctl version



curl -sSL https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash


cd cdk

sudo yum install -y npm
npm install -g aws-cdk
npm install -g typescript@latest

cdk init

npm install

npm run build
cdk ls

cdk synth

cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION --force
set +x
echo "================"
echo "--Prerequisites Setup ==> END--"
echo "================"
set -x