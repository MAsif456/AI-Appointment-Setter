/**
 * Controller for clinic AI settings endpoints.
 * Handles HTTP request/response for GET and PUT operations.
 */
import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AiSettingsService, AiSettingsResponse } from "./ai-settings.service";
import { UpdateAiSettingsDto } from "./ai-settings.dto";

@Controller("api/clinics/:clinicId/ai-settings")
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  /**
   * Returns the current AI configuration for a clinic.
   * @param clinicId - The clinic's MongoDB ObjectId from the URL
   * @returns The clinic's AI settings with defaults applied
   */
  @Get()
  async getAiSettings(
    @Param("clinicId") clinicId: string,
  ): Promise<AiSettingsResponse> {
    return this.aiSettingsService.getAiSettings(clinicId);
  }

  /**
   * Updates the AI configuration for a clinic.
   * Validates the request body against UpdateAiSettingsDto.
   * @param clinicId - The clinic's MongoDB ObjectId from the URL
   * @param updateDto - The validated AI settings fields to update
   * @returns The updated AI settings
   */
  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateAiSettings(
    @Param("clinicId") clinicId: string,
    @Body() updateDto: UpdateAiSettingsDto,
  ): Promise<AiSettingsResponse> {
    return this.aiSettingsService.updateAiSettings(clinicId, updateDto);
  }
}
