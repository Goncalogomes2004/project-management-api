import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersMainController } from './users_main/users_main.controller';
import { UsersMainService } from './users_main/users_main.service';
import { UsersMainModule } from './users_main/users_main.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMain } from './entities/user_main.entity';
import { Atividade } from './entities/atividade.entity';
import { Site } from './entities/site.entity';
import { SitesTabelas } from './entities/sites-tabelas.entity';
import { SitesUsers } from './entities/sites_users.entity';
import { SitesModule } from './sites/sites.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: '10.11.150.6',
      port: 4003,
      username: 'root',
      password: 'Lavragem-titubeou-bebia0',
      database: 'project_manager',
      entities: [Site, SitesTabelas, UserMain, SitesUsers, Atividade],
    }),
    SitesModule, UsersMainModule],
  controllers: [AppController, UsersMainController],
  providers: [AppService],
})
export class AppModule { }
