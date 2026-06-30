import { ApiProperty } from "@nestjs/swagger";
import { Hook } from "../database/entities/hook.entity.js";
import { Optional } from "@nestjs/common";

export class HookDto {
  static FromDbo(dbo: Hook) {
    const dto = new HookDto();

    dto.id = dbo.id;
    dto.name = dbo.name;
    dto.functionId = dbo.functionId;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  functionId: string;
}

export class HookUpdateDto {
  @ApiProperty({ required: false })
  @Optional()
  name?: string;

  @ApiProperty({ required: false })
  @Optional()
  functionId?: string;
}

export class HookCreateDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  functionId: string;
}
