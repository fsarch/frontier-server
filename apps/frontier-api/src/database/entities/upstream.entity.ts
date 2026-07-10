import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'upstream',
})
export class Upstream {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_upstream',
  })
  id: string;

  @Column({
    name: 'upstream_group_id',
    type: 'uuid',
    nullable: false,
  })
  upstreamGroupId: string;

  @Column({
    name: 'name',
    length: '256',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'host',
    length: '2048',
    nullable: false,
  })
  host: string;

  @Column({
    name: 'port',
    type: 'int',
    nullable: false,
  })
  port: number;

  @Column({
    name: 'path',
    length: '2048',
    nullable: false,
  })
  path: string;

  @Column({
    name: 'protocol',
    length: '16',
    nullable: false,
    default: 'http',
  })
  protocol: 'http' | 'https';

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}
