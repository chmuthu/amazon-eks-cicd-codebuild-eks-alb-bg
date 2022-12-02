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

#kubectl apply -f rbac.yaml

sleep 5

#Create IAM Policy
#aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam-policy.json

kubectl apply --validate=false -f https://github.com/jetstack/cert-manager/releases/download/v1.5.4/cert-manager.yaml

#sed -i "s/devCluster/$CLUSTER_NAME/g" aws-load-balancer-controller.yaml
#ed -i "s/# - --cluster-name/- --cluster-name/g" aws-load-balancer-controller.yaml
sleep 10

cd k8s-manifest

kubectl apply -f aws-load-balancer-controller.yaml

#Create SA for AWS LB Controller
#kubectl apply -f aws-load-balancer-controller-service-account.yaml
#eksctl create iamserviceaccount --cluster $CLUSTER_NAME --namespace kube-system --name aws-load-balancer-controller --attach-policy-arn arn:aws:iam::312422985030:policy/AWSLoadBalancerControllerIAMPolicy --override-existing-serviceaccounts --approve
#eksctl create iamserviceaccount --cluster $CLUSTER_NAME --namespace kube-system --name aws-load-balancer-controller --attach-policy-arn arn:aws:iam::312422985030:policy/AWSLoadBalancerControllerIAMPolicy

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

#Attach IAM policy to Worker Node Role
#if [ ! -f iam-policy.json ]; then
#    curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-alb-ingress-controller/master/docs/examples/iam-policy.json
#fi
#aws iam put-role-policy --role-name $NODE_ROLE_NAME --policy-name elb-policy --policy-document file://iam-policy.json

#pip install -U chaostoolkit
#sleep 10
#chaos --help

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
kubectl apply -f flask-ingress.yaml
kubectl apply -f nodejs-deployment.yaml
kubectl apply -f nodejs-service.yaml
kubectl apply -f nodejs-ingress.yaml

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

cd ../../aws-eks-frontend
npm install

npm run build

docker build -t demo-frontend .

docker tag demo-frontend:latest $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/demo-frontend:latest

docker images

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