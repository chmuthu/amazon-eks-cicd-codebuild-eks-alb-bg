
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import ecr = require('@aws-cdk/aws-ecr');
import eks = require('@aws-cdk/aws-eks');
import iam = require('@aws-cdk/aws-iam');
import codebuild = require('@aws-cdk/aws-codebuild');
import codecommit = require('@aws-cdk/aws-codecommit');
import targets = require('@aws-cdk/aws-events-targets');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');



export class CdkStackALBEksBg extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /**
     * Create a new VPC with single NAT Gateway
     */
    const vpc = new ec2.Vpc(this, 'NewVPC', {
      cidr: '10.0.0.0/16',
      natGateways: 1
    });

    const clusterAdmin = new iam.Role(this, 'AdminRole', {
      assumedBy: new iam.AccountRootPrincipal()
    });

    const controlPlaneSecurityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      allowAllOutbound: true
    });
    
    controlPlaneSecurityGroup.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(80),
        "Allow all inbound traffic by default",
    );

    const cluster = new eks.Cluster(this, 'Cluster', {
      version: eks.KubernetesVersion.V1_21,
      securityGroup: controlPlaneSecurityGroup,
      vpc,
      defaultCapacity: 2,
      mastersRole: clusterAdmin,
      outputClusterName: true,
    });

    const ecrRepo = new ecr.Repository(this, 'EcrRepo');

    const repository = new codecommit.Repository(this, 'CodeCommitRepo', {
      repositoryName: `${this.stackName}-repo`
    });



    // CODEBUILD - project
    const project = new codebuild.Project(this, 'MyProject', {
      projectName: `${this.stackName}`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromAsset(this, 'CustomImage', {
          directory: '../dockerAssets.d',
        }),
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              'echo Installing nvm...',
              `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash`,
              'export NVM_DIR="$HOME/.nvm"',
              '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"',
              '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"',
              '. "$NVM_DIR/nvm.sh" && nvm ls-remote && nvm install 16',
              //'npm install'
            ]
          },
          pre_build: {
            commands: [
              'env',
              'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
              'export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output=text)',
              '/usr/local/bin/entrypoint.sh',
              'echo Logging in to Amazon ECR',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com'
            ]
          },
          build: {
            commands: [
              'cd flask-docker-app',
              `docker build -t $ECR_REPO_URI:$TAG .`,
              'docker push $ECR_REPO_URI:$TAG'
            ]
          },
          post_build: {
            commands: [
              /*'cd aws-eks-frontend',
              'lerna run build && lerna run synth',
              'npm run build',
              `docker build -t demo-frontend .`,
              `docker tag demo-frontend:latest 312422985030.dkr.ecr.us-west-2.amazonaws.com/demo-frontend:latest`,*/
              'cd aws-eks-flask',
              `docker build -t demo-flask-backend .`,
              `docker tag demo-flask-backend:latest 312422985030.dkr.ecr.us-west-2.amazonaws.com/demo-flask-backend:latest`,
              `docker images ls`,
              'echo Logging in to Amazon ECR',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              `docker push 312422985030.dkr.ecr.us-west-2.amazonaws.com/demo-flask-backend:latest`,
              //`docker push 312422985030.dkr.ecr.us-west-2.amazonaws.com/demo-frontend:latest`,
              'cd k8s-manifests',
              'kubectl apply -f frontend-deployment.yaml',
              'kubectl apply -f frontend-service.yaml',
              'cd ../../aws-eks-flask/k8s-manifests',
              'kubectl apply -f flask-deployment.yaml',
              'kubectl apply -f flask-service.yaml',
              'kubectl apply -f nodejs-deployment.yaml',
              'kubectl apply -f nodejs-service.yaml',
            ]
          }
        }
      })
    })




    // CODEBUILD - project2
    const project2 = new codebuild.Project(this, 'MyProject2', {
      projectName: `${this.stackName}2`,
      source: codebuild.Source.codeCommit({ repository }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.fromAsset(this, 'CustomImage2', {
          directory: '../dockerAssets.d',
        }),
        privileged: true
      },
      environmentVariables: {
        'CLUSTER_NAME': {
          value: `${cluster.clusterName}`
        },
        'ECR_REPO_URI': {
          value: `${ecrRepo.repositoryUri}`
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          pre_build: {
            commands: [
              'env',
              'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
              '/usr/local/bin/entrypoint.sh'
            ]
          },
          build: {
            commands: [
              'cd flask-docker-app',
              'echo "Dummy Action"'
            ]
          },
          post_build: {
            commands: [
              'kubectl get nodes -n flask-alb',
              'kubectl get deploy -n flask-alb',
              'kubectl get svc -n flask-alb',
              "deploy8080=$(kubectl get svc -n flask-alb -o wide | grep ' 8080:' | tr ' ' '\n' | grep app= | sed 's/app=//g')",
              "deploy80=$(kubectl get svc -n flask-alb -o wide | grep ' 80:' | tr ' ' '\n' | grep app= | sed 's/app=//g')",
              "echo $deploy80 $deploy8080",
              "kubectl patch svc flask-svc-alb-blue -n flask-alb -p '{\"spec\":{\"selector\": {\"app\": \"'$deploy8080'\"}}}'",
              "kubectl patch svc flask-svc-alb-green -n flask-alb -p '{\"spec\":{\"selector\": {\"app\": \"'$deploy80'\"}}}'",
              'kubectl get deploy -n flask-alb',
              'kubectl get svc -n flask-alb'
            ]
          }
        }
      })
    })





    // PIPELINE

    const sourceOutput = new codepipeline.Artifact();

    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository,
      output: sourceOutput,
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project,
      input: sourceOutput,
      outputs: [new codepipeline.Artifact()], // optional
    });


    const buildAction2 = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project: project2,
      input: sourceOutput,
    });


    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Approve',
    });



    new codepipeline.Pipeline(this, 'MyPipeline', {
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'BuildAndDeploy',
          actions: [buildAction],
        },
        {
          stageName: 'ApproveSwapBG',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'SwapBG',
          actions: [buildAction2],
        },
      ],
    });


    repository.onCommit('OnCommit', {
      target: new targets.CodeBuildProject(project)
    });

    ecrRepo.grantPullPush(project.role!)
    cluster.awsAuth.addMastersRole(project.role!)
    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['eks:DescribeCluster'],
      resources: [`${cluster.clusterArn}`],
    }))


    ecrRepo.grantPullPush(project2.role!)
    cluster.awsAuth.addMastersRole(project2.role!)
    project2.addToRolePolicy(new iam.PolicyStatement({
      actions: ['eks:DescribeCluster'],
      resources: [`${cluster.clusterArn}`],
    }))


    new cdk.CfnOutput(this, 'CodeCommitRepoName', { value: `${repository.repositoryName}` })
    new cdk.CfnOutput(this, 'CodeCommitRepoArn', { value: `${repository.repositoryArn}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlSsh', { value: `${repository.repositoryCloneUrlSsh}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlHttp', { value: `${repository.repositoryCloneUrlHttp}` })
  }
}
