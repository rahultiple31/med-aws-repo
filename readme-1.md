## CI/CD Flow (Compact + Detailed)

```mermaid
flowchart LR
  A[GitHub: push/merge to main] --> B[Webhook]
  B --> C[CodePipeline Source]
  C --> D[CodeBuild Build]
  D --> D1[npm ci + build + test]
  D1 --> D2[docker build]
  D2 --> D3[push image to ECR]
  D3 --> D4[render k8s yaml<br/>RDS/Memcached/DynamoDB]
  D4 --> E[CodeBuild Deploy]
  E --> E1[kubectl install + kubeconfig]
  E1 --> E2[kubectl apply<br/>ns/service/deploy/hpa/ingress]
  E2 --> E3[rollout status: cdk-web]
  E3 --> F{Success?}
  F -->|Yes| G[App live on EKS]
  F -->|No| H[Fail: check Pipeline/Build logs]
```


## policy
Policy name: sbt-cdk.json
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AssumeCdkBootstrapRoles",
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Resource": [
                "arn:aws:iam::658688924729:role/cdk-gha659fds-deploy-role-658688924729-ca-central-1",
                "arn:aws:iam::658688924729:role/cdk-gha659fds-file-publishing-role-658688924729-ca-central-1",
                "arn:aws:iam::658688924729:role/cdk-gha659fds-image-publishing-role-658688924729-ca-central-1",
                "arn:aws:iam::658688924729:role/cdk-gha659fds-lookup-role-658688924729-ca-central-1"
            ]
        },
        {
            "Sid": "ReadCdkBootstrapMetadata",
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "cloudformation:DescribeStacks",
                "cloudformation:ListStackResources"
            ],
            "Resource": [
                "arn:aws:ssm:ca-central-1:658688924729:parameter/cdk-bootstrap/gha659fds/version",
                "arn:aws:cloudformation:ca-central-1:658688924729:stack/CDKToolkit/*"
            ]
        },
        {
            "Sid": "CloudFormationDeployAccess",
            "Effect": "Allow",
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:UpdateStack",
                "cloudformation:DeleteStack",
                "cloudformation:CreateChangeSet",
                "cloudformation:DeleteChangeSet",
                "cloudformation:ExecuteChangeSet",
                "cloudformation:SetStackPolicy",
                "cloudformation:ValidateTemplate",
                "cloudformation:Describe*",
                "cloudformation:Get*",
                "cloudformation:List*",
                "cloudformation:TagResource",
                "cloudformation:UntagResource"
            ],
            "Resource": "*"
        },
        {
            "Sid": "IamForCdkAndWorkloadsNoPassRole",
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:DeleteRole",
                "iam:GetRole",
                "iam:UpdateRole",
                "iam:UpdateAssumeRolePolicy",
                "iam:TagRole",
                "iam:UntagRole",
                "iam:PutRolePolicy",
                "iam:DeleteRolePolicy",
                "iam:GetRolePolicy",
                "iam:ListRolePolicies",
                "iam:AttachRolePolicy",
                "iam:DetachRolePolicy",
                "iam:ListAttachedRolePolicies",
                "iam:CreatePolicy",
                "iam:DeletePolicy",
                "iam:GetPolicy",
                "iam:GetPolicyVersion",
                "iam:ListPolicyVersions",
                "iam:CreatePolicyVersion",
                "iam:DeletePolicyVersion",
                "iam:TagPolicy",
                "iam:UntagPolicy",
                "iam:CreateInstanceProfile",
                "iam:DeleteInstanceProfile",
                "iam:AddRoleToInstanceProfile",
                "iam:RemoveRoleFromInstanceProfile",
                "iam:GetInstanceProfile",
                "iam:TagInstanceProfile",
                "iam:UntagInstanceProfile",
                "iam:ListInstanceProfilesForRole",
                "iam:CreateServiceLinkedRole"
            ],
            "Resource": "*"
        },
        {
            "Sid": "PassRoleRestricted",
            "Effect": "Allow",
            "Action": "iam:PassRole",
            "Resource": [
                "arn:aws:iam::658688924729:role/cdk-gha659fds-*",
                "arn:aws:iam::658688924729:role/Dev*",
                "arn:aws:iam::658688924729:role/*CodeBuild*",
                "arn:aws:iam::658688924729:role/*CodePipeline*",
                "arn:aws:iam::658688924729:role/*Eks*",
                "arn:aws:iam::658688924729:role/*Nodegroup*",
                "arn:aws:iam::658688924729:role/*Lambda*"
            ],
            "Condition": {
                "StringEquals": {
                    "iam:PassedToService": [
                        "cloudformation.amazonaws.com",
                        "codebuild.amazonaws.com",
                        "codepipeline.amazonaws.com",
                        "eks.amazonaws.com",
                        "ec2.amazonaws.com",
                        "lambda.amazonaws.com"
                    ]
                }
            }
        },
        {
            "Sid": "ApplicationAndPlatformServices",
            "Effect": "Allow",
            "Action": [
                "ec2:*",
                "eks:*",
                "autoscaling:*",
                "elasticloadbalancing:*",
                "rds:*",
                "elasticache:*",
                "dynamodb:*",
                "secretsmanager:*",
                "cognito-idp:*",
                "events:*",
                "apigateway:*",
                "lambda:*",
                "kms:*",
                "ssm:*",
                "logs:*",
                "cloudwatch:*",
                "tag:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CicdAndContainerServices",
            "Effect": "Allow",
            "Action": [
                "s3:*",
                "ecr:*",
                "codebuild:*",
                "codepipeline:*"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CallerIdentity",
            "Effect": "Allow",
            "Action": "sts:GetCallerIdentity",
            "Resource": "*"
        }
    ]
}
```

## trust policy
Trust policy name: sbt-cdk-trust.json

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "GitHubOidcTrust",
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::658688924729:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": [
                        "repo:rahultiple31/med-aws-repo:ref:refs/heads/main",
                        "repo:rahultiple31/med-aws-repo:ref:refs/heads/*",
                        "repo:rahultiple31/med-aws-repo:pull_request",
                        "repo:rahultiple31/med-aws-repo:environment:*"
                    ]
                }
            }
        }
    ]
}
```


## Create role trust policy: dev-local-role-trust.json

Policy document file: dev-local-role-trust.json

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TrustRahulUser",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::658688924729:user/rahul"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}

```


## Create Rahul user policy (assume role only): rahul-assume-dev-local-role-policy.json

Policy name: rahul-assume-dev-local-role-policy.json

```
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AssumeDevLocalDeployRole",
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::658688924729:role/DevLocalDeployRole"
    },
    {
      "Sid": "GetCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}

```
