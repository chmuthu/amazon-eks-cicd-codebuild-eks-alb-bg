#!/bin/bash

set -x

#Setup Env Vars
export REGION=$1
export NODE_ROLE_NAME=$2
export CLUSTER_NAME=$3

set +x
echo "================"
echo "--Prerequisites Setup ==> START--"
echo "================"
set -x

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
export PATH=/usr/local/bin:$PATH
source ~/.bash_profile
aws --version

sudo curl -o /usr/local/bin/kubectl  https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/kubectl
sudo chmod +x /usr/local/bin/kubectl
echo "kubectl version: " kubectl version --client=true --short=true

sudo yum install -y jq
sudo yum install -y bash-completion
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv -v /tmp/eksctl /usr/local/bin
echo "eksctl version: " eksctl version

export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region')
echo "export AWS_REGION=${AWS_REGION}" | tee -a ~/.bash_profile
aws configure set default.region ${AWS_REGION}


export ACCOUNT_ID=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.accountId')
echo "export ACCOUNT_ID=${ACCOUNT_ID}" | tee -a ~/.bash_profile


curl -sSL https://raw.githubusercontent.com/helm/helm/master/scripts/get-helm-3 | bash


set +x
echo "================"
echo "--Prerequisites Setup ==> END--"
echo "================"
set -x