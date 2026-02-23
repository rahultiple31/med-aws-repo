# SaaS Builder Toolkit Infrastructure (CDK TypeScript)

This folder contains enterprise-ready AWS CDK stacks for a control plane and application plane aligned with SaaS Builder Toolkit patterns.

## Stacks

- `SbtControlPlaneStack`
  - Amazon Cognito (via SBT `CognitoAuth`)
  - SBT Control Plane APIs and event bus
  - Shared VPC and security groups
  - Amazon DynamoDB (tenant directory)
  - Amazon CloudWatch dashboard and alarms

- `SbtApplicationPlaneStack`
  - Amazon EKS (application deployment target)
  - New Relic Helm bundle for EKS monitoring
  - Amazon RDS MySQL
  - Amazon ElastiCache Memcached
  - Amazon DynamoDB (application data)
  - Amazon CloudWatch log groups and alarms

- `SbtCiCdPipelineStack`
  - AWS CodePipeline
  - AWS CodeBuild (build image + push to ECR)
  - ECR repository for application images
  - AWS CodeBuild deploy stage for Amazon EKS rollout

## Required Context / Environment

Provide these values during synth/deploy:

- `systemAdminEmail` (required)
- `codestarConnectionArn` (required for GitHub source stage)
- `githubOwner` (default: `rahultiple31`)
- `githubRepo` (default: `cdk-web`)
- `githubBranch` (default: `main`)
- `newRelicLicenseKey` (default placeholder if omitted)

Equivalent environment variables:

- `SBT_SYSTEM_ADMIN_EMAIL`
- `CODESTAR_CONNECTION_ARN`
- `NEW_RELIC_LICENSE_KEY`

## Commands

```bash
npm install
npm run synth -- -c systemAdminEmail=admin@example.com -c codestarConnectionArn=arn:aws:codestar-connections:REGION:ACCOUNT:connection/ID
npm run deploy -- -c systemAdminEmail=admin@example.com -c codestarConnectionArn=arn:aws:codestar-connections:REGION:ACCOUNT:connection/ID
```
