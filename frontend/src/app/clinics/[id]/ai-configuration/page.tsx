'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getClinicById } from '@/data/mockClinics';
import ToneSelector from '@/components/AIConfiguration/ToneSelector';
import GreetingMessage from '@/components/AIConfiguration/GreetingMessage';
import QualificationQuestions from '@/components/AIConfiguration/QualificationQuestions';
import CustomInstructions from '@/components/AIConfiguration/CustomInstructions';
import ServicesLocations from '@/components/AIConfiguration/ServicesLocations';
import { AITone, QualificationQuestion, ServicesAndLocations } from '@/types/clinic';

/**
 * AI Configuration page for a specific clinic.
 * Manages local state for all config sections and renders
 * them in the order shown in the prototype design.
 */
export default function AIConfigurationPage() {
  const params = useParams();
  const clinicId = params.id as string;
  const clinic = getClinicById(clinicId);

  // Local state for each configuration section
  const [tone, setTone] = useState<AITone>('professional');
  const [greeting, setGreeting] = useState('');
  const [questions, setQuestions] = useState<QualificationQuestion[]>([]);
  const [instructions, setInstructions] = useState('');
  const [services, setServices] = useState<ServicesAndLocations>({
    servicesOffered: [],
    serviceAreaPrefixes: [],
  });

  // Populate state from mock data when clinic is available
  useEffect(() => {
    if (!clinic) return;
    setTone(clinic.aiConfiguration.tone);
    setGreeting(clinic.aiConfiguration.greetingMessage);
    setQuestions(clinic.aiConfiguration.qualificationQuestions);
    setInstructions(clinic.aiConfiguration.customInstructions);
    setServices(clinic.services);
  }, [clinic]);

  if (!clinic) return null;

  return (
    <div>
      <ToneSelector value={tone} onChange={setTone} />
      <GreetingMessage value={greeting} onChange={setGreeting} />
      <QualificationQuestions questions={questions} onChange={setQuestions} />
      <CustomInstructions value={instructions} onChange={setInstructions} />
      <ServicesLocations value={services} onChange={setServices} />
    </div>
  );
}
