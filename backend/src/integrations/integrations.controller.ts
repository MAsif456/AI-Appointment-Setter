import { Controller, Get, Put, Post, Body, UseGuards, UsePipes, ValidationPipe, HttpCode, HttpStatus, } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationsDto, IntegrationSettingsResponse } from './dto/integrations.dto';

/**
 * Exposes GoHighLevel integration settings management endpoints.
 * All routes require a valid JWT — unauthenticated requests return 401.
 */
@Controller('api/integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * Returns current integration settings.
   * The API key is always masked (e.g. "••••••••••••abc123") — never plaintext.
   *
   * GET /api/integrations
   */
  @Get()
  async getSettings(): Promise<IntegrationSettingsResponse> {
    return this.integrationsService.getSettings();
  }

  /**
   * Updates GHL API key and/or webhook URL.
   * A new API key is validated against the GHL API before being stored.
   * Invalid keys are rejected with 400.
   *
   * PUT /api/integrations
   */
  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateSettings(
    @Body() dto: UpdateIntegrationsDto,
  ): Promise<IntegrationSettingsResponse> {
    return this.integrationsService.updateSettings(dto);
  }

  /**
   * Tests the stored API key against the GHL API and returns the current status.
   * Also persists the result so the UI status stays accurate.
   *
   * POST /api/integrations/test-connection
   */
  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(): Promise<{ status: 'connected' | 'disconnected' }> {
    return this.integrationsService.testConnection();
  }

  /**
   * Removes the stored API key and marks the integration as disconnected.
   * This stops all AI booking services that depend on GHL.
   *
   * POST /api/integrations/disconnect
   */
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(): Promise<{ message: string }> {
    await this.integrationsService.disconnect();
    return { message: 'GoHighLevel integration disconnected successfully.' };
  }
}
