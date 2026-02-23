<img width="1058" height="722" alt="image" src="https://github.com/user-attachments/assets/585905e2-61d7-4ac5-aca7-ed71a5a9eeb8" />                               +----------------------------------+
                               |  Management (Root) Account       |
                               +----------------+-----------------+
                                                |
                                                v
                               +----------------------------------+
                               | AWS Control Tower Landing Zone   |
                               +----------------+-----------------+
                                                |
        +---------------------------------------+--------------------------------------+
        |                                      |                                      |
        v                                      v                                      v
+-------------------------+        +-------------------------+            +-------------------------+
| Security OU             |        | Platform OU             |            | Application OU          |
+-----------+-------------+        +-----------+-------------+            +-----------+-------------+
            |                                  |                                      |
     +------+-------+                  +-------+----------------+             +-------+-------+
     | Log Archive  |                  | SaaS Control Plane     |             | Dev Account   |
     | Account      |                  | Account                |             | (App Plane)   |
     +--------------+                  +-----------+------------+             +-------+-------+
            |                                      |                                  |
     +------+-------+                              |                                  |
     | Audit        |                              |                                  |
     | Account      |                              |                                  |
     +--------------+                              |                           +------+-------+
                                                   |                           | QA Account    |
                                                   |                           | (App Plane)   |
                                                   |                           +--------------+
                                                   |
                                                   v
                                Tenant onboarding / identity / metering / provisioning
                                                   |
                                   +---------------+----------------+
                                   |                                |
                                   v                                v
                           Dev Application Plane            QA Application Plane

Cross-account governance/data flow:
- Dev, QA, and Control Plane logs/compliance data -> Log Archive
- Audit account has read-only audit/security visibility into Control Plane, Dev, QA
- Dev and QA send provisioning/status events back to SaaS Control Plane



---------------------------------------------------------------------------------------------------


```mermaid
flowchart TB
  %% Identity / Access
  IDP["Enterprise IdP (Okta/Azure AD/Ping)"] --> IIC["IAM Identity Center"]
  ADMIN["Platform Admin / DevOps"] --> IDP

  %% AWS Organization / Control Tower
  subgraph ORG["AWS Organizations + AWS Control Tower"]
    MGMT["Management Account"]
    AFT["Account Factory / AFT"]

    subgraph SEC["Security OU"]
      AUDIT["Audit Account"]
      LOG["Log Archive Account"]
    end

    subgraph NP["NonProd OU"]
      CPACC["Central NonProd Control Plane Account"]
      APDACC["Application Plane - Dev Account"]
      APQACC["Application Plane - QA Account"]
    end

    MGMT --> AFT
    AFT --> CPACC
    AFT --> APDACC
    AFT --> APQACC
    MGMT --> AUDIT
    MGMT --> LOG
  end

  IIC --> MGMT

  %% Control Plane account internals
  subgraph CP["Central Control Plane Account"]
    APIGW["Control Plane API"]
    AUTH["Auth (Cognito / Federated)"]
    TENANT["Tenant Management Service"]
    META["Tenant Metadata Store"]
    ORCH["Lifecycle Orchestrator"]
    BUS["Shared EventBridge Bus"]

    APIGW --> AUTH
    APIGW --> TENANT
    TENANT --> META
    TENANT --> ORCH
    ORCH --> BUS
  end

  CPACC --> APIGW
  CPACC --> BUS

  %% Dev App Plane account internals
  subgraph DEV["Dev Application Plane Account"]
    DEVBUS["Dev Event Bus"]
    DEVPROV["Dev Provisioner (Lambda/Step Functions)"]
    DEVRT["Dev Tenant Workloads"]
    DEVOBS["Dev Monitoring (CloudWatch/X-Ray)"]

    DEVBUS --> DEVPROV
    DEVPROV --> DEVRT
    DEVRT --> DEVOBS
  end

  %% QA App Plane account internals
  subgraph QA["QA Application Plane Account"]
    QABUS["QA Event Bus"]
    QAPROV["QA Provisioner (Lambda/Step Functions)"]
    QART["QA Tenant Workloads"]
    QAOBS["QA Monitoring (CloudWatch/X-Ray)"]

    QABUS --> QAPROV
    QAPROV --> QART
    QART --> QAOBS
  end

  APDACC --> DEVBUS
  APQACC --> QABUS

  %% Cross-account eventing
  BUS -->|Tenant lifecycle events| DEVBUS
  BUS -->|Tenant lifecycle events| QABUS

  %% Cross-account trust
  ROLEDEV["IAM Role: CP publish to Dev bus"]
  ROLEQA["IAM Role: CP publish to QA bus"]
  BUS -.->|AssumeRole| ROLEDEV
  BUS -.->|AssumeRole| ROLEQA
  ROLEDEV -.->|events:PutEvents| DEVBUS
  ROLEQA -.->|events:PutEvents| QABUS

  %% Logging / audit
  DEVRT -->|Centralized logs| LOG
  QART -->|Centralized logs| LOG
  DEVOBS -->|Security/Audit signals| AUDIT
  QAOBS -->|Security/Audit signals| AUDIT

  %% Delivery pipeline
  CICD["CI/CD Pipeline (CDK TypeScript)"] -->|Deploy control-plane stack| CPACC
  CICD -->|Deploy app-plane-dev stack| APDACC
  CICD -->|Deploy app-plane-qa stack| APQACC

```
