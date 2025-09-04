import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { takeUntil } from 'rxjs';
import { Site } from 'src/entities/site.entity';
import { SitesTabelas } from 'src/entities/sites-tabelas.entity';
import { ChangesGateway } from 'src/Gateway/updates.gateway';
import { DataSource, Raw, Repository } from 'typeorm';
import { ulid } from 'ulid';
function normalizeColumnName(name: string) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/\s+/g, "_"); // espaços para underline
}
function generateTableId(): string {
    // Exemplo usando ULID (128 bits) e truncando para 16 chars base62
    return ulid().slice(0, 16);
}
interface ColumnDto {
    name: string;
    type: string;
    notNull: boolean;
}
@Injectable()
export class SitesService {



    constructor(
        @InjectRepository(Site)
        private siteRepository: Repository<Site>,
        @InjectRepository(SitesTabelas)
        private sitesTabelasRepository: Repository<SitesTabelas>,
        private readonly dataSource: DataSource,
        private changesGateway: ChangesGateway,



    ) { }

    findAll(): Promise<Site[]> {
        return this.siteRepository.find();
    }

    async findOne(siteId: number): Promise<Site | null> {
        return await this.siteRepository.findOne({
            where: { id: siteId }
        });
    }



    async createSite(name: string) {
        const site = this.siteRepository.create({ name });
        return this.siteRepository.save(site);
    }






    async createSiteTable(
        siteId: number,
        tableName: string,
        columns: { name: string; type: string; notNull?: boolean }[]
    ) {
        // Normaliza os nomes das colunas
        const columnsSql = columns
            .map(c => `${normalizeColumnName(c.name)} ${c.type}${c.notNull ? ' NOT NULL' : ''}`)
            .join(',\n        ');

        // Gera um table_id único
        const tableId = generateTableId();

        // Cria o SQL usando o table_id como nome real da tabela no banco
        const sql = `
            CREATE TABLE IF NOT EXISTS ${tableId} (
                id INT NOT NULL AUTO_INCREMENT,
                ${columnsSql},
                PRIMARY KEY(id)
            )
        `;

        // Executa o SQL no banco
        await this.dataSource.query(sql);

        // Salva na tabela de metadados
        const st = this.sitesTabelasRepository.create({
            site_id: siteId,
            table_name: tableName, // apenas para exibição
            table_id: tableId, // nome real da tabela no banco
        });
        this.changesGateway.sendSiteAltered(siteId)
        return this.sitesTabelasRepository.save(st);
    }






    async updateTableRecord(
        siteId: number,
        tableName: string,
        id: number,
        data: Record<string, any>,
    ) {
        if (siteId !== 0) {
            await this.validateTable(siteId, tableName);
        }

        const filteredData = { ...data };
        delete filteredData.id; // não altere o ID

        const setClauses = Object.entries(filteredData)
            .map(([col, val]) => `\`${col}\` = ${val === '' ? 'NULL' : `'${val}'`}`)
            .join(', ');

        const sql = `UPDATE ${tableName} SET ${setClauses} WHERE id = ${id}`;
        await this.dataSource.query(sql);

        this.changesGateway.sendTableAltered(tableName, siteId)

        return { message: 'Registro atualizado com sucesso!' };
    }
    async getSiteTables(siteId: number) {
        return this.sitesTabelasRepository.find({ where: { site_id: siteId } });
    }

    private async validateTable(siteId: number, tableName: string) {
        let table
        if (siteId !== 0) {
            table = await this.dataSource.getRepository(SitesTabelas).findOne({
                where: { site_id: siteId, table_id: tableName },
            });
        } else {
            table = await this.dataSource.getRepository(SitesTabelas).findOne({
                where: { table_id: tableName },
            });
        }
        if (!table) {
            throw new NotFoundException(`Tabela "${tableName}" não encontrada para o site ${siteId}`);
        }
    }
    async createTableRecord(siteId: number, tableName: string, data: Record<string, any>) {
        if (siteId !== 0) {
            await this.validateTable(siteId, tableName);

        }

        // Garante que o id auto_increment não seja enviado
        const filteredData = { ...data };
        delete filteredData.id;


        const columns = Object.keys(filteredData)
            .map((col) => `\`${col}\``)
            .join(', ');
        const values = Object.values(filteredData)
            .map((val) => (val === '' ? 'NULL' : `'${val}'`))
            .join(', ');




        const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
        await this.dataSource.query(sql);
        this.changesGateway.sendTableAltered(tableName, siteId)

        return { message: 'Registro criado com sucesso!' };
    }




    async getDescriptionOfTable(siteId: number, tableName: string) {
        const site = this.siteRepository.findOne({
            where: { id: siteId }
        })

        if (!site) {
            throw new NotFoundException("Site não existe")
        }



        let tableAssociated


        if (siteId === 1) {
            tableAssociated = this.sitesTabelasRepository.findOne({
                where: {
                    table_id: Raw((alias) => `LOWER(${alias}) = :tableName`, {
                        tableName: tableName,
                    }),
                },
            });
        } else {
            tableAssociated = this.sitesTabelasRepository.findOne({
                where: {
                    table_id: Raw((alias) => `LOWER(${alias}) = :tableName`, {
                        tableName: tableName,
                    }),
                    site_id: siteId,
                },
            });
        }


        if (!tableAssociated) {
            throw new NotFoundException("Essa tabela não está associada ao site")
        }

        const values = await this.dataSource.query(
            `DESCRIBE  ${tableName}`
        );

        return values;


    }

    async getValuesOfTableByProject(siteId: number, tableName: string) {

        const site = this.siteRepository.findOne({
            where: { id: siteId }
        })

        if (!site) {
            throw new NotFoundException("Site não existe")
        }
        let tableAssociated


        if (siteId === 1) {
            tableAssociated = await this.sitesTabelasRepository.findOne({
                where: {
                    table_id: Raw((alias) => `LOWER(${alias}) = :table_id`, {
                        table_id: tableName,
                    }),
                },
            });
        } else {
            tableAssociated = await this.sitesTabelasRepository.findOne({
                where: {
                    table_id: Raw((alias) => `LOWER(${alias}) = :table_id`, {
                        table_id: tableName,
                    }),
                    site_id: siteId,
                },
            });
        }
        if (!tableAssociated) {
            throw new NotFoundException("Essa tabela não está associada ao site")
        }
        let values
        if (siteId !== 1) {
            values = await this.dataSource.query(
                `SELECT * FROM ${tableName} `
            );
        } else {
            values = await this.dataSource.query(
                `SELECT * FROM ${tableName}`
            );
        }
        return values;





    }



    async getExistingTableNotInSite(siteId: number) {
        const tabelasInSite = await this.sitesTabelasRepository.find({
            where: { site_id: siteId },
            select: ["table_name"]
        });

        const tabelasInSiteNames = tabelasInSite.map(t => t.table_name);
        const allTables = await this.dataSource.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'project_manager' AND table_type = 'BASE TABLE'
            `);
        const tabelasNaoAssociadas = allTables.filter(
            t =>
                !tabelasInSiteNames.includes(t.TABLE_NAME.toLowerCase()) &&
                !["user_main", "sites", "sites_tabelas", "sites_users"].includes(t.TABLE_NAME.toLowerCase())
        );



        return tabelasNaoAssociadas;
    }




    async associateTableWithProject(siteID: number, tableName: string) {
        const site = await this.siteRepository.findOne({ where: { id: siteID } });
        if (!site) {
            throw new NotFoundException(`Site com ID ${siteID} não encontrado`);
        }

        const existing = await this.sitesTabelasRepository.findOne({
            where: { site_id: siteID, table_id: tableName },
        });

        if (existing) {
            throw new BadRequestException(`Tabela "${tableName}" já está associada ao site ${siteID}`);
        }

        const association = this.sitesTabelasRepository.create({
            site_id: siteID,
            table_id: tableName,
        });
        this.changesGateway.sendSiteAltered(siteID)

        return await this.sitesTabelasRepository.save(association);
    }

    async getDashboard(siteId: number) {
        const siteTables = await this.sitesTabelasRepository.find({
            where: { site_id: siteId },
            select: ["table_id", "table_name"],
        });

        const dashboardData: Record<string, { tableName: string; rows: any[] }> = {};

        for (const table of siteTables) {
            const table_id = table.table_id;
            const table_name = table.table_name;

            try {
                let rows: any[] = [];
                if (siteId === 1) {
                    rows = await this.dataSource.query(
                        `SELECT * FROM ${table_id} ORDER BY id DESC LIMIT 5`
                    );
                } else {
                    rows = await this.dataSource.query(
                        `SELECT * FROM ${table_id}  ORDER BY id DESC LIMIT 5`
                    );
                }

                dashboardData[table_id] = {
                    tableName: table_name,
                    rows,
                };

            } catch (err) {
                console.error(`Erro ao buscar dados da tabela ${table_id}:`, err);
                dashboardData[table_id] = {
                    tableName: table_name,
                    rows: [],
                };
            }
        }

        return dashboardData;
    }




    async getTableById(table_id: string) {
        const tabela = await this.sitesTabelasRepository.findOne({
            where: {
                table_id: table_id
            }
        })

        return tabela?.table_name
    }


    async deleteTable(table_id: string) {
        const protectedTables = ["sites", "users_main", "sites_users", "sites_tabelas"];
        if (protectedTables.includes(table_id.toLowerCase())) {
            throw new Error(`A tabela ${table_id} não pode ser deletada`);
        }

        const tableAssoc = await this.sitesTabelasRepository.findOne({
            where: { table_id }
        });

        if (!tableAssoc) {
            throw new NotFoundException("Tabela não encontrada");
        }

        await this.sitesTabelasRepository.remove(tableAssoc);

        await this.dataSource.query(`DROP TABLE IF EXISTS \`${table_id}\``);
        this.changesGateway.sendSiteAltered(tableAssoc.site_id)

        return { message: `Tabela ${table_id} deletada com sucesso` };
    }

    async deleteTableRecords(table_id: string, id?: number) {


        // Verifica se foi passado um id
        if (id === undefined) {
            throw new Error("É necessário informar o id do registro a ser deletado");
        }
        const association = await this.sitesTabelasRepository.findOne({ where: { table_id: table_id } })
        if (!association) return
        // Monta o SQL para deletar o registro específico
        const query = `DELETE FROM \`${table_id}\` WHERE id = ${id}`;

        // Executa a query
        await this.dataSource.query(query);
        this.changesGateway.sendTableAltered(table_id, association?.site_id)

        return { message: `Registro de id ${id} na tabela ${table_id} deletado com sucesso` };
    }


    async updateSiteTable(
        siteId: number,
        tableName: string,        // Nome atual da tabela no banco (table_id)
        newName: string | undefined, // Novo nome para a tabela, se quiser renomear
        columns: ColumnDto[],     // Colunas que o usuário quer manter/alterar
    ) {
        // Valida se a tabela existe
        await this.validateTable(siteId, tableName);

        // 1️⃣ Renomear a tabela se necessário

        // Atualiza também o metadata na tabela SitesTabelas
        const tableAssoc = await this.sitesTabelasRepository.findOne({
            where: { site_id: siteId, table_id: tableName },
        });
        if (tableAssoc && newName) {
            tableAssoc.table_name = newName;
            await this.sitesTabelasRepository.save(tableAssoc);
        }

        // 2️⃣ Buscar estrutura atual da tabela
        const existingColumns: { Field: string; Type: string; Null: string }[] = await this.dataSource.query(
            `DESCRIBE \`${tableName}\``
        );

        // 3️⃣ Atualizar ou adicionar colunas
        for (const col of columns) {
            if (col.name.toLowerCase() === 'id') continue; // nunca mexer no ID
            const existing = existingColumns.find(e => e.Field === col.name);

            const nullStr = col.notNull ? 'NOT NULL' : 'NULL';
            const colType = col.type.toUpperCase();

            if (existing) {
                // ALTERA coluna existente
                await this.dataSource.query(
                    `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${col.name}\` ${colType} ${nullStr}`
                );
            } else {
                // ADICIONA coluna nova
                await this.dataSource.query(
                    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col.name}\` ${colType} ${nullStr}`
                );
            }
        }

        // 4️⃣ Opcional: remover colunas não incluídas na lista (exceto id)
        const columnNamesToKeep = columns.map(c => c.name.toLowerCase());
        for (const existing of existingColumns) {
            if (existing.Field.toLowerCase() !== 'id' && !columnNamesToKeep.includes(existing.Field.toLowerCase())) {
                await this.dataSource.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${existing.Field}\``);
            }
        }
        this.changesGateway.sendTableAltered(tableName, siteId)
        return { message: `Tabela "${tableName}" atualizada com sucesso!` };
    }


}
