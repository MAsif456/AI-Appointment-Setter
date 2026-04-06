import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  PatientHistory,
  PatientHistorySchema,
} from "../database/schemas/patient-history.schema";
import { PatientHistoryService } from "./patient-history.service";

/**
 * Feature module for the PatientHistory collection.
 * Exports PatientHistoryService so OrchestratorModule and AppointmentsModule
 * can both consume it without re-declaring the provider.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatientHistory.name, schema: PatientHistorySchema },
    ]),
  ],
  providers: [PatientHistoryService],
  exports: [PatientHistoryService],
})
export class PatientHistoryModule {}
