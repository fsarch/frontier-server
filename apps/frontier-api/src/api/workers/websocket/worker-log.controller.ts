import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post, VERSION_NEUTRAL, Logger } from '@nestjs/common';
import { RequestLogService } from '../../domain-group/request-log/request-log.service.js';
import { WorkerRequestLogCreateDto } from '../../../models/request-log.model.js';
import { Inject } from '@nestjs/common';
import { ModuleConfigurationService } from '@fsarch/server/configuration';
import { Public } from '@fsarch/server/auth';
import { ConfigWorkersType } from "../../../types/config.type";

@Controller({
  path: 'api/workers/logs',
  version: VERSION_NEUTRAL,
})
@Public()
export class WorkerLogController {
  private readonly logger = new Logger(WorkerLogController.name);

  constructor(
    @Inject('WORKERS_CONFIG')
    private readonly workersConfigService: ModuleConfigurationService<ConfigWorkersType>,
    private readonly requestLogService: RequestLogService,
  ) {
  }

  @Post()
  @HttpCode(202)
  public async Create(
    @Body() payload: WorkerRequestLogCreateDto,
    @Headers('x-worker-token') workerToken: string | undefined,
  ) {
    const websocketConfig = this.workersConfigService.get('websocket');
    const expectedToken = websocketConfig?.auth_token;

    this.logger.debug(
      `Worker token validation: Received=${workerToken ? '[redacted]' : '<empty>'}, ` +
      `Expected=${expectedToken ? `[${expectedToken.substring(0, 3)}...]` : '<not configured>'}`,
    );

    if (!workerToken || !expectedToken || workerToken !== expectedToken) {
      this.logger.warn(
        `Worker token validation failed. Received: ${workerToken ? '[redacted]' : '<empty>'}, ` +
        `Expected: ${expectedToken ? '[configured]' : '<not configured>'}`,
      );
      throw new HttpException('Unauthorized worker token', HttpStatus.UNAUTHORIZED);
    }

    await this.requestLogService.Create(payload);
  }
}

