import * as cdk from 'aws-cdk-lib';
import { SbtApplicationPlaneStack } from '../lib/application-plane-stack';
import { SbtCiCdPipelineStack } from '../lib/cicd-pipeline-stack';
import { SbtControlPlaneStack } from '../lib/control-plane-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'ca-central-1',
};

const systemAdminEmail =
  app.node.tryGetContext('systemAdminEmail') ?? process.env.SBT_SYSTEM_ADMIN_EMAIL;
if (!systemAdminEmail) {
  throw new Error(
    'Missing systemAdminEmail. Pass "-c systemAdminEmail=<email>" or set SBT_SYSTEM_ADMIN_EMAIL.'
  );
}

const githubOwner = app.node.tryGetContext('githubOwner') ?? 'rahultiple31';
const githubRepo = app.node.tryGetContext('githubRepo') ?? 'cdk-web';
const githubBranch = app.node.tryGetContext('githubBranch') ?? 'main';
const eksClusterName = app.node.tryGetContext('eksClusterName') ?? 'sbt-application-eks';
const sourceArtifactObjectKey = app.node.tryGetContext('sourceArtifactObjectKey') ?? 'source.zip';

const controlPlaneStack = new SbtControlPlaneStack(app, 'SbtControlPlaneStack', {
  env,
  systemAdminEmail,
  controlPlaneCallbackUrl:
    app.node.tryGetContext('controlPlaneCallbackUrl') ?? 'https://admin.example.com/callback',
});

const applicationPlaneStack = new SbtApplicationPlaneStack(app, 'SbtApplicationPlaneStack', {
  env,
  vpc: controlPlaneStack.vpc,
  appSecurityGroup: controlPlaneStack.appSecurityGroup,
  dbSecurityGroup: controlPlaneStack.dbSecurityGroup,
  cacheSecurityGroup: controlPlaneStack.cacheSecurityGroup,
  eksClusterName,
});
applicationPlaneStack.addDependency(controlPlaneStack);

const cicdPipelineStack = new SbtCiCdPipelineStack(app, 'SbtCiCdPipelineStack', {
  env,
  eksClusterName: applicationPlaneStack.cluster.clusterName,
  eksDeployRoleArn: applicationPlaneStack.eksDeploymentRole.roleArn,
  postgresEndpointAddress: applicationPlaneStack.postgresDatabase.dbInstanceEndpointAddress,
  memcachedConfigurationEndpoint: `${applicationPlaneStack.memcachedCluster.attrConfigurationEndpointAddress}:${applicationPlaneStack.memcachedCluster.attrConfigurationEndpointPort}`,
  applicationDataTableName: applicationPlaneStack.applicationDataTable.tableName,
  githubOwner,
  githubRepo,
  githubBranch,
  sourceArtifactObjectKey,
});
cicdPipelineStack.addDependency(applicationPlaneStack);
