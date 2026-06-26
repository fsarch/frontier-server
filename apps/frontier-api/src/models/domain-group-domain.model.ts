import { ApiProperty } from "@nestjs/swagger";
import { DomainGroupDomain } from "../database/entities/domain-group-domain.entity.js";

export class DomainGroupDomainDto {
  static FromDbo(dbo: DomainGroupDomain) {
    const dto = new DomainGroupDomainDto();

    dto.id = dbo.id;
    dto.domainName = dbo.domainName;

    return dto;
  }

  @ApiProperty()
  id: string;

  @ApiProperty()
  domainName: string;
}

export class DomainGroupDomainCreateDto {
  @ApiProperty()
  domainName: string;
}
