import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

@Entity({
  name: 'upstream_ssl_options',
})
export class UpstreamSslOptions {
  @PrimaryColumn('uuid', {
    name: 'id',
    primaryKeyConstraintName: 'pk_upstream_ssl_options',
  })
  id: string;

  @Column({
    name: 'ssl_verify',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  sslVerify: boolean;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}
