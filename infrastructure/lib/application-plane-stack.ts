import { KubectlV34Layer } from '@aws-cdk/lambda-layer-kubectl-v34';
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export interface SbtApplicationPlaneStackProps extends cdk.StackProps {
  readonly vpc: ec2.IVpc;
  readonly appSecurityGroup: ec2.ISecurityGroup;
  readonly dbSecurityGroup: ec2.ISecurityGroup;
  readonly cacheSecurityGroup: ec2.ISecurityGroup;
  readonly eksClusterName?: string;
}

export class SbtApplicationPlaneStack extends cdk.Stack {
  public readonly cluster: eks.Cluster;
  public readonly applicationDataTable: dynamodb.Table;
  public readonly postgresDatabase: rds.DatabaseInstance;
  public readonly memcachedCluster: elasticache.CfnCacheCluster;
  public readonly eksDeploymentRole: iam.Role;

  constructor(scope: Construct, id: string, props: SbtApplicationPlaneStackProps) {
    super(scope, id, props);

    const postgresEngineVersion = rds.PostgresEngineVersion.of('17.6-R2', '17');
    const postgresInstanceType = ec2.InstanceType.of(ec2.InstanceClass.M5, ec2.InstanceSize.LARGE);

    const clusterAdmin = new iam.Role(this, 'EksClusterAdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
    });

    const clusterControlPlaneSecurityGroup = new ec2.SecurityGroup(
      this,
      'EksControlPlaneSecurityGroup',
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security group for EKS control plane traffic.',
      }
    );

    this.cluster = new eks.Cluster(this, 'ApplicationPlaneEksCluster', {
      clusterName: props.eksClusterName ?? 'sbt-application-eks',
      version: eks.KubernetesVersion.V1_34,
      vpc: props.vpc,
      vpcSubnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
      defaultCapacity: 0,
      mastersRole: clusterAdmin,
      securityGroup: clusterControlPlaneSecurityGroup,
      kubectlLayer: new KubectlV34Layer(this, 'KubectlLayer'),
      clusterLogging: [
        eks.ClusterLoggingTypes.API,
        eks.ClusterLoggingTypes.AUDIT,
        eks.ClusterLoggingTypes.AUTHENTICATOR,
      ],
    });

    this.cluster.addNodegroupCapacity('ApplicationPlaneNodeGroup', {
      desiredSize: 1,
      minSize: 1,
      maxSize: 2,
      amiType: eks.NodegroupAmiType.AL2023_X86_64_STANDARD,
      instanceTypes: [new ec2.InstanceType('m6i.large')],
      diskSize: 80,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      capacityType: eks.CapacityType.ON_DEMAND,
    });

    this.eksDeploymentRole = new iam.Role(this, 'EksDeploymentCodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      description: 'Role used by CodeBuild deploy stage to apply manifests to EKS.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSCodeBuildServiceRole'),
      ],
    });
    this.eksDeploymentRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['eks:DescribeCluster'],
        resources: [this.cluster.clusterArn],
      })
    );
    this.cluster.awsAuth.addMastersRole(this.eksDeploymentRole);

    this.cluster.addManifest('SbtAppNamespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: 'sbt-app',
      },
    });

    props.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow workloads in VPC to connect to RDS PostgreSQL 17.6-R2'
    );
    props.cacheSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(11211),
      'Allow workloads in VPC to connect to Memcached'
    );

    const postgresCredentialsSecret = new rds.DatabaseSecret(this, 'PostgresCredentials', {
      username: 'sbt_admin',
    });

    this.postgresDatabase = new rds.DatabaseInstance(this, 'ApplicationPostgresDatabase', {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      engine: rds.DatabaseInstanceEngine.postgres({
        version: postgresEngineVersion,
      }),
      credentials: rds.Credentials.fromSecret(postgresCredentialsSecret),
      securityGroups: [props.dbSecurityGroup],
      multiAz: true,
      instanceType: postgresInstanceType,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      monitoringInterval: cdk.Duration.minutes(1),
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      databaseName: 'applicationdb',
    });

    const memcachedSubnetGroup = new elasticache.CfnSubnetGroup(this, 'MemcachedSubnetGroup', {
      description: 'Subnets used by the application plane Memcached cluster.',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
    });

    this.memcachedCluster = new elasticache.CfnCacheCluster(this, 'MemcachedCluster', {
      engine: 'memcached',
      cacheNodeType: 'cache.t3.small',
      numCacheNodes: 2,
      port: 11211,
      azMode: 'cross-az',
      cacheSubnetGroupName: memcachedSubnetGroup.ref,
      vpcSecurityGroupIds: [props.cacheSecurityGroup.securityGroupId],
    });
    this.memcachedCluster.addDependency(memcachedSubnetGroup);

    this.applicationDataTable = new dynamodb.Table(this, 'ApplicationDataTable', {
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'entityId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const applicationLogGroup = new logs.LogGroup(this, 'ApplicationPlaneLogGroup', {
      logGroupName: '/sbt/application-plane/platform',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cloudwatch.Alarm(this, 'RdsCpuHighAlarm', {
      metric: this.postgresDatabase.metricCPUUtilization({
        period: cdk.Duration.minutes(5),
      }),
      threshold: 75,
      evaluationPeriods: 2,
      alarmDescription: 'RDS PostgreSQL CPU is high in the application plane.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'MemcachedCpuHighAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ElastiCache',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          CacheClusterId: this.memcachedCluster.ref,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Average',
      }),
      threshold: 80,
      evaluationPeriods: 2,
      alarmDescription: 'Memcached CPU utilization is above enterprise threshold.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'EksFailedNodesAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EKS',
        metricName: 'cluster_failed_node_count',
        dimensionsMap: {
          ClusterName: this.cluster.clusterName,
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'The EKS cluster reports failed nodes.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.CfnOutput(this, 'EksClusterName', {
      value: this.cluster.clusterName,
    });
    new cdk.CfnOutput(this, 'EksClusterSecurityGroupId', {
      value: clusterControlPlaneSecurityGroup.securityGroupId,
    });
    new cdk.CfnOutput(this, 'PostgresEndpointAddress', {
      value: this.postgresDatabase.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'PostgresEngineVersion', {
      value: '17.6-R2',
    });
    new cdk.CfnOutput(this, 'PostgresInstanceType', {
      value: 'db.m5.large',
    });
    new cdk.CfnOutput(this, 'MemcachedConfigurationEndpoint', {
      value: `${this.memcachedCluster.attrConfigurationEndpointAddress}:${this.memcachedCluster.attrConfigurationEndpointPort}`,
    });
    new cdk.CfnOutput(this, 'MemcachedClusterId', {
      value: this.memcachedCluster.ref,
    });
    new cdk.CfnOutput(this, 'ApplicationDataTableName', {
      value: this.applicationDataTable.tableName,
    });
    new cdk.CfnOutput(this, 'ApplicationPlaneLogGroupName', {
      value: applicationLogGroup.logGroupName,
    });
    new cdk.CfnOutput(this, 'EksDeploymentRoleArn', {
      value: this.eksDeploymentRole.roleArn,
    });
  }
}
