import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type RateLimitKeyType = 'ip';

@Entity({
  name: 'rate_limit_policy',
})
export class RateLimitPolicy {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_rate_limit_policy',
  })
  id: string;

  @Column({
    name: 'domain_group_id',
    type: 'uuid',
    nullable: false,
  })
  domainGroupId: string;

  @Column({
    name: 'name',
    type: 'varchar',
    length: '256',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'enabled',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  enabled: boolean;

  @Column({
    name: 'request_limit',
    type: 'int',
    nullable: false,
  })
  limit: number;

  @Column({
    name: 'window_seconds',
    type: 'int',
    nullable: false,
    default: 60,
  })
  windowSeconds: number;

  @Column({
    name: 'key_type',
    type: 'varchar',
    length: '32',
    nullable: false,
    default: 'ip',
  })
  keyType: RateLimitKeyType;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}
