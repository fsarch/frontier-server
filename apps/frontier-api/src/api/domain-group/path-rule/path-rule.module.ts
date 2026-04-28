import { Module } from '@nestjs/common';
import { PathRuleService } from './path-rule.service';
import { PathRuleController } from './path-rule.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { CorsPolicy } from "../../../database/entities/cors-policy.entity";
import { PathRule } from "../../../database/entities/path-rule.entity";

@Module({
  providers: [PathRuleService],
  exports: [PathRuleService],
  controllers: [PathRuleController],
  imports: [
    TypeOrmModule.forFeature([PathRule, CorsPolicy]),
  ],
})
export class PathRuleModule {}
