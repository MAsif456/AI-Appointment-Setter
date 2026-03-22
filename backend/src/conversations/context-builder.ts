import { Types } from 'mongoose';
import { ClinicDocument } from '../database/schemas/clinic.schema';
import { LeadDocument } from '../database/schemas/lead.schema';
import { LeadInfo } from '../ai/interfaces/lead-info.interface';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

/**
 * Converts MongoDB Clinic + Lead documents into the AI service interfaces.
 * Extracts only the fields needed by the AI layer.
 * @param lead - The lead document from MongoDB
 * @param clinic - The clinic document from MongoDB
 * @returns LeadInfo and ClinicConfig for AI services
 */
export function buildContextFromDb(lead: LeadDocument, clinic: ClinicDocument) {
  const leadInfo: LeadInfo = {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    issue: lead.issue,
    leadSource: lead.leadSource,
  };

  const tone = clinic.aiConfig?.tone === 'professional' ? 'Professional' : 'Friendly';
  const clinicConfig: ClinicConfig = {
    clinicId: (clinic._id as Types.ObjectId).toString(),
    name: clinic.name,
    tone,
    greetingTemplate: clinic.aiConfig?.greetingTemplate || undefined,
    serviceAreas: clinic.serviceAreas?.map((sa) => sa.postcodePrefix) || [],
    customInstructions: clinic.aiConfig?.customInstructions || undefined,
    ghlLocationId: clinic.ghlLocationId,
    isActive: clinic.isActive,
  };

  return { leadInfo, clinicConfig };
}
