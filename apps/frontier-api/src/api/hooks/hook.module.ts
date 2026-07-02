import { Module } from '@nestjs/common';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Hook } from "../../database/entities/hook.entity.js";
import { HookController } from "./hook.controller.js";
import { HookService } from "./hook.service.js";

@Module({
  controllers: [HookController],
  providers: [HookService],
  imports: [
    TypeOrmModule.forFeature([Hook]),
  ],
  exports: [HookService],
})
export class HookModule {}
