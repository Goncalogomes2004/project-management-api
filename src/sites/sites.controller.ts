import { BadRequestException, Body, Controller, Delete, Get, InternalServerErrorException, NotFoundException, Param, Patch, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Site } from 'src/entities/site.entity';
import { SitesService } from './sites.service';
import { CreateSiteTableDto } from 'src/DTOs/CreateTableColumnDTO';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';


interface ColumnDto {
    name: string;
    type: string;
    notNull: boolean;
}
interface UpdateTableDto {
    tableName?: string; // novo nome da tabela, opcional
    columns: ColumnDto[];
}

@Controller('sites')
export class SitesController {
    constructor(private readonly sitesService: SitesService) { }

    @Get()
    findAll(): Promise<Site[]> {
        return this.sitesService.findAll();
    }
    @Get('/:siteId')
    findOne(@Param('siteId') siteId: number): Promise<Site | null> {
        return this.sitesService.findOne(siteId);
    }

    @Post(':siteId/tables')
    async createSiteTable(
        @Param('siteId') siteId: number,
        @Body() dto: CreateSiteTableDto,
    ) {
        return this.sitesService.createSiteTable(siteId, dto.tableName, dto.columns);
    }



    @Post('associateTableWithProject/:siteID/:table_name')
    async associateTableWithProject(
        @Param('siteID') siteID: number,
        @Param('table_name') tableName: string,
    ) {

        return this.sitesService.associateTableWithProject(siteID, tableName);
    }





    @Get(':siteId/tables')
    async getSiteTables(@Param('siteId') siteId: number) {

        return this.sitesService.getSiteTables(siteId);
    }


    @Post('/createTableRecord/:siteId/:tableName')
    async createTableRecord(
        @Param('siteId') siteId: number,
        @Param('tableName') tableName: string,
        @Body() body: Record<string, any>,
    ) {
        return this.sitesService.createTableRecord(siteId, tableName, body);
    }



    @Patch('/updateTableRecord/:siteId/:tableName/:id')
    async updateTableRecord(
        @Param('siteId') siteId: number,
        @Param('tableName') tableName: string,
        @Param('id') id: number,
        @Body() body: Record<string, any>,
    ) {
        return this.sitesService.updateTableRecord(siteId, tableName, id, body);
    }

    @Get('/valuesByTableName/:siteId/:tableName')
    async getValuesOfTableByProject(
        @Param('siteId') siteId: number,
        @Param('tableName') tableName: string,
    ) {
        return this.sitesService.getValuesOfTableByProject(siteId, tableName);
    }




    @Get('/existingTables/:siteId')
    async getExistingTableNotInSite(
        @Param('siteId') siteId: number,
    ) {
        return this.sitesService.getExistingTableNotInSite(siteId);
    }




    @Get('/getDescriptionOfTable/:siteId/:tableName')
    async getDescriptionOfTable(
        @Param('siteId') siteId: number,
        @Param('tableName') tableName: string,
    ) {
        return this.sitesService.getDescriptionOfTable(siteId, tableName);
    }



    @Get('/dashboard/:siteId')
    async getDashboard(
        @Param('siteId') siteId: number,
    ) {
        return this.sitesService.getDashboard(siteId);
    }



    @Get('/getTableById/:tableId')
    async getTableById(
        @Param('tableId') tableId: string,
    ) {
        return this.sitesService.getTableById(tableId);
    }


    @Delete('/deleteTable/:tableId')
    async deleteTable(
        @Param('tableId') tableId: string,
    ) {
        return this.sitesService.deleteTable(tableId);
    }



    @Delete('/deleteTableRecords/:tableId/:id')
    async deleteTableRecords(
        @Param('tableId') tableId: string,
        @Param('id') id: number,
    ) {
        console.log("Apagando tabela", tableId, "registro", id);
        return this.sitesService.deleteTableRecords(tableId, id);
    }



    @Patch('/updateSiteTable/:siteId/:tableName')
    async updateSiteTable(
        @Param('siteId') siteId: number,
        @Param('tableName') tableName: string,
        @Body() dto: UpdateTableDto,
    ) {
        return this.sitesService.updateSiteTable(siteId, tableName, dto.tableName, dto.columns);
    }




    @Post("/image/:id/:table_id")
    @UseInterceptors(
        FileInterceptor('image', {
            storage: diskStorage({
                destination: './public/images',
                filename: (req, file, callback) => {
                    // Substitui espaços e caracteres problemáticos no nome do arquivo
                    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
                    const filename = `${Date.now()}-${safeName}`;
                    callback(null, filename);
                },
            }),
            fileFilter: (req, file, callback) => {
                // Aceita apenas imagens PNG, JPG, JPEG, GIF ou WebP
                if (/image\/(png|jpeg|jpg|gif|webp)/.test(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(new BadRequestException('Apenas imagens são permitidas'), false);
                }
            },
            limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
        }),
    )
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Param("id") id: number,
        @Param("table_id") table_id: string,
    ) {
        if (!file) {
            throw new NotFoundException('Nenhuma imagem foi enviada');
        }

        console.log('Arquivo recebido:', file);

        try {
            const filename = await this.sitesService.saveFile(file, table_id, +id);
            return { message: 'Imagem carregada com sucesso!', filename };
        } catch (error) {
            console.error('Erro ao salvar a imagem:', error);
            throw new InternalServerErrorException('Erro ao salvar a imagem');
        }
    }


    @Get('/image/:id/:table_id')
    async getImage(
        @Param('id') id: number,
        @Param('table_id') table_id: string,
        @Res() res: Response,
    ) {
        try {
            const filename = await this.sitesService.getFile(table_id, id);

            if (!filename) {
                throw new NotFoundException('Imagem não encontrada');
            }

            const filePath = path.join(
                process.cwd(),
                'public/images',
                filename,
            );

            if (!fs.existsSync(filePath)) {
                throw new NotFoundException('Arquivo físico não encontrado');
            }

            return res.sendFile(filePath);
        } catch (error) {
            console.error('Erro ao buscar a imagem:', error);
            throw new NotFoundException('Erro ao buscar a imagem');
        }
    }


    @Delete('/image/:id/:table_id')
    async deleteImage(
        @Param('id') id: number,
        @Param('table_id') table_id: string,
    ) {
        try {
            const deleted = await this.sitesService.deleteFile(table_id, id);

            if (!deleted) {
                throw new NotFoundException('Imagem não encontrada');
            }

            return { message: 'Imagem apagada com sucesso' };
        } catch (error) {
            console.error('Erro ao apagar a imagem:', error);
            throw new NotFoundException('Erro ao apagar a imagem');
        }
    }

}

