/**
 * Service for looking up and persisting patient history records.
 *
 * Enables returning-patient detection at conversation start by querying
 * the PatientHistory collection keyed by { clinicId, phone } (high confidence)
 * or { clinicId, email } (medium confidence).
 *
 * All public methods return null / void on failure (null-on-failure pattern)
 * so any database error gracefully falls back to treating the lead as new.
 */
import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  PatientHistory,
  PatientHistoryDocument,
} from "../database/schemas/patient-history.schema";
import { computeBlindIndex, deriveFieldKey } from "../gdpr/encryption/encryption.util";

/** Result returned when a previous booking is found for this patient + clinic. */
export interface ReturningPatientResult {
  firstName: string;
  lastName?: string;
  validatedPostcode?: string;
  previousConversationId?: Types.ObjectId;
  lastBookedAt: Date;
  /** Confidence level of the match:
   *  - high:   phone match, booking within expiry window
   *  - medium: email-only match, booking within expiry window
   *  - stale:  match found but lastBookedAt is older than patientDataExpiryDays
   */
  confidence: "high" | "medium" | "stale";
}

@Injectable()
export class PatientHistoryService {
  private readonly logger = new Logger(PatientHistoryService.name);

  constructor(
    @InjectModel(PatientHistory.name)
    private readonly patientHistoryModel: Model<PatientHistoryDocument>,
  ) {}

  /**
   * Looks up a PatientHistory record for the given contact at the given clinic.
   *
   * Lookup order:
   *   1. Phone match (high confidence) - most reliable for SMS/WhatsApp channels.
   *   2. Email match (medium confidence) - fallback when phone is absent or unmatched.
   *
   * @param phone - Lead phone number from the GHL webhook payload.
   * @param email - Lead email address (optional).
   * @param clinicId - The clinic's MongoDB ObjectId string — scopes the lookup.
   * @param patientDataExpiryDays - Days before history is considered stale (default 365).
   * @returns ReturningPatientResult if a match is found, null otherwise.
   */
  async findReturningPatient(
    phone: string | undefined,
    email: string | undefined,
    clinicId: string,
    patientDataExpiryDays = 365,
  ): Promise<ReturningPatientResult | null> {
    try {
      const clinicObjectId = new Types.ObjectId(clinicId);

      // Phase 1: phone lookup via blind index (high confidence)
      if (phone) {
        const normalisedPhone = this.normalisePhone(phone);
        const hash = this.computePhoneHash(normalisedPhone);
        const query = hash
          ? { clinicId: clinicObjectId, phoneHash: hash }
          : { clinicId: clinicObjectId, phone: normalisedPhone };
        const record = await this.patientHistoryModel
          .findOne(query)
          .exec();

        if (record) {
          return this.buildResult(record, patientDataExpiryDays, "high");
        }
      }

      // Phase 2: email lookup (medium confidence fallback)
      if (email) {
        const normalisedEmail = email.toLowerCase().trim();
        const record = await this.patientHistoryModel
          .findOne({ clinicId: clinicObjectId, email: normalisedEmail })
          .exec();

        if (record) {
          return this.buildResult(record, patientDataExpiryDays, "medium");
        }
      }

      return null;
    } catch (error) {
      // Graceful degradation - any DB error falls back to new-patient flow
      this.logger.warn(
        `PatientHistory lookup failed for clinicId: ${clinicId} — ${(error as Error).message}. Treating as new patient.`,
      );
      return null;
    }
  }

  /**
   * Upserts a PatientHistory record after a successful booking.
   * Uses the { clinicId, phone } pair as the upsert key so re-bookings update
   * the existing record rather than creating duplicates.
   *
   * @param clinicId - Clinic ObjectId string.
   * @param phone - Lead's phone number.
   * @param email - Lead's email (optional).
   * @param firstName - Lead's first name.
   * @param lastName - Lead's last name (optional).
   * @param validatedPostcode - The postcode confirmed during this conversation.
   * @param conversationId - The conversation ObjectId for the completed booking.
   */
  async persistHistory(
    clinicId: string,
    phone: string | undefined,
    email: string | undefined,
    firstName: string,
    lastName: string | undefined,
    validatedPostcode: string | undefined,
    conversationId: Types.ObjectId,
  ): Promise<void> {
    if (!phone && !email) {
      this.logger.warn(
        `persistHistory called without phone or email — clinicId: ${clinicId}. Skipping.`,
      );
      return;
    }
    try {
      const clinicObjectId = new Types.ObjectId(clinicId);
      const sharedFields = {
        firstName,
        lastName,
        validatedPostcode: validatedPostcode?.toUpperCase(),
        previousConversationId: conversationId,
        lastBookedAt: new Date(),
      };

      if (phone) {
        const normalisedPhone = this.normalisePhone(phone);
        const hash = this.computePhoneHash(normalisedPhone);

        const filter = hash
          ? { clinicId: clinicObjectId, phoneHash: hash }
          : { clinicId: clinicObjectId, phone: normalisedPhone };

        await this.patientHistoryModel
          .findOneAndUpdate(
            filter,
            {
              $set: {
                ...sharedFields,
                phone: normalisedPhone,
                ...(hash ? { phoneHash: hash } : {}),
                email: email ? email.toLowerCase().trim() : undefined,
              },
            },
            { upsert: true, new: true },
          )
          .exec();
        this.logger.log(
          `PatientHistory persisted — clinicId: ${clinicId}, phone: ${normalisedPhone}`,
        );
      } else {
        const normalisedEmail = email!.toLowerCase().trim();
        await this.patientHistoryModel
          .findOneAndUpdate(
            { clinicId: clinicObjectId, email: normalisedEmail },
            {
              $set: { ...sharedFields, email: normalisedEmail },
            },
            { upsert: true, new: true },
          )
          .exec();
        this.logger.log(
          `PatientHistory persisted — clinicId: ${clinicId}, email: ${normalisedEmail}`,
        );
      }
    } catch (error) {
      // Never throw — a persistence failure must not block a confirmed booking
      this.logger.error(
        `Failed to persist PatientHistory — clinicId: ${clinicId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Computes a HMAC-SHA256 blind index for encrypted phone lookups.
   * Returns null when FIELD_ENCRYPTION_KEY is not configured (graceful fallback).
   */
  private computePhoneHash(normalisedPhone: string): string | null {
    const keyHex = process.env.FIELD_ENCRYPTION_KEY;
    if (!keyHex) return null;
    const masterKey = Buffer.from(keyHex, 'hex');
    const fieldKey = deriveFieldKey(masterKey, 'PatientHistory.phone');
    return computeBlindIndex(normalisedPhone, fieldKey);
  }

  /**
   * Strips common formatting from phone numbers for consistent storage and lookup.
   * e.g. "+44 7911 123456" → "07911123456"
   */
  private normalisePhone(phone: string): string {
    const stripped = phone.replace(/\s+/g, "").replace(/[()+-]/g, "");
    // Convert international UK prefix to national format
    if (stripped.startsWith("44") && stripped.length > 10) {
      return "0" + stripped.slice(2);
    }
    return stripped;
  }

  /**
   * Builds a ReturningPatientResult from a database record, applying stale-data logic.
   * If the booking is older than patientDataExpiryDays, confidence is downgraded to 'stale'.
   */
  private buildResult(
    record: PatientHistoryDocument,
    patientDataExpiryDays: number,
    baseConfidence: "high" | "medium",
  ): ReturningPatientResult {
    const daysSinceBooking =
      (Date.now() - record.lastBookedAt.getTime()) / 86_400_000;
    const isStale = daysSinceBooking > patientDataExpiryDays;

    return {
      firstName: record.firstName,
      lastName: record.lastName,
      validatedPostcode: record.validatedPostcode,
      previousConversationId: record.previousConversationId,
      lastBookedAt: record.lastBookedAt,
      confidence: isStale ? "stale" : baseConfidence,
    };
  }
}
