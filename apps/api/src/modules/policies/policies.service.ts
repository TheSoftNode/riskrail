import { BadRequestException, Injectable } from '@nestjs/common';
import { RiskPolicyReader } from '@riskrail/riskrail-contracts';
import { isStacksPrincipal } from '@riskrail/stacks';

@Injectable()
export class PoliciesService {
  async get(address: string) {
    if (!isStacksPrincipal(address)) throw new BadRequestException('A valid Stacks principal is required');
    const contract = process.env.RISK_POLICY_CONTRACT;
    if (!contract) {
      return {
        address,
        configured: false,
        policy: null,
        note: 'RISK_POLICY_CONTRACT is not configured on this API instance.',
      };
    }

    const reader = new RiskPolicyReader(
      process.env.STACKS_API_URL ?? 'https://api.hiro.so',
      contract,
      process.env.STACKS_API_KEY || undefined,
    );
    return { address, configured: true, contract, policy: await reader.getPolicy(address) };
  }
}
