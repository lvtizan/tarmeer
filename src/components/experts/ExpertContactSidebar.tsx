'use client';

/**
 * ExpertContactSidebar — canonical import point for the expert contact controls.
 *
 * Both expert pages (ExpertDetailClient, ExpertProjectDetailClient) import the
 * inquiry form + phone reveal from here. The implementations are now thin
 * wrappers over the shared components so company + expert pages share one form
 * and one phone-reveal control.
 */

import UnifiedInquiryForm from '@/components/shared/UnifiedInquiryForm';
import PhoneRevealButton from '@/components/shared/PhoneRevealButton';

export function RevealExpertPhone({ expertId, isVn }: { expertId: number; isVn: boolean }) {
  return <PhoneRevealButton targetType="expert" targetId={expertId} isVn={isVn} variant="button" />;
}

export function ExpertInquiryForm({ expertId, isVn }: { expertId: number; isVn: boolean }) {
  return <UnifiedInquiryForm variant="expert" expertId={expertId} isVn={isVn} />;
}
