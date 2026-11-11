// Persistable diagnostics are fixed codes. A submitted notice is ephemeral and
// must be rendered as text, excluded from Durable Object records/deduplication.
const reasons = new Set([
  'authentication_required', 'route_mismatch', 'native_context_unavailable', 'details_loading',
  'context_mismatch', 'event_data_unavailable', 'existing_registration', 'pending_changes',
  'booking_unavailable', 'course_group_unavailable', 'eligibility_unavailable', 'assessment_review',
  'ambiguous_package', 'section_mismatch', 'duplicate_sections', 'course_load_timeout',
  'course_refresh_failed', 'request_blocked', 'request_check_failed', 'submission_uncertain',
  'action_timeout', 'booking_cancelled', 'unsupported_tss', 'payload_mismatch',
  'booking_context_changed', 'additional_choices', 'native_action_failed', 'warning_unavailable',
  'booking_error', 'previous_attempt', 'attempt_unavailable', 'session_expired', 'session_unavailable',
]);

export const bookingReason = value => reasons.has(value) ? value : undefined;
export const bookingNotice = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 4000) || undefined : undefined;
export const BOOKING_OUTCOMES = Object.freeze(['booked', 'waitlisted', 'unconfirmed']);
export const terminalBooking = value => ['submitted', 'stopped', 'error'].includes(value?.stage);
export function bookingResult(value, blocked = false) {
  const reason = bookingReason(blocked && value?.stage !== 'submitted' ? 'request_blocked' : value?.reason);
  const noticeMessage = value?.stage === 'submitted' ? bookingNotice(value.noticeMessage) : undefined;
  const outcome = value?.stage === 'submitted' && BOOKING_OUTCOMES.includes(value.outcome) ? value.outcome : undefined;
  return { stage: value?.stage, ...(reason ? { reason } : {}), ...(noticeMessage ? { noticeMessage } : {}), ...(outcome ? { outcome } : {}) };
}
