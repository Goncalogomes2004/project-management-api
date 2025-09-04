import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Site } from 'src/entities/site.entity';
import { SitesService } from './sites.service';
import { SitesTabelas } from 'src/entities/sites-tabelas.entity';
import { SitesController } from './sites.controller';
import { ChangesGateway } from 'src/Gateway/updates.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Site, SitesTabelas]),
  ], providers: [SitesService, ChangesGateway],
  controllers: [SitesController]
})
export class SitesModule { }
