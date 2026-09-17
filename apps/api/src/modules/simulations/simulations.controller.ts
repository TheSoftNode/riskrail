import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RunSimulationDto } from './simulations.dto.js';
import { SimulationsService } from './simulations.service.js';

@ApiTags('simulations')
@Controller('simulations')
export class SimulationsController {
  constructor(private readonly simulations: SimulationsService) {}

  @Get('presets')
  @ApiOperation({ summary: 'List deterministic built-in market stress scenarios' })
  presets() {
    return this.simulations.presets();
  }

  @Post()
  @ApiOperation({ summary: 'Run a deterministic stress scenario against the latest indexed portfolio' })
  @ApiResponse({ status: 201, description: 'Simulation completed' })
  run(@Body() input: RunSimulationDto) {
    return this.simulations.run(input);
  }
}
