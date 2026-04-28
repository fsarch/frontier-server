import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'log_policy',
})
export class LogPolicy {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_log_policy',
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
    name: 'retention_time_seconds',
    type: 'bigint',
    nullable: false,
    default: '604800',
  })
  retentionTimeSeconds: number;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}

