import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingNotice, bookingResult } from '../src/booking-result.mjs';

test('submitted warning text survives the browser result boundary, without unknown fields', () => {
  assert.deepEqual(bookingResult({ stage: 'submitted', noticeMessage: 'Waitlist warning.',
    reviewMessage: 'not a new confirmation', confirmationId: 'private', rawResponse: { student: 'private' } }),
  { stage: 'submitted', noticeMessage: 'Waitlist warning.' });
});

test('notice sanitizer accepts text only, removes controls and bounds length', () => {
  assert.equal(bookingNotice({ Message: 'object' }), undefined);
  assert.equal(bookingNotice(''), undefined);
  assert.equal(bookingNotice('\u0000\u0001'), undefined);
  assert.equal(bookingNotice('A\u0000B\nC\tD'), 'AB\nC\tD');
  assert.equal(bookingNotice('x'.repeat(4001)).length, 4000);
  assert.equal(bookingNotice('<img onerror=untrusted()>'), '<img onerror=untrusted()>');
});

test('non-submitted results cannot expose notices or change request-blocked behavior', () => {
  for (const stage of ['checking', 'submitting', 'review', 'stopped', 'error']) {
    assert.deepEqual(bookingResult({ stage, noticeMessage: 'hidden', reason: 'native-secret' }), { stage });
    assert.deepEqual(bookingResult({ stage, noticeMessage: 'hidden' }, true), { stage, reason: 'request_blocked' });
  }
  assert.deepEqual(bookingResult({ stage: 'submitted', noticeMessage: 'Late warning.' }, true),
    { stage: 'submitted', noticeMessage: 'Late warning.' });
});
