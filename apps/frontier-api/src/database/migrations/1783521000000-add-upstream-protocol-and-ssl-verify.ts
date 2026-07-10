import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class AddUpstreamProtocolAndSslOptions1783521000000 implements MigrationInterface {
  name = 'AddUpstreamProtocolAndSslOptions1783521000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.addColumn('upstream', new TableColumn({
      name: 'protocol',
      type: 'varchar',
      length: '16',
      isNullable: false,
      default: `'http'`,
    }));

    await queryRunner.createTable(
      new Table({
        name: 'upstream_ssl_options',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_upstream_ssl_options',
          },
          {
            name: 'ssl_verify',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        foreignKeys: [{
          name: 'fk__upstream_ssl_options__id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'upstream',
        }],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('upstream_ssl_options');
    await queryRunner.dropColumn('upstream', 'protocol');
  }
}
