import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CollectorService } from './collector/collector.service.js';
import { CacheService } from './common/cache/cache.service.js';


describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: CollectorService,
          useValue: {
            getExecutionCount: () => 0,
            getQueueStats: () => ({
              pending: 0,
              active: 0,
              processed: 0,
              failed: 0,
              deadLetter: 0,
              concurrency: 5,
            }),
            enqueueAllLocations: () => 0,
          },
        },
        {
          provide: CacheService,
          useValue: {
            getStats: () => ({ size: 0, hits: 0, misses: 0, hitRate: '0%' }),
          },
        },

      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return health status', () => {
      const result = appController.getHealth();
      expect(result.status).toBe('ok');
      expect(result.service).toBe('ar-saude-coletor');
      expect(result.timestamp).toBeDefined();
    });
  });
});
