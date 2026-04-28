import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'cors_policy',
})
export class CorsPolicy {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_cors_policy',
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
    name: 'allow_credentials',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  allowCredentials: boolean;

  @Column({
    name: 'allowed_origins',
    type: 'text',
    array: true,
    nullable: true,
  })
  allowedOrigins?: string[];

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}

