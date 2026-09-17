# Terraform

The production target is GCP Cloud Run + Cloud SQL PostgreSQL + Memorystore Redis + Secret Manager + Artifact Registry.

This scaffold intentionally does not create billable cloud resources automatically. Add environment-specific Terraform after the GCP project, billing account, regions, IAM boundaries, and networking strategy are confirmed. Keep `dev`, `staging`, and `production` state isolated.
