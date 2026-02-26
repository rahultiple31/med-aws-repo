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
  - Amazon RDS PostgreSQL
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
- `githubOwner` (default: `rahultiple31`)
- `githubRepo` (default: `cdk-web`)
- `githubBranch` (default: `main`)
- `sourceArtifactObjectKey` (default: `source.zip`)

Equivalent environment variables:

- `SBT_SYSTEM_ADMIN_EMAIL`

## Commands

```bash
npm install
npm run synth -- -c systemAdminEmail=admin@example.com
npm run deploy -- -c systemAdminEmail=admin@example.com
```

## Pipeline Source (S3)

`SbtCiCdPipelineStack` now uses Amazon S3 as the CodePipeline source.

- Upload a source zip (`source.zip` by default) to the output bucket/key:
  - `SourceArtifactBucketName`
  - `SourceArtifactObjectKey`
- The pipeline source stage polls this S3 object for changes.
