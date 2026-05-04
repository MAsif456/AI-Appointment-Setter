/**
 * Controller for clinic endpoints.
 * Handles listing, individual clinic retrieval, and clinic creation.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicSettingsDto } from './dto/update-clinic-settings.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

/**
 * REST controller exposing clinic endpoints.
 * All routes are prefixed with /clinics.
 */
@Controller("clinics")
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * POST /clinics
   * Creates a new clinic based on the provided DTO.
   * @param dto The CreateClinicDto containing the clinic's information.
   * @returns The newly created clinic document.
   */
  @Post()
  create(@Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto);
  }

  /**
   * GET /clinics
   * Returns every clinic, optionally filtered by a search query param.
   * @param search - partial name to filter on (case-insensitive)
   */
  @Get()
  findAll(@Query("search") search?: string) {
    return this.clinicsService.findAll(search);
  }

  /**
   * GET /clinics/:id
   * Returns a single clinic by its MongoDB ObjectId.
   * The ghlApiKey is masked (e.g. "••••••••••••abc123") before returning —
   * the plaintext key is never exposed over the API.
   * Throws 400 if the ID format is invalid, 404 if no clinic is found.
   */
  @Get(":id")
  async findById(@Param("id") id: string) {
    const clinic = await this.clinicsService.findById(id);
    const doc = clinic.toObject();
    doc.ghlApiKey = this.clinicsService.maskApiKey(doc.ghlApiKey ?? '');
    return doc;
  }

  /**
   * PATCH /clinics/:id/deactivate
   * Marks the clinic as inactive.
   */
  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string) {
    return this.clinicsService.deactivate(id);
  }

  /**
   * PATCH /clinics/:id/activate
   * Marks the clinic as active.
   */
  @Patch(":id/activate")
  activate(@Param("id") id: string) {
    return this.clinicsService.activate(id);
  }

  /**
   * PATCH /clinics/:id/settings
   * Partially updates a clinic's basic settings.
   * Only fields present in the request body are applied.
   * Throws 400 for an invalid ID, 404 if the clinic does not exist.
   */
  @Patch(":id/settings")
  updateSettings(
    @Param("id") id: string,
    @Body() body: UpdateClinicSettingsDto,
  ) {
    return this.clinicsService.updateBasicSettings(id, body);
  }

  // ---------------------------------------------------------------------------
  // Integration endpoints (all require a valid JWT)
  // ---------------------------------------------------------------------------

  /**
   * PUT /clinics/:id/integrations
   * Validates the supplied GHL API key against the live GHL API,
   * then encrypts and stores it. Returns 400 if the key is rejected by GHL.
   */
  @Put(':id/integrations')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateIntegrations(
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ): Promise<{ message: string }> {
    await this.clinicsService.updateIntegrations(id, dto.ghlApiKey, dto.webhookUrl);
    return { message: 'Integration settings updated successfully' };
  }

  /**
   * POST /clinics/:id/integrations/test
   * Tests the stored encrypted API key against the GHL API.
   * Returns { connected: boolean } — does not throw on GHL failure.
   */
  @Post(':id/integrations/test')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async testIntegration(
    @Param('id') id: string,
  ): Promise<{ connected: boolean }> {
    return this.clinicsService.testClinicConnection(id);
  }

  /**
   * DELETE /clinics/:id/integrations
   * Removes the stored GHL API key and webhook URL and marks the clinic inactive.
   */
  @Delete(':id/integrations')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectIntegration(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.clinicsService.disconnectIntegration(id);
    return { message: 'Integration disconnected successfully' };
  }
}
