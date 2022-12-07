#!/bin/bash

export ACCOUNT_ID=$1
export REGION=$2
export CLUSTER_NAME=$3
export NODE_ROLE_NAME=$4

set +x
echo "========================"
echo "------INSTALLATION BEGIN-----"
echo "========================"
set -x

echo "Account: " ${ACCOUNT_ID}
echo "REGION: " ${REGION}
echo "CLUSTER_NAME: " ${CLUSTER_NAME}
echo "NODE_ROLE_NAME: " ${NODE_ROLE_NAME}

kubectl apply -f litmuschaos-2.9.yaml

set +x
echo "========================"
echo "------INSTALLATION END-----"
echo "========================"
set -x

sleep 5

set +x
echo "========================"
echo "------Patching START-----"
echo "========================"
set -x

kubectl patch svc litmusportal-frontend-service -p '{"spec": {"type": "LoadBalancer"}}' -n litmus

sleep 5

kubectl get -n litmus svc litmusportal-frontend-service -o wide

set +x
echo "========================"
echo "------Patching END-----"
echo "========================"
set -x

set +x
echo "========================"
echo "------OIDC Association START-----"
echo "========================"
set -x

aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.identity.oidc.issuer" --output text

sed -i "s/ACCOUNT_ID/${ACCOUNT_ID}/g" LitmusChaosPolicy.json

#Create IAM Policy
aws iam create-policy --policy-name LitmusChaosPolicy --policy-document file://LitmusChaosPolicy.json

eksctl utils associate-iam-oidc-provider --cluster ${CLUSTER_NAME} --region ${REGION} --approve

OIDC_URL=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.identity.oidc.issuer" --output text)

printf 'OIDC URL: %s \n' $OIDC_URL

if [[ -z OIDC_URL ]]; then
  echo "String is empty, Hence associating OIDC provider to the cluster."
  eksctl utils associate-iam-oidc-provider --cluster ${CLUSTER_NAME} --region ${REGION} --approve
  OIDC_URL=$(aws eks describe-cluster --name ${CLUSTER_NAME} --region ${REGION} --query "cluster.identity.oidc.issuer" --output text)
  printf 'OIDC URL Post Cluster Association: %s \n' $OIDC_URL
fi


OIDC_STR=${OIDC_URL:8}
printf 'OIDC_STR: %s \n' $OIDC_STR

sed -i "s/ACCOUNT_ID/${ACCOUNT_ID}/g" LitmusChaosTrustPolicy.json
sed -i "s/REGION/${REGION}/g" LitmusChaosTrustPolicy.json
RANDOM_STR=${OIDC_STR:36}
sed -i "s/RANDOM_STR/${RANDOM_STR}/g" LitmusChaosTrustPolicy.json

set +x
echo "========================"
echo "------OIDC Association END-----"
echo "========================"
set -x

set +x
echo "========================"
echo "------Policy Create START-----"
echo "========================"
set -x

#Create Trust Policy
aws iam create-role --role-name LitmusChaosRole --assume-role-policy-document file://LitmusChaosTrustPolicy.json

aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/LitmusChaosPolicy --role-name LitmusChaosRole

set +x
echo "========================"
echo "------Policy Create END-----"
echo "========================"
set -x

set +x
echo "========================"
echo "------IAM SA Create START-----"
echo "========================"
set -x

#eksctl create iamserviceaccount --cluster=${CLUSTER_NAME} --namespace=litmus --name=ec2-terminate-sa-litmus --attach-policy-arn="arn:aws:iam::${ACCOUNT_ID}:policy/LitmusChaosPolicy" --override-existing-serviceaccounts --approve --region ${REGION}

#Attach IAM policy to Worker Node Role
aws iam attach-role-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/LitmusChaosPolicy --role-name $NODE_ROLE_NAME

kubectl get sa -n litmus

set +x
echo "========================"
echo "------IAM SA Create END-----"
echo "========================"
set -x

sleep 5

#kubectl apply -f secrets.yaml -n litmus

kubectl get svc -n litmus

set +x
echo "========================"
echo "------ END-----"
echo "========================"
set -x