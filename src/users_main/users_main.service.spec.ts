import { Test, TestingModule } from '@nestjs/testing';
import { UsersMainService } from './users_main.service';

describe('UsersMainService', () => {
  let service: UsersMainService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersMainService],
    }).compile();

    service = module.get<UsersMainService>(UsersMainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
