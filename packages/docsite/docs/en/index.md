# TalosArk Documentation

TalosArk's software MVP is under development. This site publishes backend runtime and documentation delivery instructions, plus an API specification exported from a running instance.

## Implementation Status

The backend implements startup, bounded shutdown, process-scoped health endpoints, ApiRoute contract validation,
error factories and HTTP/WS error adaptation, and technical adapters for Prisma, KVS, IAM/OIDC, outbound HTTP and Pino.

OIDC login and session creation have endpoints. Public session refresh and current-session logout passed isolated HTTP/PostgreSQL verification.
Frontend automatic refresh and real identity-provider end-to-end verification remain separate work.
Organization, workspace, material, inventory, approval and workbench workflows are delivered incrementally.
Directories, schemas and placeholder endpoints are not evidence of a completed business workflow.

## Resources

- [Runtime and Delivery](./guide/quick-start.md)
- [Chinese](../index.md)
- [Source Repository](https://github.com/gdmuna/TalosArk)

The default API reference uses the specification included in this build. Development images can link to external documentation.
An exported specification is a snapshot, not proof that a deployed service is running the same revision.
