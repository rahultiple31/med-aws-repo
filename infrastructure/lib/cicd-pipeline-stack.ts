import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface SbtCiCdPipelineStackProps extends cdk.StackProps {
  readonly eksClusterName: string;
  readonly eksDeployRoleArn: string;
  readonly postgresEndpointAddress: string;
  readonly memcachedConfigurationEndpoint: string;
  readonly applicationDataTableName: string;
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch: string;
  readonly sourceArtifactObjectKey?: string;
}

export class SbtCiCdPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SbtCiCdPipelineStackProps) {
    super(scope, id, props);

    const artifactBucket = new s3.Bucket(this, 'PipelineArtifactBucket', {
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    const sourceArtifactObjectKey = props.sourceArtifactObjectKey ?? 'source.zip';

    const containerRepository = new ecr.Repository(this, 'ApplicationEcrRepository', {
      repositoryName: `${props.githubRepo}-app`,
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
    });

    const buildProject = new codebuild.PipelineProject(this, 'SbtCodeBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('codebuild-codedeploy/buildspec.yml'),
      environmentVariables: {
        ECR_REPOSITORY_URI: { value: containerRepository.repositoryUri },
        POSTGRES_ENDPOINT: { value: props.postgresEndpointAddress },
        MEMCACHED_ENDPOINT: { value: props.memcachedConfigurationEndpoint },
        DYNAMODB_TABLE_NAME: { value: props.applicationDataTableName },
      },
    });
    containerRepository.grantPullPush(buildProject);
    buildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    const eksDeploymentRole = iam.Role.fromRoleArn(
      this,
      'ImportedEksDeploymentCodeBuildRole',
      props.eksDeployRoleArn
    );

    const deployProject = new codebuild.PipelineProject(this, 'SbtEksDeployProject', {
      role: eksDeploymentRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('deployspec.yml'),
      environmentVariables: {
        EKS_CLUSTER_NAME: { value: props.eksClusterName },
        AWS_DEFAULT_REGION: { value: cdk.Stack.of(this).region },
      },
    });

    const sourceOutput = new codepipeline.Artifact('SourceArtifact');
    const buildOutput = new codepipeline.Artifact('BuildArtifact');

    const pipeline = new codepipeline.Pipeline(this, 'SbtEnterpriseCodePipeline', {
      pipelineType: codepipeline.PipelineType.V2,
      crossAccountKeys: false,
      artifactBucket,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new actions.S3SourceAction({
          actionName: 'S3Source',
          bucket: artifactBucket,
          bucketKey: sourceArtifactObjectKey,
          output: sourceOutput,
          trigger: actions.S3Trigger.POLL,
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CodeBuildPackage',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new actions.CodeBuildAction({
          actionName: 'CodeDeployToEks',
          project: deployProject,
          input: buildOutput,
        }),
      ],
    });

    new cdk.CfnOutput(this, 'CodePipelineName', {
      value: pipeline.pipelineName,
    });
    new cdk.CfnOutput(this, 'CodeBuildProjectName', {
      value: buildProject.projectName,
    });
    new cdk.CfnOutput(this, 'CodeDeployProjectName', {
      value: deployProject.projectName,
    });
    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: containerRepository.repositoryUri,
    });
    new cdk.CfnOutput(this, 'SourceArtifactBucketName', {
      value: artifactBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'SourceArtifactObjectKey', {
      value: sourceArtifactObjectKey,
    });
  }
}
