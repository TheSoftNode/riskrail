import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class PortfoliosService {
  getPortfolio(address: string) {
    // The indexer/database integration is intentionally the next implementation step.
    // Returning the domain envelope now keeps the API contract stable while adapters are wired in.
    return { address, totalValueUsd: '0.00', positions: [], status: 'indexing-not-configured' };
  }

  getRisk(address: string) {
    if (!address) throw new NotFoundException('Wallet address is required');
    return {
      address,
      riskLevel: 'unknown',
      protocolConcentrationBps: 0,
      capitalAccessibilityBps: 10_000,
      source: 'risk-engine-not-yet-indexed',
    };
  }
}
