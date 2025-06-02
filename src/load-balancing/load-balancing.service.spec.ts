import { Test, TestingModule } from '@nestjs/testing';
import { LoadBalancingService } from './load-balancing.service';

describe('LoadBalancingService', () => {
  let service: LoadBalancingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoadBalancingService],
    }).compile();

    service = module.get<LoadBalancingService>(LoadBalancingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
