"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkStackALBEksBg = void 0;
const cdk = require("@aws-cdk/core");
const ec2 = require("@aws-cdk/aws-ec2");
const ecr = require("@aws-cdk/aws-ecr");
const eks = require("@aws-cdk/aws-eks");
const iam = require("@aws-cdk/aws-iam");
const codebuild = require("@aws-cdk/aws-codebuild");
const codecommit = require("@aws-cdk/aws-codecommit");
const targets = require("@aws-cdk/aws-events-targets");
const codepipeline = require("@aws-cdk/aws-codepipeline");
const codepipeline_actions = require("@aws-cdk/aws-codepipeline-actions");
class CdkStackALBEksBg extends cdk.Stack {
    constructor(scope, id, props) {
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
        controlPlaneSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Allow all inbound traffic by default");
        const cluster = new eks.Cluster(this, 'Cluster', {
            version: eks.KubernetesVersion.V1_21,
            securityGroup: controlPlaneSecurityGroup,
            vpc,
            mastersRole: clusterAdmin,
            outputClusterName: true,
        });
        cluster.addNodegroupCapacity('AppServer', {
          instanceTypes: [new ec2.InstanceType('m5.large')],
          minSize: 3,
          labels: {
            NodeType : 'AppServer'
          }
        });

        cluster.addNodegroupCapacity('PfServer', {
          instanceTypes: [new ec2.InstanceType('m5.large')],
          minSize: 2,
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
        });
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
        });
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
                }
            ],
        });
        repository.onCommit('OnCommit', {
            target: new targets.CodeBuildProject(project)
        });
        ecrRepo.grantPullPush(project.role);
        cluster.awsAuth.addMastersRole(project.role);
        project.addToRolePolicy(new iam.PolicyStatement({
            actions: ['eks:DescribeCluster'],
            resources: [`${cluster.clusterArn}`],
        }));
        ecrRepo.grantPullPush(project2.role);
        cluster.awsAuth.addMastersRole(project2.role);
        project2.addToRolePolicy(new iam.PolicyStatement({
            actions: ['eks:DescribeCluster'],
            resources: [`${cluster.clusterArn}`],
        }));
        new cdk.CfnOutput(this, 'CodeCommitRepoName', { value: `${repository.repositoryName}` });
        new cdk.CfnOutput(this, 'CodeCommitRepoArn', { value: `${repository.repositoryArn}` });
        new cdk.CfnOutput(this, 'CodeCommitCloneUrlSsh', { value: `${repository.repositoryCloneUrlSsh}` });
        new cdk.CfnOutput(this, 'CodeCommitCloneUrlHttp', { value: `${repository.repositoryCloneUrlHttp}` });
    }
}
exports.CdkStackALBEksBg = CdkStackALBEksBg;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY2RrLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLHFDQUFzQztBQUN0Qyx3Q0FBeUM7QUFDekMsd0NBQXlDO0FBQ3pDLHdDQUF5QztBQUN6Qyx3Q0FBeUM7QUFDekMsb0RBQXFEO0FBQ3JELHNEQUF1RDtBQUN2RCx1REFBd0Q7QUFDeEQsMERBQTJEO0FBQzNELDBFQUEyRTtBQUkzRSxNQUFhLGdCQUFpQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzdDLFlBQVksS0FBb0IsRUFBRSxFQUFVLEVBQUUsS0FBc0I7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEI7O1dBRUc7UUFDSCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRTtZQUN0QyxJQUFJLEVBQUUsYUFBYTtZQUNuQixXQUFXLEVBQUUsQ0FBQztTQUNmLENBQUMsQ0FBQztRQUVILE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ25ELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRTtTQUMxQyxDQUFDLENBQUM7UUFFSCxNQUFNLHlCQUF5QixHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzdFLEdBQUc7WUFDSCxnQkFBZ0IsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILHlCQUF5QixDQUFDLGNBQWMsQ0FDcEMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFDbEIsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQ2hCLHNDQUFzQyxDQUN6QyxDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLENBQUMsT0FB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QUssRUFBRSxHQUFHLFVBQVUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLENBQUMsQ0FBQTtJQUN0RyxDQUFDO0NBQ0Y7QUFuUUQsNENBbVFDIiwic291cmNlc0NvbnRlbnQiOlsiXG5pbXBvcnQgY2RrID0gcmVxdWlyZSgnQGF3cy1jZGsvY29yZScpO1xuaW1wb3J0IGVjMiA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1lYzInKTtcbmltcG9ydCBlY3IgPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtZWNyJyk7XG5pbXBvcnQgZWtzID0gcmVxdWlyZSgnQGF3cy1jZGsvYXdzLWVrcycpO1xuaW1wb3J0IGlhbSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1pYW0nKTtcbmltcG9ydCBjb2RlYnVpbGQgPSByZXF1aXJlKCdAYXdzLWNkay9hd3MtY29kZWJ1aWxkJyk7XG5pbXBvcnQgY29kZWNvbW1pdCA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jb2RlY29tbWl0Jyk7XG5pbXBvcnQgdGFyZ2V0cyA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1ldmVudHMtdGFyZ2V0cycpO1xuaW1wb3J0IGNvZGVwaXBlbGluZSA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUnKTtcbmltcG9ydCBjb2RlcGlwZWxpbmVfYWN0aW9ucyA9IHJlcXVpcmUoJ0Bhd3MtY2RrL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucycpO1xuXG5cblxuZXhwb3J0IGNsYXNzIENka1N0YWNrQUxCRWtzQmcgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogY2RrLkNvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFZQQyB3aXRoIHNpbmdsZSBOQVQgR2F0ZXdheVxuICAgICAqL1xuICAgIGNvbnN0IHZwYyA9IG5ldyBlYzIuVnBjKHRoaXMsICdOZXdWUEMnLCB7XG4gICAgICBjaWRyOiAnMTAuMC4wLjAvMTYnLFxuICAgICAgbmF0R2F0ZXdheXM6IDFcbiAgICB9KTtcblxuICAgIGNvbnN0IGNsdXN0ZXJBZG1pbiA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQWRtaW5Sb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkFjY291bnRSb290UHJpbmNpcGFsKClcbiAgICB9KTtcblxuICAgIGNvbnN0IGNvbnRyb2xQbGFuZVNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1NlY3VyaXR5R3JvdXAnLCB7XG4gICAgICB2cGMsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlXG4gICAgfSk7XG4gICAgXG4gICAgY29udHJvbFBsYW5lU2VjdXJpdHlHcm91cC5hZGRJbmdyZXNzUnVsZShcbiAgICAgICAgZWMyLlBlZXIuYW55SXB2NCgpLFxuICAgICAgICBlYzIuUG9ydC50Y3AoODApLFxuICAgICAgICBcIkFsbG93IGFsbCBpbmJvdW5kIHRyYWZmaWMgYnkgZGVmYXVsdFwiLFxuICAgICk7XG5cbiAgICBjb25zdCBjbHVzdGVyID0gbmV3IGVrcy5DbHVzdGVyKHRoaXMsICdDbHVzdGVyJywge1xuICAgICAgdmVyc2lvbjogZWtzLkt1YmVybmV0ZXNWZXJzaW9uLlYxXzIxLFxuICAgICAgc2VjdXJpdHlHcm91cDogY29udHJvbFBsYW5lU2VjdXJpdHlHcm91cCxcbiAgICAgIHZwYyxcbiAgICAgIGRlZmF1bHRDYXBhY2l0eTogMixcbiAgICAgIG1hc3RlcnNSb2xlOiBjbHVzdGVyQWRtaW4sXG4gICAgICBvdXRwdXRDbHVzdGVyTmFtZTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGVjclJlcG8gPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgJ0VjclJlcG8nKTtcblxuICAgIGNvbnN0IHJlcG9zaXRvcnkgPSBuZXcgY29kZWNvbW1pdC5SZXBvc2l0b3J5KHRoaXMsICdDb2RlQ29tbWl0UmVwbycsIHtcbiAgICAgIHJlcG9zaXRvcnlOYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tcmVwb2BcbiAgICB9KTtcblxuXG5cbiAgICAvLyBDT0RFQlVJTEQgLSBwcm9qZWN0XG4gICAgY29uc3QgcHJvamVjdCA9IG5ldyBjb2RlYnVpbGQuUHJvamVjdCh0aGlzLCAnTXlQcm9qZWN0Jywge1xuICAgICAgcHJvamVjdE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfWAsXG4gICAgICBzb3VyY2U6IGNvZGVidWlsZC5Tb3VyY2UuY29kZUNvbW1pdCh7IHJlcG9zaXRvcnkgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLmZyb21Bc3NldCh0aGlzLCAnQ3VzdG9tSW1hZ2UnLCB7XG4gICAgICAgICAgZGlyZWN0b3J5OiAnLi4vZG9ja2VyQXNzZXRzLmQnLFxuICAgICAgICB9KSxcbiAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZVxuICAgICAgfSxcbiAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICdDTFVTVEVSX05BTUUnOiB7XG4gICAgICAgICAgdmFsdWU6IGAke2NsdXN0ZXIuY2x1c3Rlck5hbWV9YFxuICAgICAgICB9LFxuICAgICAgICAnRUNSX1JFUE9fVVJJJzoge1xuICAgICAgICAgIHZhbHVlOiBgJHtlY3JSZXBvLnJlcG9zaXRvcnlVcml9YFxuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiBcIjAuMlwiLFxuICAgICAgICBwaGFzZXM6IHtcbiAgICAgICAgICBpbnN0YWxsOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBJbnN0YWxsaW5nIG52bS4uLicsXG4gICAgICAgICAgICAgIGBjdXJsIC1vLSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbnZtLXNoL252bS92MC4zOS4xL2luc3RhbGwuc2ggfCBiYXNoYCxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBOVk1fRElSPVwiJEhPTUUvLm52bVwiJyxcbiAgICAgICAgICAgICAgJ1sgLXMgXCIkTlZNX0RJUi9udm0uc2hcIiBdICYmIFxcLiBcIiROVk1fRElSL252bS5zaFwiJyxcbiAgICAgICAgICAgICAgJ1sgLXMgXCIkTlZNX0RJUi9iYXNoX2NvbXBsZXRpb25cIiBdICYmIFxcLiBcIiROVk1fRElSL2Jhc2hfY29tcGxldGlvblwiJyxcbiAgICAgICAgICAgICAgJy4gXCIkTlZNX0RJUi9udm0uc2hcIiAmJiBudm0gbHMtcmVtb3RlICYmIG52bSBpbnN0YWxsIDE2JyxcbiAgICAgICAgICAgICAgLy8nbnBtIGluc3RhbGwnXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlbnYnLFxuICAgICAgICAgICAgICAnZXhwb3J0IFRBRz0ke0NPREVCVUlMRF9SRVNPTFZFRF9TT1VSQ0VfVkVSU0lPTn0nLFxuICAgICAgICAgICAgICAnZXhwb3J0IEFXU19BQ0NPVU5UX0lEPSQoYXdzIHN0cyBnZXQtY2FsbGVyLWlkZW50aXR5IC0tcXVlcnkgQWNjb3VudCAtLW91dHB1dD10ZXh0KScsXG4gICAgICAgICAgICAgICcvdXNyL2xvY2FsL2Jpbi9lbnRyeXBvaW50LnNoJyxcbiAgICAgICAgICAgICAgJ2VjaG8gTG9nZ2luZyBpbiB0byBBbWF6b24gRUNSJyxcbiAgICAgICAgICAgICAgJ2F3cyBlY3IgZ2V0LWxvZ2luLXBhc3N3b3JkIC0tcmVnaW9uICRBV1NfREVGQVVMVF9SRUdJT04gfCBkb2NrZXIgbG9naW4gLS11c2VybmFtZSBBV1MgLS1wYXNzd29yZC1zdGRpbiAkQVdTX0FDQ09VTlRfSUQuZGtyLmVjci4kQVdTX0RFRkFVTFRfUkVHSU9OLmFtYXpvbmF3cy5jb20nXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2NkIGZsYXNrLWRvY2tlci1hcHAnLFxuICAgICAgICAgICAgICBgZG9ja2VyIGJ1aWxkIC10ICRFQ1JfUkVQT19VUkk6JFRBRyAuYCxcbiAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRFQ1JfUkVQT19VUkk6JFRBRydcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgIC8qJ2NkIGF3cy1la3MtZnJvbnRlbmQnLFxuICAgICAgICAgICAgICAnbGVybmEgcnVuIGJ1aWxkICYmIGxlcm5hIHJ1biBzeW50aCcsXG4gICAgICAgICAgICAgICducG0gcnVuIGJ1aWxkJyxcbiAgICAgICAgICAgICAgYGRvY2tlciBidWlsZCAtdCBkZW1vLWZyb250ZW5kIC5gLFxuICAgICAgICAgICAgICBgZG9ja2VyIHRhZyBkZW1vLWZyb250ZW5kOmxhdGVzdCAzMTI0MjI5ODUwMzAuZGtyLmVjci51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9kZW1vLWZyb250ZW5kOmxhdGVzdGAsKi9cbiAgICAgICAgICAgICAgJ2NkIGF3cy1la3MtZmxhc2snLFxuICAgICAgICAgICAgICBgZG9ja2VyIGJ1aWxkIC10IGRlbW8tZmxhc2stYmFja2VuZCAuYCxcbiAgICAgICAgICAgICAgYGRvY2tlciB0YWcgZGVtby1mbGFzay1iYWNrZW5kOmxhdGVzdCAzMTI0MjI5ODUwMzAuZGtyLmVjci51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9kZW1vLWZsYXNrLWJhY2tlbmQ6bGF0ZXN0YCxcbiAgICAgICAgICAgICAgYGRvY2tlciBpbWFnZXMgbHNgLFxuICAgICAgICAgICAgICAnZWNobyBMb2dnaW5nIGluIHRvIEFtYXpvbiBFQ1InLFxuICAgICAgICAgICAgICAnYXdzIGVjciBnZXQtbG9naW4tcGFzc3dvcmQgLS1yZWdpb24gJEFXU19ERUZBVUxUX1JFR0lPTiB8IGRvY2tlciBsb2dpbiAtLXVzZXJuYW1lIEFXUyAtLXBhc3N3b3JkLXN0ZGluICRBV1NfQUNDT1VOVF9JRC5ka3IuZWNyLiRBV1NfREVGQVVMVF9SRUdJT04uYW1hem9uYXdzLmNvbScsXG4gICAgICAgICAgICAgIGBkb2NrZXIgcHVzaCAzMTI0MjI5ODUwMzAuZGtyLmVjci51cy13ZXN0LTIuYW1hem9uYXdzLmNvbS9kZW1vLWZsYXNrLWJhY2tlbmQ6bGF0ZXN0YCxcbiAgICAgICAgICAgICAgLy9gZG9ja2VyIHB1c2ggMzEyNDIyOTg1MDMwLmRrci5lY3IudXMtd2VzdC0yLmFtYXpvbmF3cy5jb20vZGVtby1mcm9udGVuZDpsYXRlc3RgLFxuICAgICAgICAgICAgICAnY2QgazhzLW1hbmlmZXN0cycsXG4gICAgICAgICAgICAgICdrdWJlY3RsIGFwcGx5IC1mIGZyb250ZW5kLWRlcGxveW1lbnQueWFtbCcsXG4gICAgICAgICAgICAgICdrdWJlY3RsIGFwcGx5IC1mIGZyb250ZW5kLXNlcnZpY2UueWFtbCcsXG4gICAgICAgICAgICAgICdjZCAuLi8uLi9hd3MtZWtzLWZsYXNrL2s4cy1tYW5pZmVzdHMnLFxuICAgICAgICAgICAgICAna3ViZWN0bCBhcHBseSAtZiBmbGFzay1kZXBsb3ltZW50LnlhbWwnLFxuICAgICAgICAgICAgICAna3ViZWN0bCBhcHBseSAtZiBmbGFzay1zZXJ2aWNlLnlhbWwnLFxuICAgICAgICAgICAgICAna3ViZWN0bCBhcHBseSAtZiBub2RlanMtZGVwbG95bWVudC55YW1sJyxcbiAgICAgICAgICAgICAgJ2t1YmVjdGwgYXBwbHkgLWYgbm9kZWpzLXNlcnZpY2UueWFtbCcsXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG5cblxuXG5cbiAgICAvLyBDT0RFQlVJTEQgLSBwcm9qZWN0MlxuICAgIGNvbnN0IHByb2plY3QyID0gbmV3IGNvZGVidWlsZC5Qcm9qZWN0KHRoaXMsICdNeVByb2plY3QyJywge1xuICAgICAgcHJvamVjdE5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfTJgLFxuICAgICAgc291cmNlOiBjb2RlYnVpbGQuU291cmNlLmNvZGVDb21taXQoeyByZXBvc2l0b3J5IH0pLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5mcm9tQXNzZXQodGhpcywgJ0N1c3RvbUltYWdlMicsIHtcbiAgICAgICAgICBkaXJlY3Rvcnk6ICcuLi9kb2NrZXJBc3NldHMuZCcsXG4gICAgICAgIH0pLFxuICAgICAgICBwcml2aWxlZ2VkOiB0cnVlXG4gICAgICB9LFxuICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgJ0NMVVNURVJfTkFNRSc6IHtcbiAgICAgICAgICB2YWx1ZTogYCR7Y2x1c3Rlci5jbHVzdGVyTmFtZX1gXG4gICAgICAgIH0sXG4gICAgICAgICdFQ1JfUkVQT19VUkknOiB7XG4gICAgICAgICAgdmFsdWU6IGAke2VjclJlcG8ucmVwb3NpdG9yeVVyaX1gXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgIHZlcnNpb246IFwiMC4yXCIsXG4gICAgICAgIHBoYXNlczoge1xuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VudicsXG4gICAgICAgICAgICAgICdleHBvcnQgVEFHPSR7Q09ERUJVSUxEX1JFU09MVkVEX1NPVVJDRV9WRVJTSU9OfScsXG4gICAgICAgICAgICAgICcvdXNyL2xvY2FsL2Jpbi9lbnRyeXBvaW50LnNoJ1xuICAgICAgICAgICAgXVxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdjZCBmbGFzay1kb2NrZXItYXBwJyxcbiAgICAgICAgICAgICAgJ2VjaG8gXCJEdW1teSBBY3Rpb25cIidcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdrdWJlY3RsIGdldCBub2RlcyAtbiBmbGFzay1hbGInLFxuICAgICAgICAgICAgICAna3ViZWN0bCBnZXQgZGVwbG95IC1uIGZsYXNrLWFsYicsXG4gICAgICAgICAgICAgICdrdWJlY3RsIGdldCBzdmMgLW4gZmxhc2stYWxiJyxcbiAgICAgICAgICAgICAgXCJkZXBsb3k4MDgwPSQoa3ViZWN0bCBnZXQgc3ZjIC1uIGZsYXNrLWFsYiAtbyB3aWRlIHwgZ3JlcCAnIDgwODA6JyB8IHRyICcgJyAnXFxuJyB8IGdyZXAgYXBwPSB8IHNlZCAncy9hcHA9Ly9nJylcIixcbiAgICAgICAgICAgICAgXCJkZXBsb3k4MD0kKGt1YmVjdGwgZ2V0IHN2YyAtbiBmbGFzay1hbGIgLW8gd2lkZSB8IGdyZXAgJyA4MDonIHwgdHIgJyAnICdcXG4nIHwgZ3JlcCBhcHA9IHwgc2VkICdzL2FwcD0vL2cnKVwiLFxuICAgICAgICAgICAgICBcImVjaG8gJGRlcGxveTgwICRkZXBsb3k4MDgwXCIsXG4gICAgICAgICAgICAgIFwia3ViZWN0bCBwYXRjaCBzdmMgZmxhc2stc3ZjLWFsYi1ibHVlIC1uIGZsYXNrLWFsYiAtcCAne1xcXCJzcGVjXFxcIjp7XFxcInNlbGVjdG9yXFxcIjoge1xcXCJhcHBcXFwiOiBcXFwiJyRkZXBsb3k4MDgwJ1xcXCJ9fX0nXCIsXG4gICAgICAgICAgICAgIFwia3ViZWN0bCBwYXRjaCBzdmMgZmxhc2stc3ZjLWFsYi1ncmVlbiAtbiBmbGFzay1hbGIgLXAgJ3tcXFwic3BlY1xcXCI6e1xcXCJzZWxlY3RvclxcXCI6IHtcXFwiYXBwXFxcIjogXFxcIickZGVwbG95ODAnXFxcIn19fSdcIixcbiAgICAgICAgICAgICAgJ2t1YmVjdGwgZ2V0IGRlcGxveSAtbiBmbGFzay1hbGInLFxuICAgICAgICAgICAgICAna3ViZWN0bCBnZXQgc3ZjIC1uIGZsYXNrLWFsYidcbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcblxuXG5cblxuXG4gICAgLy8gUElQRUxJTkVcblxuICAgIGNvbnN0IHNvdXJjZU91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKTtcblxuICAgIGNvbnN0IHNvdXJjZUFjdGlvbiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQ29tbWl0U291cmNlQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdDb2RlQ29tbWl0JyxcbiAgICAgIHJlcG9zaXRvcnksXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICB9KTtcblxuICAgIGNvbnN0IGJ1aWxkQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnQ29kZUJ1aWxkJyxcbiAgICAgIHByb2plY3Q6IHByb2plY3QsXG4gICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgb3V0cHV0czogW25ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoKV0sIC8vIG9wdGlvbmFsXG4gICAgfSk7XG5cblxuICAgIGNvbnN0IGJ1aWxkQWN0aW9uMiA9IG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ0NvZGVCdWlsZCcsXG4gICAgICBwcm9qZWN0OiBwcm9qZWN0MixcbiAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgfSk7XG5cblxuICAgIGNvbnN0IG1hbnVhbEFwcHJvdmFsQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLk1hbnVhbEFwcHJvdmFsQWN0aW9uKHtcbiAgICAgIGFjdGlvbk5hbWU6ICdBcHByb3ZlJyxcbiAgICB9KTtcblxuXG5cbiAgICBuZXcgY29kZXBpcGVsaW5lLlBpcGVsaW5lKHRoaXMsICdNeVBpcGVsaW5lJywge1xuICAgICAgc3RhZ2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdTb3VyY2UnLFxuICAgICAgICAgIGFjdGlvbnM6IFtzb3VyY2VBY3Rpb25dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnQnVpbGRBbmREZXBsb3knLFxuICAgICAgICAgIGFjdGlvbnM6IFtidWlsZEFjdGlvbl0sXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzdGFnZU5hbWU6ICdBcHByb3ZlU3dhcEJHJyxcbiAgICAgICAgICBhY3Rpb25zOiBbbWFudWFsQXBwcm92YWxBY3Rpb25dLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3RhZ2VOYW1lOiAnU3dhcEJHJyxcbiAgICAgICAgICBhY3Rpb25zOiBbYnVpbGRBY3Rpb24yXSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cblxuICAgIHJlcG9zaXRvcnkub25Db21taXQoJ09uQ29tbWl0Jywge1xuICAgICAgdGFyZ2V0OiBuZXcgdGFyZ2V0cy5Db2RlQnVpbGRQcm9qZWN0KHByb2plY3QpXG4gICAgfSk7XG5cbiAgICBlY3JSZXBvLmdyYW50UHVsbFB1c2gocHJvamVjdC5yb2xlISlcbiAgICBjbHVzdGVyLmF3c0F1dGguYWRkTWFzdGVyc1JvbGUocHJvamVjdC5yb2xlISlcbiAgICBwcm9qZWN0LmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2VrczpEZXNjcmliZUNsdXN0ZXInXSxcbiAgICAgIHJlc291cmNlczogW2Ake2NsdXN0ZXIuY2x1c3RlckFybn1gXSxcbiAgICB9KSlcblxuXG4gICAgZWNyUmVwby5ncmFudFB1bGxQdXNoKHByb2plY3QyLnJvbGUhKVxuICAgIGNsdXN0ZXIuYXdzQXV0aC5hZGRNYXN0ZXJzUm9sZShwcm9qZWN0Mi5yb2xlISlcbiAgICBwcm9qZWN0Mi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydla3M6RGVzY3JpYmVDbHVzdGVyJ10sXG4gICAgICByZXNvdXJjZXM6IFtgJHtjbHVzdGVyLmNsdXN0ZXJBcm59YF0sXG4gICAgfSkpXG5cblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2RlQ29tbWl0UmVwb05hbWUnLCB7IHZhbHVlOiBgJHtyZXBvc2l0b3J5LnJlcG9zaXRvcnlOYW1lfWAgfSlcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ29kZUNvbW1pdFJlcG9Bcm4nLCB7IHZhbHVlOiBgJHtyZXBvc2l0b3J5LnJlcG9zaXRvcnlBcm59YCB9KVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDb2RlQ29tbWl0Q2xvbmVVcmxTc2gnLCB7IHZhbHVlOiBgJHtyZXBvc2l0b3J5LnJlcG9zaXRvcnlDbG9uZVVybFNzaH1gIH0pXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvZGVDb21taXRDbG9uZVVybEh0dHAnLCB7IHZhbHVlOiBgJHtyZXBvc2l0b3J5LnJlcG9zaXRvcnlDbG9uZVVybEh0dHB9YCB9KVxuICB9XG59XG4iXX0=
