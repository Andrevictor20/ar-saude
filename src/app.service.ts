import { Injectable } from '@nestjs/common';

/**
 * Service raiz — provê lógica auxiliar como o healthcheck.
 */
@Injectable()
export class AppService {
  getHealth(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'ar-saude-coletor',
      timestamp: new Date().toISOString(),
    };
  }
}
