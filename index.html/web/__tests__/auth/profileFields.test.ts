import { describe, expect, it } from 'vitest';
import {
  EMPTY_COGNITIVE_PROFILE,
  validateCognitiveProfile,
} from '../../lib/profileFields';

describe('validateCognitiveProfile', () => {
  it('requires a name on sign-up', () => {
    const r = validateCognitiveProfile(EMPTY_COGNITIVE_PROFILE, { requireName: true });
    expect(r.ok).toBe(false);
    expect(r.errors.fullName).toBe('nameRequired');
  });

  it('passes a name-locked edit with an empty name field', () => {
    const r = validateCognitiveProfile(EMPTY_COGNITIVE_PROFILE, { requireName: false });
    expect(r.ok).toBe(true);
    expect(r.value?.full_name).toBeNull();
  });

  it('maps blank optional fields to null ("미표기")', () => {
    const r = validateCognitiveProfile(
      { ...EMPTY_COGNITIVE_PROFILE, fullName: '황두영' },
      { requireName: true },
    );
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ blood: null, mbti: null, iq: null, eq: null, age: null });
  });

  it('flags an out-of-range IQ / age but keeps valid ones', () => {
    const bad = validateCognitiveProfile(
      { ...EMPTY_COGNITIVE_PROFILE, fullName: 'A', iq: '999', age: '9' },
      { requireName: true },
    );
    expect(bad.errors.iq).toBe('iqRange');
    expect(bad.errors.age).toBe('ageRange');

    const good = validateCognitiveProfile(
      { ...EMPTY_COGNITIVE_PROFILE, fullName: 'A', iq: '128', eq: '110', age: '37', mbti: 'INTJ', blood: 'O', gender: 'male' },
      { requireName: true },
    );
    expect(good.ok).toBe(true);
    expect(good.value).toMatchObject({ iq: 128, eq: 110, age: 37, mbti: 'INTJ', blood: 'O', gender: 'male' });
  });

  it('drops an unknown gender/mbti/blood value instead of trusting it', () => {
    const r = validateCognitiveProfile(
      { ...EMPTY_COGNITIVE_PROFILE, fullName: 'A', gender: 'xx', mbti: 'ZZZZ', blood: 'Z' },
      { requireName: true },
    );
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ gender: null, mbti: null, blood: null });
  });
});
