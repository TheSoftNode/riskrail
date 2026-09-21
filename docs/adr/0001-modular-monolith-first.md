# ADR 0001: Modular monorepo before microservice expansion

Status: Accepted

Rivisk starts as five deployable processes sharing versioned packages rather than independent repositories or Kafka-backed microservices. The goal is strong module boundaries without operational complexity during the grant MVP.

Kafka/Kubernetes may be introduced when measured throughput, isolation, or scaling requirements justify them. Domain event schemas are defined from the start to preserve that migration path.
