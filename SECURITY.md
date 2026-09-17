# Security Policy

RiskRail handles public blockchain data and risk analytics. It must never request or store wallet seed phrases or private keys.

## Reporting a vulnerability

Do not open a public issue for a suspected security vulnerability. Contact the repository owner privately and include reproduction steps, affected component, and impact.

## Security baseline

- No private keys in the API or web app.
- Publisher credentials live in a managed secret store in production.
- API keys are stored hashed with a server-side pepper.
- Webhooks are signed and replay-protected.
- All input crossing a trust boundary is validated.
- Contract publishing is isolated from the public API process.
- Production database and Redis instances are private-network only.
