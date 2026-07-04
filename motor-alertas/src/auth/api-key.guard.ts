import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    const expectedApiKey = this.configService.get<string>('API_KEY');

    if (!expectedApiKey) {
      this.logger.warn('API_KEY is not configured on the server. Rejecting request for safety.');
      throw new UnauthorizedException('API Key not configured');
    }

    if (apiKeyHeader !== expectedApiKey) {
      this.logger.warn(`Unauthorized ingest attempt from IP: ${request.ip}`);
      throw new UnauthorizedException('Invalid API Key');
    }

    return true;
  }
}
