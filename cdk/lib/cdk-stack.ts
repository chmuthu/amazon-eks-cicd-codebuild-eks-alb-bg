
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
      defaultCapacity: 0,
      mastersRole: clusterAdmin,
      outputClusterName: true,
    });
    
    cluster.addNodegroupCapacity('AppServer', {
      instanceTypes: [new ec2.InstanceType('m5.large')],
      minSize: 3,
      maxSize: 6,
      labels: {
        NodeType : 'AppServer'
      }
    });
    
    cluster.addNodegroupCapacity('PfServer', {
      instanceTypes: [new ec2.InstanceType('m5.large')],
      minSize: 4,
      maxSize: 4,
      labels: {
        NodeType : 'PfServer'
      }
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
              /*'cd flask-docker-app',
              `docker build -t $ECR_REPO_URI:$TAG .`,
              'docker push $ECR_REPO_URI:$TAG'*/
            ]
          },
          post_build: {
            commands: [
              'cd aws-eks-frontend/k8s-manifest',
              "isFrontendDeployed=$(kubectl get deploy demo-frontend -o json | jq '.items[0]')",
              
              "echo $isFrontendDeployed",
              
              "if [[ \"$isFrontendDeployed\" == \"null\" ]]; then kubectl delete deployment demo-frontend; fi",
              
              'cd ../../aws-eks-flask',
              `docker build -t demo-flask-backend .`,
              `docker tag demo-flask-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/demo-flask-backend:latest`,
              `docker images ls`,
              `docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/demo-flask-backend:latest`,
              'cd k8s-manifest',
              
              "isFlaskDeployed=$(kubectl get deployments demo-flask-backend -o json | jq '.items[0]')",
              "if [[ \"$isFlaskDeployed\" == \"null\" ]]; then kubectl delete deployment demo-flask-backend; fi",
              
              "echo $isFlaskDeployed",
              
              'kubectl apply -f flask-deployment.yaml',
              
              "isNodeJsDeployed=$(kubectl get deployments demo-nodejs-backend -o json | jq '.items[0]')",
              "if [[ \"$isNodeJsDeployed\" == \"null\" ]]; then kubectl delete deployment demo-nodejs-backend; fi",
              
              "echo $isNodeJsDeployed",
              'kubectl apply -f nodejs-deployment.yaml',
              
              'cd ../../aws-eks-frontend/k8s-manifest',
              'kubectl apply -f frontend-deployment.yaml',
              
              "isHpaDeployed=$(kubectl get hpa -o json | jq '.items[0]')",
              "echo $isHpaDeployed",
              "if [[ \"$isHpaDeployed\" == \"null\" ]]; then kubectl autoscale deployment demo-nodejs-backend --cpu-percent=70 --min=3 --max=10 && kubectl autoscale deployment demo-flask-backend --cpu-percent=70 --min=3 --max=10 && kubectl autoscale deployment demo-frontend --cpu-percent=70 --min=3 --max=10; fi",
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

    new cdk.CfnOutput(this, 'CodeCommitRepoName', { value: `${repository.repositoryName}` })
    new cdk.CfnOutput(this, 'CodeCommitRepoArn', { value: `${repository.repositoryArn}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlSsh', { value: `${repository.repositoryCloneUrlSsh}` })
    new cdk.CfnOutput(this, 'CodeCommitCloneUrlHttp', { value: `${repository.repositoryCloneUrlHttp}` })
  }
}
