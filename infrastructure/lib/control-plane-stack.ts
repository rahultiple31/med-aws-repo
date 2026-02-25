import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { CognitoAuth, ControlPlane } from '@cdklabs/sbt-aws';
import { Construct } from 'constructs';

export interface SbtControlPlaneStackProps extends cdk.StackProps {
  readonly systemAdminEmail: string;
  readonly controlPlaneCallbackUrl?: string;
}

export class SbtControlPlaneStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly appSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly cacheSecurityGroup: ec2.SecurityGroup;
  public readonly tenantDirectoryTable: dynamodb.Table;
  public readonly controlPlaneApiUrl: string;
  public readonly controlPlaneEventBusArn: string;

  constructor(scope: Construct, id: string, props: SbtControlPlaneStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'SbtVpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.20.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.appSecurityGroup = new ec2.SecurityGroup(this, 'ApplicationPlaneSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Shared security group for workloads running in the application plane.',
    });

    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group attached to RDS PostgreSQL instances.',
    });

    this.cacheSecurityGroup = new ec2.SecurityGroup(this, 'MemcachedSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group attached to ElastiCache Memcached cluster.',
    });

    this.dbSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow application plane to access PostgreSQL'
    );
    this.cacheSecurityGroup.addIngressRule(
      this.appSecurityGroup,
      ec2.Port.tcp(11211),
      'Allow application plane to access Memcached'
    );

    const controlPlaneAuditLogGroup = new logs.LogGroup(this, 'ControlPlaneAuditLogGroup', {
      logGroupName: '/sbt/control-plane/audit',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const cognitoAuth = new CognitoAuth(this, 'SbtCognitoAuth', {
      controlPlaneCallbackURL: props.controlPlaneCallbackUrl ?? 'https://localhost',
      setAPIGWScopes: true,
    });

    const controlPlane = new ControlPlane(this, 'SbtControlPlane', {
      systemAdminEmail: props.systemAdminEmail,
      auth: cognitoAuth,
    });

    this.controlPlaneApiUrl = controlPlane.controlPlaneAPIGatewayUrl;
    this.controlPlaneEventBusArn = controlPlane.eventManager.busArn;

    this.tenantDirectoryTable = new dynamodb.Table(this, 'TenantDirectoryTable', {
      partitionKey: {
        name: 'tenantId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'recordType',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const tenantTableThrottleAlarm = new cloudwatch.Alarm(this, 'TenantTableThrottleAlarm', {
      metric: this.tenantDirectoryTable.metricThrottledRequestsForOperations({
        operations: [
          dynamodb.Operation.GET_ITEM,
          dynamodb.Operation.QUERY,
          dynamodb.Operation.SCAN,
          dynamodb.Operation.BATCH_GET_ITEM,
          dynamodb.Operation.PUT_ITEM,
          dynamodb.Operation.UPDATE_ITEM,
          dynamodb.Operation.DELETE_ITEM,
          dynamodb.Operation.BATCH_WRITE_ITEM,
        ],
        period: cdk.Duration.minutes(5),
        statistic: 'sum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Tenant directory table is throttling requests.',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const dashboard = new cloudwatch.Dashboard(this, 'ControlPlaneDashboard', {
      dashboardName: 'sbt-control-plane',
    });
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Tenant Directory Capacity',
        left: [
          this.tenantDirectoryTable.metricConsumedReadCapacityUnits(),
          this.tenantDirectoryTable.metricConsumedWriteCapacityUnits(),
        ],
      }),
      new cloudwatch.AlarmWidget({
        title: 'Critical Alarms',
        alarm: tenantTableThrottleAlarm,
      })
    );

    new cdk.CfnOutput(this, 'ControlPlaneApiUrl', {
      value: this.controlPlaneApiUrl,
    });
    new cdk.CfnOutput(this, 'ControlPlaneEventBusArn', {
      value: this.controlPlaneEventBusArn,
    });
    new cdk.CfnOutput(this, 'ControlPlaneUserPoolId', {
      value: cognitoAuth.userPool.userPoolId,
    });
    new cdk.CfnOutput(this, 'ControlPlaneUserClientId', {
      value: cognitoAuth.userClientId,
    });
    new cdk.CfnOutput(this, 'ControlPlaneWellKnownEndpoint', {
      value: cognitoAuth.wellKnownEndpointUrl,
    });
    new cdk.CfnOutput(this, 'TenantDirectoryTableName', {
      value: this.tenantDirectoryTable.tableName,
    });
    new cdk.CfnOutput(this, 'ControlPlaneAuditLogGroupName', {
      value: controlPlaneAuditLogGroup.logGroupName,
    });
    new cdk.CfnOutput(this, 'SharedVpcId', {
      value: this.vpc.vpcId,
    });
  }
}
