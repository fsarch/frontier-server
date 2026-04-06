import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'cache_policy',
})
export class CachePolicy {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_cache_policy',
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
    name: 'enable_cache_tags',
    nullable: false,
    default: false,
  })
  enableCacheTags: boolean;

  @Column({
    name: 'cache_tags_header',
    length: '256',
    nullable: true,
  })
  cacheTagsHeader: string;

  @Column({
    name: 'divergence_headers',
    array: true,
    type: 'varchar',
    nullable: true,
  })
  divergenceHeaders: Array<string>;

  @Column({
    name: 'divergence_cookies',
    array: true,
    type: 'varchar',
    nullable: true,
  })
  divergenceCookies: Array<string>;

  @Column({
    name: 'divergence_query_parameters',
    array: true,
    type: 'varchar',
    nullable: true,
  })
  divergenceQueryParameters: Array<string>;

  @Column({
    name: 'min_ttl',
    type: 'bigint',
    nullable: true,
  })
  minTTL: number;

  @Column({
    name: 'max_ttl',
    type: 'bigint',
    nullable: true,
  })
  maxTTL: number;

  @Column({
    name: 'default_ttl',
    type: 'bigint',
    nullable: true,
  })
  defaultTTL: number;

  @Column({
    name: 'enable_stale_while_error',
    nullable: false,
    default: true,
  })
  enableStaleWhileError: boolean;

  @Column({
    name: 'stale_while_error_time',
    type: 'bigint',
    nullable: true,
  })
  staleWhileErrorTime: number;

  @Column({
    name: 'enable_stale_while_revalidate',
    nullable: false,
    default: false,
  })
  enableStaleWhileRevalidate: boolean;

  @Column({
    name: 'stale_while_revalidate_time',
    type: 'bigint',
    nullable: true,
  })
  staleWhileRevalidateTime: number;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}
