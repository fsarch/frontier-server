import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'request_log',
})
export class RequestLog {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_request_log',
  })
  id: string;

  @Column({
    name: 'domain_group_id',
    type: 'uuid',
    nullable: false,
  })
  domainGroupId: string;

  @Column({
    name: 'path_rule_id',
    type: 'uuid',
    nullable: false,
  })
  pathRuleId: string;

  @Column({
    name: 'log_policy_id',
    type: 'uuid',
    nullable: false,
  })
  logPolicyId: string;

  @Column({
    name: 'incoming_method',
    type: 'varchar',
    length: '16',
    nullable: false,
  })
  incomingMethod: string;

  @Column({
    name: 'incoming_url',
    type: 'varchar',
    length: '4096',
    nullable: false,
  })
  incomingUrl: string;

  @Column({
    name: 'incoming_headers',
    type: 'jsonb',
    nullable: false,
  })
  incomingHeaders: Record<string, string | string[]>;

  @Column({
    name: 'upstream_method',
    type: 'varchar',
    length: '16',
    nullable: false,
  })
  upstreamMethod: string;

  @Column({
    name: 'upstream_url',
    type: 'varchar',
    length: '4096',
    nullable: false,
  })
  upstreamUrl: string;

  @Column({
    name: 'upstream_headers',
    type: 'jsonb',
    nullable: false,
  })
  upstreamHeaders: Record<string, string>;

  @Column({
    name: 'response_status_code',
    type: 'int',
    nullable: false,
  })
  responseStatusCode: number;

  @Column({
    name: 'request_time_ms',
    type: 'bigint',
    nullable: false,
  })
  requestTimeMs: number;

  @Column({
    name: 'expiration_time',
    type: 'timestamp',
    nullable: false,
  })
  expirationTime: Date;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;
}

