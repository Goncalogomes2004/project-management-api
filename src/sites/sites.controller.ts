import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { Site } from 'src/entities/site.entity';
import { SitesService } from './sites.service';
import { CreateSiteTableDto } from 'src/DTOs/CreateTableColumnDTO';

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
}

