terraform {
  required_version = ">= 1.8.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

variable "project_id" { type = string }
variable "region" { type = string, default = "europe-west1" }

provider "google" {
  project = var.project_id
  region  = var.region
}

# Billable resources are added after project/network/IAM decisions are confirmed.
