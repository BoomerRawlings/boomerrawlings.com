// Public booking diagnostics are fixed codes, never native messages or data.
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
export const terminalBooking = value => ['submitted', 'stopped', 'error'].includes(value?.stage);
export function bookingResult(value, blocked = false) {
  const reason = bookingReason(blocked && value?.stage !== 'submitted' ? 'request_blocked' : value?.reason);
  return { stage: value?.stage, ...(reason ? { reason } : {}) };
}
