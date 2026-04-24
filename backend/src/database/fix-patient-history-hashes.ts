/**
 * One-shot migration: recompute phoneHash on PatientHistory records that
 * were persisted with hashes derived from encrypted ciphertext instead of
 * plaintext (caused by a prior .lean() call in AppointmentsService).
 *
 * Run with: npx ts-node src/database/fix-patient-history-hashes.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { computeBlindIndex, decrypt, deriveFieldKey, isEncrypted } from '../gdpr/encryption/encryption.util';

dotenv.config();

async function main(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;
  const encKeyHex = process.env.FIELD_ENCRYPTION_KEY;

  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  if (!encKeyHex) throw new Error('FIELD_ENCRYPTION_KEY is not set');

  const masterKey = Buffer.from(encKeyHex, 'hex');
  const phoneKey = deriveFieldKey(masterKey, 'PatientHistory.phone');

  await mongoose.connect(mongoUri);
  const collection = mongoose.connection.collection('patienthistories');

  const cursor = collection.find({});
  let scanned = 0;
  let fixed = 0;
  let skipped = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    scanned++;

    const storedPhone = doc.phone as string | undefined;
    if (!storedPhone || !isEncrypted(storedPhone)) {
      skipped++;
      continue;
    }

    let plaintextPhone: string;
    try {
      plaintextPhone = decrypt(storedPhone, phoneKey);
    } catch {
      console.warn(`[skip] could not decrypt phone on _id=${doc._id}`);
      skipped++;
      continue;
    }

    const normalised = normalisePhone(plaintextPhone);
    const correctHash = computeBlindIndex(normalised, phoneKey);

    if (doc.phoneHash === correctHash) {
      skipped++;
      continue;
    }

    await collection.updateOne(
      { _id: doc._id },
      { $set: { phoneHash: correctHash } },
    );
    fixed++;
    console.log(`[fixed] _id=${doc._id} clinicId=${doc.clinicId}`);
  }

  console.log(`\nDone. scanned=${scanned} fixed=${fixed} skipped=${skipped}`);
  await mongoose.disconnect();
}

function normalisePhone(phone: string): string {
  const stripped = phone.replace(/\s+/g, '').replace(/[()+-]/g, '');
  if (stripped.startsWith('44') && stripped.length > 10) {
    return '0' + stripped.slice(2);
  }
  return stripped;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
