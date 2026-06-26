import { ApiProperty } from "@nestjs/swagger";
import { DomainGroup } from "../database/entities/domain-group.entity.js";

export class DomainGroupDto {
  static FromDbo(dbo: DomainGroup) {
    const dto = new DomainGroupDto();

    dto.id = dbo.id;
    dto.name = dbo.name;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class DomainGroupCreateDto {
  @ApiProperty()
  name: string;
}
