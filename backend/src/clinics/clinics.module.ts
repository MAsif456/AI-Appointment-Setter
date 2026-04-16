/**
 * NestJS module for clinic operations.
 * Registers the Clinic model, controller, and service.
 *
 * This module imports the MongooseModule and configures it to use the ClinicSchema for the Clinic model.
 * It includes the ClinicsController and ClinicsService, and exports the ClinicsService.
 */
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Clinic, ClinicSchema } from "../database/schemas/clinic.schema";
import {
  Conversation,
  ConversationSchema,
} from "../database/schemas/conversation.schema";
import { ClinicsController } from "./clinics.controller";
import { ClinicsService } from "./clinics.service";

/**
 * Feature module that wires up the Clinic Mongoose model,
 * the ClinicsController, and the ClinicsService.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clinic.name, schema: ClinicSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
  ],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
