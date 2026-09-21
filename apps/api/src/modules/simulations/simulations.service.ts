import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { NormalizedPosition } from '@rivisk/adapter-core';
import { getCurrentPortfolio } from '@rivisk/database';
import {
  DEFAULT_STRESS_SCENARIOS,
  runStressScenario,
  type StressScenario,
} from '@rivisk/risk-engine';
import { isStacksPrincipal } from '@rivisk/stacks';
import type { RunSimulationDto } from './simulations.dto.js';

@Injectable()
export class SimulationsService {
  presets() {
    return DEFAULT_STRESS_SCENARIOS;
  }

  async run(input: RunSimulationDto) {
    if (!isStacksPrincipal(input.address)) {
      throw new BadRequestException('A valid Stacks address is required');
    }
    if (input.shocks.some((shock) => !shock.assetId && !shock.symbol)) {
      throw new BadRequestException('Each shock must include assetId or symbol');
    }

    const wallet = await getCurrentPortfolio(input.address);
    if (!wallet) {
      throw new NotFoundException('Wallet has not been indexed yet');
    }

    const positions = wallet.positions.map(
      (position) => position.raw as unknown as NormalizedPosition,
    );
    if (positions.length === 0) {
      throw new NotFoundException('No active positions are available for simulation');
    }

    const scenario: StressScenario = {
      name: input.name ?? 'Custom scenario',
      shocks: input.shocks,
    };
    const result = runStressScenario(positions, scenario);

    return {
      address: input.address,
      sourceBlock: wallet.snapshots[0]?.blockHeight.toString() ?? null,
      valuationCoverageBps: wallet.snapshots[0]?.valuationCoverageBps ?? 0,
      ...result,
    };
  }
}
