import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({
  name: 'hook',
})
export class Hook {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_hook',
  })
  id: string;

  @Column({
    name: 'name',
    length: '256',
    nullable: false,
  })
  name: string;

  @Column({
    name: 'function_id',
    type: 'uuid',
    nullable: false,
  })
  functionId: string;

  @CreateDateColumn({
    name: 'creation_time',
  })
  creationTime: Date;

  @DeleteDateColumn({
    name: 'deletion_time',
  })
  deletionTime: Date;
}
