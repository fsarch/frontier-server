import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from '@fsarch/server/auth';
import { WorkerBootstrapService, WorkerConfigSnapshot } from './worker-bootstrap.service.js';

@ApiTags('workers')
@Controller({
  path: 'workers/_actions',
  version: '1',
})
@ApiBearerAuth()
export class WorkerBootstrapController {
  private configVersion = 0;
  private configChecksum = '';

  constructor(
    private readonly bootstrapService: WorkerBootstrapService,
  ) {}

  @Get('bootstrap')
  @UseGuards(AuthGuard)
  public async bootstrap(): Promise<{
    version: number;
    checksum: string;
    snapshot: WorkerConfigSnapshot;
  }> {
    const response = await this.bootstrapService.getBootstrapResponse(
      this.configVersion,
      this.configChecksum
    );

    // Update internal state for next request
    this.configChecksum = response.checksum;
    this.configVersion = response.version;

    return {
      version: response.version,
      checksum: response.checksum,
      snapshot: response.snapshot,
    };
  }
}
