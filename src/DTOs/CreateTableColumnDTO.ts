import { IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTableColumnDto {
    @IsString()
    name: string;

    @IsString()
    // opcional: regex simples p/ prevenir SQL injection
    @Matches(/^[A-Z]+(\(\d+\))?$/i, {
        message: 'O tipo deve ser um SQL válido (ex: VARCHAR(100), INT, DATETIME)',
    })
    type: string;

    @IsOptional()
    @IsBoolean()
    notNull?: boolean;
}

export class CreateSiteTableDto {
    @IsString()
    tableName: string;

    @IsArray()
    columns: CreateTableColumnDto[];
}
