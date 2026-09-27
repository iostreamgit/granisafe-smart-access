# ADR-0001: Modular monolith + AI sidecar

## Status

Accepted (architecture pack)

## Context

Granisafe Smart Access must be an enterprise platform where AI PPE detection is only one module. Internship constraints favor operability and clean boundaries over microservice sprawl.

## Decision

Build the core domain as a **NestJS modular monolith** and run PPE inference as a **separate FastAPI/YOLO service** behind an `AiDetectorPort`. V1 gate I/O uses a `GatePort` simulation adapter.

## Consequences

- Independent AI scaling and model lifecycle
- Domain tests without loading neural nets
- Simple Compose demo topology
- Future hardware/cloud AI adapters without rewriting use cases
