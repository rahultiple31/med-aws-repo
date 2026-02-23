# NetCircle Academy Website (Node.js)

This is a complete small academy website built with Node.js, Express, EJS templates, and custom CSS.

## Features

- Multi-page site: Home, Courses, Admissions, Contact
- Responsive navigation for desktop and mobile
- Contact form posting to a Node.js API endpoint (`/api/inquiry`)
- Clean project structure ready for customization and deployment

## Tech Stack

- Node.js
- Express
- EJS
- Vanilla CSS and JavaScript

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## Production Run

```bash
npm install --omit=dev
npm start
```

## Project Structure

```text
.
|- public/
|  |- css/styles.css
|  |- js/main.js
|- views/
|  |- partials/
|  |  |- head.ejs
|  |  |- header.ejs
|  |  |- footer.ejs
|  |- index.ejs
|  |- courses.ejs
|  |- admissions.ejs
|  |- contact.ejs
|  |- 404.ejs
|- server.js
|- package.json
|- infrastructure/
|  |- bin/
|  |- lib/
|  |- cdk.json
|  |- package.json
|- codebuild-codedeploy/
|  |- buildspec.yml
|  |- deployspec.yml
|- k8s-artifacts/
|  |- namespace.yaml
|  |- deployment.yaml
|  |- service.yaml
|  |- hpa.yaml
|  |- ingress.yaml
|  |- newrelic-values.yaml
```

## AWS SaaS Builder Toolkit Infrastructure

Enterprise CDK TypeScript infrastructure is in `infrastructure/` with:

- Control plane stack (SBT + Cognito + DynamoDB + CloudWatch + VPC + security groups)
- Application plane stack (EKS + New Relic + Memcached + RDS MySQL + DynamoDB + CloudWatch)
- CI/CD stack (CodePipeline + CodeBuild + ECR + EKS deploy stage)
  - Build stage: clone GitHub repo, build app, build Docker image, push to ECR
  - Deploy stage: apply Kubernetes manifests to EKS using updated ECR image tag

Deploy workflow:

- GitHub Actions workflow: `.github/workflows/sbt-cdk-deploy.yml`
- CodeBuild/CodeDeploy artifacts: `codebuild-codedeploy/`
- Kubernetes manifests: `k8s-artifacts/`

## Push To GitHub

1. Create a new empty GitHub repository.
2. Run:

```bash
git init
git add .
git commit -m "Initial Node.js academy website"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Replace `<your-repo-url>` with your repository URL.
