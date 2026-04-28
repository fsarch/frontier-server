import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post, VERSION_NEUTRAL, Logger } from '@nestjs/common';
import { RequestLogService } from '../../domain-group/request-log/request-log.service';
import { WorkerRequestLogCreateDto } from '../../../models/request-log.model';
import { Inject } from '@nestjs/common';
import { ModuleConfigurationService } from '../../../fsarch/configuration/module/module-configuration.service';
import { ConfigWorkersType } from '../../../fsarch/configuration/config.type';
import { Public } from '../../../fsarch/auth/decorators/public.decorator';

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

