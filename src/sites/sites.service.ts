import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { takeUntil } from 'rxjs';
import { Site } from 'src/entities/site.entity';
import { SitesTabelas } from 'src/entities/sites-tabelas.entity';
import { ChangesGateway } from 'src/Gateway/updates.gateway';
import { DataSource, Raw, Repository } from 'typeorm';
import { ulid } from 'ulid';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

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
    private uploadPath = './public/images';




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
        // Remove colunas do tipo IMAGEM (não existem no MySQL)
        const filteredColumns = columns.filter(c => c.type.toUpperCase() !== 'IMAGEM');

        // Normaliza os nomes das colunas e cria SQL
        let columnsSql = filteredColumns
            .map(c => `${normalizeColumnName(c.name)} ${c.type}${c.notNull ? ' NOT NULL' : ''}`)
            .join(',\n        ');

        // Verifica se havia uma coluna do tipo IMAGEM
        const hasImageColumn = columns.some(c => c.type.toUpperCase() === 'IMAGEM');
        if (hasImageColumn) {
            // Adiciona automaticamente o campo image_id
            columnsSql += `,\n        image_id VARCHAR(255) NULL`;
        }

        // Gera um table_id único
        const tableId = generateTableId();

        // Cria a tabela no MySQL
        const sql = `
        CREATE TABLE IF NOT EXISTS \`${tableId}\` (
            id INT NOT NULL AUTO_INCREMENT,
            ${columnsSql},
            PRIMARY KEY(id)
        )
    `;

        await this.dataSource.query(sql);

        // Salva metadados
        const st = this.sitesTabelasRepository.create({
            site_id: siteId,
            table_name: tableName, // apenas para exibição
            table_id: tableId,     // nome real da tabela no banco
        });

        this.changesGateway.sendSiteAltered(siteId);

        return this.sitesTabelasRepository.save(st);
    }






    async updateTableRecord(
        siteId: number,
        tableName: string,
        id: number,
        data: Record<string, any>,
    ) {
        console.log("aqui", data);
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
        console.log("data", data);
        const filteredData = { ...data };
        delete filteredData.id;

        const columns = Object.keys(filteredData)
            .map((col) => `\`${col}\``)
            .join(', ');

        const values = Object.values(filteredData)
            .map((val) => (val === '' ? 'NULL' : `'${val}'`))
            .join(',');

        await this.dataSource.query(`INSERT INTO \`${tableName}\` (${columns}) VALUES (${values})`);

        // Retorna o ID do registro recém-criado
        const [result] = await this.dataSource.query('SELECT LAST_INSERT_ID() as id');
        const newId = result.id;

        this.changesGateway.sendTableAltered(tableName, siteId);

        return { message: 'Registro criado com sucesso!', id: newId };
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
        tableName: string,           // Nome atual da tabela no banco
        newName: string | undefined, // Novo nome da tabela, se quiser renomear
        columns: ColumnDto[],        // Colunas que o usuário quer manter/alterar
    ) {
        // Valida se a tabela existe
        await this.validateTable(siteId, tableName);
        console.log("Atualizando tabela", tableName, "do site", siteId, "com colunas:", columns);

        // 1️⃣ Renomear a tabela se necessário
        const tableAssoc = await this.sitesTabelasRepository.findOne({
            where: { site_id: siteId, table_id: tableName },
        });
        if (tableAssoc && newName) {
            tableAssoc.table_name = newName;
            await this.sitesTabelasRepository.save(tableAssoc);
        }

        // 2️⃣ Buscar estrutura atual da tabela
        const existingColumns: { Field: string; Type: string; Null: string }[] =
            await this.dataSource.query(`DESCRIBE \`${tableName}\``);

        // 3️⃣ Atualizar ou adicionar colunas
        for (const col of columns) {
            if (col.name.toLowerCase() === 'id') continue; // nunca mexer no ID

            // Se for IMAGEM, o nome no banco será image_id
            const columnNameInDb = col.type.toUpperCase() === 'IMAGEM' ? 'image_id' : col.name;

            const existing = existingColumns.find(e => e.Field === columnNameInDb);
            const nullStr = col.notNull ? 'NOT NULL' : 'NULL';

            // Mapeia IMAGEM para VARCHAR(255)
            const colType = col.type.toUpperCase() === 'IMAGEM' ? 'VARCHAR(255)' : col.type.toUpperCase();

            if (existing) {
                // ALTERA coluna existente
                await this.dataSource.query(
                    `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnNameInDb}\` ${colType} ${nullStr}`
                );
            } else {
                // ADICIONA coluna nova
                await this.dataSource.query(
                    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnNameInDb}\` ${colType} ${nullStr}`
                );
            }
        }

        // 4️⃣ Remover colunas não incluídas na lista (exceto id)
        const columnNamesToKeep = columns.map(c =>
            c.type.toUpperCase() === 'IMAGEM' ? 'image_id' : c.name.toLowerCase()
        );
        for (const existing of existingColumns) {
            if (existing.Field.toLowerCase() !== 'id' && !columnNamesToKeep.includes(existing.Field.toLowerCase())) {
                await this.dataSource.query(
                    `ALTER TABLE \`${tableName}\` DROP COLUMN \`${existing.Field}\``
                );
            }
        }

        // Notifica alterações
        this.changesGateway.sendTableAltered(tableName, siteId);

        return { message: `Tabela "${tableName}" atualizada com sucesso!` };
    }


    async saveFile(file: Express.Multer.File, table_id: string, id: number) {
        try {
            const tableAssoc = await this.sitesTabelasRepository.findOne({
                where: { table_id },
            });
            console.log("tableAssoc", tableAssoc);

            if (!tableAssoc) {
                throw new Error(`Tabela com ID ${table_id} não encontrada`);
            }

            // Busca o registo pelo id
            const [record] = await this.dataSource.query(
                `SELECT * FROM \`${table_id}\` WHERE id = ? LIMIT 1`,
                [id],
            );

            if (!record) {
                throw new Error(`Registo com id=${id} não encontrado na tabela ${table_id}`);
            }

            // Apaga imagem antiga (se existir)
            if (record.image_id) {
                const oldPath = path.join(this.uploadPath, record.image_id);
                try {
                    await fs.promises.unlink(oldPath);
                    console.log(`Imagem antiga ${record.image_id} apagada com sucesso`);
                } catch (err) {
                    console.warn(`Não foi possível apagar imagem antiga: ${err.message}`);
                }
            }

            // Atualiza o campo image_id
            await this.dataSource.query(
                `UPDATE \`${table_id}\` SET image_id = ? WHERE id = ?`,
                [file.filename, id],
            );

            return file.filename;
        } catch (error) {
            console.error("Erro ao salvar a imagem:", error);
            throw new Error("Erro ao salvar a imagem");
        }
    }

    async getFile(table_id: string, id: number): Promise<string | null> {
        try {
            const [user] = await this.dataSource.query(
                `SELECT image_id FROM \`${table_id}\` WHERE id = ? LIMIT 1`,
                [id],
            );

            if (!user || !user.image_id) {
                return null;
            }

            return user.image_id;
        } catch (error) {
            console.error('Erro ao buscar imagem no banco:', error);
            return null;
        }
    }
    async deleteFile(table_id: string, id: number): Promise<boolean> {
        try {
            // 1️⃣ Buscar imagem no registo
            const [user] = await this.dataSource.query(
                `SELECT image_id FROM \`${table_id}\` WHERE id = ? LIMIT 1`,
                [id],
            );

            if (!user || !user.image_id) {
                return false;
            }

            const imagePath = path.join(
                process.cwd(),
                'public/images',
                user.image_id,
            );

            // 2️⃣ Apagar ficheiro físico
            if (fs.existsSync(imagePath)) {
                await fs.promises.unlink(imagePath);
                console.log(`Imagem ${user.image_id} apagada do disco`);
            }

            // 3️⃣ Limpar campo no DB
            await this.dataSource.query(
                `UPDATE \`${table_id}\` SET image_id = NULL WHERE id = ?`,
                [id],
            );

            return true;
        } catch (error) {
            console.error('Erro ao apagar imagem no banco:', error);
            return false;
        }
    }

}
