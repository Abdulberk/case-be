import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const apiKey = request.headers['x-api-key'];
    const validKey = this.configService.get<string>('ADMIN_API_KEY');

    if (!validKey) {
      this.logger.error(
        'ADMIN_API_KEY is not configured. Admin endpoints are disabled.',
      );
      throw new UnauthorizedException('Admin endpoints are not configured');
    }

    if (!apiKey || apiKey !== validKey) {
      this.logger.warn(
        `Unauthorized admin access attempt from ${request.ip}`,
      );
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
