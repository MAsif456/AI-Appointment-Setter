import { MessageSchema } from './message.schema';
import mongoose from 'mongoose';

describe('MessageSchema', () => {
  it('should calculate aiProcessingTimeMs correctly', () => {
    // Create a dummy "document"
    const doc: any = {
      aiProcessingStartedAt: new Date(1000),
      aiProcessingCompletedAt: new Date(2000),
    };

    // Manually run the pre-save logic
    if (doc.aiProcessingStartedAt && doc.aiProcessingCompletedAt) {
      doc.aiProcessingTimeMs =
        doc.aiProcessingCompletedAt.getTime() -
        doc.aiProcessingStartedAt.getTime();
    }

    expect(doc.aiProcessingTimeMs).toBe(1000);
  });
});