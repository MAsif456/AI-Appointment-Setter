import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { InboundWebhookDto } from "./dto/inbound-webhook.dto";
import { mapMessageTypeToChannel } from '../orchestrator/orchestrator.prompts';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  /**
   * Constructor.
   * @param conversationModel - The Mongoose model for conversations.
   * @param leadModel - The Mongoose model for leads.
   */
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
  ) {}

  /**
   * Find a conversation by ghlContactId and clinicId.
   * @param {string} ghlContactId - The GHL contact ID.
   * @param {Types.ObjectId} clinicId - The clinic ID.
   * @returns {Promise<ConversationDocument | null>} - The found conversation or null if not found.
   */
  async findByGhlContactId(
    ghlContactId: string,
    clinicId: Types.ObjectId,
  ): Promise<ConversationDocument | null> {
    return this.conversationModel.findOne({ ghlContactId, clinicId }).exec();
  }

  /**
   * Creates a new conversation context for a new lead.
   * If a lead with the given ghlContactId does not exist, a new lead is created.
   * A new conversation is then created with the given ghlConversationId and channel, and associated with the lead.
   * @param {Types.ObjectId} clinicId - The clinic ID.
   * @param {string} ghlContactId - The GHL contact ID.
   * @param {string} ghlConversationId - The GHL conversation ID.
   * @param {string} channel - The channel (e.g. "sms", "whatsapp").
   * @param {object} patientInfo - An object containing the lead's first name, phone number, and lead source.
   * @returns {Promise<ConversationDocument>} - A promise that resolves to the created conversation document.
   */
  async createForNewLead(
    clinicId: Types.ObjectId,
    ghlContactId: string,
    ghlConversationId: string,
    channel: string,
    patientInfo: {
      firstName: string;
      phone: string;
      email?: string;
      issue?: string;
      leadSource: string;
    },
  ): Promise<ConversationDocument> {
    let lead = await this.leadModel.findOne({ ghlContactId }).exec();

    // Fallback: if the GHL contact was deleted and re-created, the contactId
    // changes but the email/phone stays the same. Find the existing lead to
    // avoid E11000 duplicate key violations on { clinicId, email }.
    if (!lead && patientInfo.email) {
      lead = await this.leadModel.findOne({ clinicId, email: patientInfo.email }).exec();
      if (lead) {
        lead.ghlContactId = ghlContactId;
        lead.firstName = patientInfo.firstName;
        if (patientInfo.phone) lead.phone = patientInfo.phone;
        if (patientInfo.issue) lead.issue = patientInfo.issue;
        await lead.save();
        this.logger.log(`Re-linked existing lead to new ghlContactId: ${ghlContactId}`);
      }
    }

    if (!lead) {
      lead = await this.leadModel.create({
        clinicId,
        firstName: patientInfo.firstName,
        phone: patientInfo.phone,
        ...(patientInfo.email ? { email: patientInfo.email } : {}),
        ...(patientInfo.issue ? { issue: patientInfo.issue } : {}),
        leadSource: patientInfo.leadSource,
        preferredChannel: channel,
        ghlContactId,
      });
      this.logger.log(`Created new lead for ghlContactId: ${ghlContactId}`);
    }

    const conversation = await this.conversationModel.create({
      clinicId,
      leadId: lead._id,
      ghlContactId,
      ghlConversationId,
      phase: "greeting",
      channel,
      messageCount: 0,
      startedAt: new Date(),
    });

    this.logger.log(
      `Created conversation context for ghlContactId: ${ghlContactId}`,
    );
    return conversation;
  }

  /**
   * Find a conversation by ghlContactId and clinicId, or create a new one if not found.
   * @param {InboundWebhookDto} payload - The inbound webhook payload.
   * @param {Types.ObjectId} clinicId - The clinic ID.
   * @returns {Promise<ConversationDocument>} - A promise that resolves to the found or created conversation document.
   */
  async findOrCreate(
    payload: InboundWebhookDto,
    clinicId: Types.ObjectId,
  ): Promise<ConversationDocument> {
    const existing = await this.findByGhlContactId(payload.contactId, clinicId);

    if (existing) {
      return existing;
    }

    const channel = mapMessageTypeToChannel(payload.messageType);

    return this.createForNewLead(
      clinicId,
      payload.contactId,
      payload.conversationId,
      channel,
      {
        firstName: "Unknown",
        phone: payload.from || "unknown",
        leadSource: "other",
      },
    );
  }

  /**
   * Update the phase of a conversation.
   * @param {Types.ObjectId} conversationId - The conversation ID.
   * @param {string} newPhase - The new phase of the conversation.
   * @returns {Promise<ConversationDocument | null>} - A promise that resolves to the updated conversation document or null if not found.
   */
  async updatePhase(
    conversationId: Types.ObjectId,
    newPhase: string,
  ): Promise<ConversationDocument | null> {
    const conversation = await this.conversationModel
      .findByIdAndUpdate(conversationId, { phase: newPhase }, { returnDocument: 'after' })
      .exec();

    this.logger.log(
      `Updated conversation ${conversationId} phase to: ${newPhase}`,
    );
    return conversation;
  }

  /**
   * Flags a conversation for human follow-up after a service failure.
   * Sets requiresHumanIntervention and records the reason.
   */
  async flagForHumanIntervention(
    conversationId: Types.ObjectId,
    reason: string,
  ): Promise<void> {
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      requiresHumanIntervention: true,
      humanInterventionReason: reason,
      escalatedAt: new Date(),
      escalationReason: reason,
    });
    this.logger.log(`Conversation ${conversationId} flagged: ${reason}`);
  }

  /**
   * Updates the returning patient flags on a conversation document.
   * Called immediately after a PatientHistory match is found at conversation start.
   * @param {Types.ObjectId} conversationId - The conversation to update.
   * @param flags - The returning patient fields to write.
   */
  async updateReturningPatientFlags(
    conversationId: Types.ObjectId,
    flags: {
      isReturningPatient: boolean;
      previousConversationId?: Types.ObjectId;
      returningPatientConfidence?: string;
    },
  ): Promise<void> {
    await this.conversationModel
      .findByIdAndUpdate(conversationId, { $set: flags })
      .exec();
    this.logger.log(
      `Conversation ${conversationId} flagged as returning patient (confidence: ${flags.returningPatientConfidence ?? "unknown"})`,
    );
  }

  /**
   * Stores a key/value pair in the conversation's context Map.
   * @param {Types.ObjectId} conversationId - The conversation ID.
   * @param {string} key - The context key, e.g. "validatedPostcode".
   * @param {string} value - The value to store.
   */
  async setContext(
    conversationId: Types.ObjectId,
    key: string,
    value: string,
  ): Promise<void> {
    await this.conversationModel
      .findByIdAndUpdate(conversationId, {
        $set: { [`context.${key}`]: value },
      })
      .exec();
  }

  /**
   * Updates the GHL conversation ID on an existing conversation document.
   * Called when an inbound message arrives with a different conversationId than what is stored,
   * which happens when a new GHL thread is opened for a returning contact.
   */
  async updateGhlConversationId(
    conversationId: Types.ObjectId,
    ghlConversationId: string,
  ): Promise<void> {
    await this.conversationModel
      .findByIdAndUpdate(conversationId, { ghlConversationId })
      .exec();
  }

  /**
   * Looks up a lead document by its MongoDB ObjectId.
   * Used by the orchestrator to load patient details for multi-turn prompts.
   */
  async findLeadById(leadId: Types.ObjectId): Promise<LeadDocument | null> {
    return this.leadModel.findById(leadId).exec();
  }
}
