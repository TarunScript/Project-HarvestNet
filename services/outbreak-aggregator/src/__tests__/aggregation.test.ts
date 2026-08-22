/**
 * Tests for outbreak-aggregator — Section 4.3 aggregation logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { classifySeverity, runAggregation, diagnosisEvents, outbreakAlerts } from '../index.js';

describe('outbreak-aggregator', () => {
  describe('classifySeverity', () => {
    it('should classify 5-9 reports as "Watch"', () => {
      expect(classifySeverity(5)).toBe('Watch');
      expect(classifySeverity(9)).toBe('Watch');
    });

    it('should classify 10-19 reports as "Elevated"', () => {
      expect(classifySeverity(10)).toBe('Elevated');
      expect(classifySeverity(19)).toBe('Elevated');
    });

    it('should classify 20+ reports as "High"', () => {
      expect(classifySeverity(20)).toBe('High');
      expect(classifySeverity(100)).toBe('High');
    });
  });

  describe('runAggregation', () => {
    beforeEach(() => {
      diagnosisEvents.length = 0;
      outbreakAlerts.length = 0;
    });

    it('should not emit alert when below threshold', () => {
      for (let i = 0; i < 4; i++) {
        diagnosisEvents.push({
          event_id: `evt-${i}`,
          timestamp: new Date().toISOString(),
          geohash5km: 'tdr1w',
          crop: 'tomato',
          identified_condition: 'late_blight',
          confidence_score: 0.85,
          escalate_to_extension_officer: false,
        });
      }
      const alerts = runAggregation();
      expect(alerts.length).toBe(0);
    });

    it('should emit alert when threshold is reached', () => {
      for (let i = 0; i < 5; i++) {
        diagnosisEvents.push({
          event_id: `evt-${i}`,
          timestamp: new Date().toISOString(),
          geohash5km: 'tdr1w',
          crop: 'tomato',
          identified_condition: 'late_blight',
          confidence_score: 0.85,
          escalate_to_extension_officer: false,
        });
      }
      const alerts = runAggregation();
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.geohash5km).toBe('tdr1w');
      expect(alerts[0]!.condition).toBe('late_blight');
      expect(alerts[0]!.farmer_report_count).toBe(5);
      expect(alerts[0]!.severity).toBe('Watch');
    });

    it('should group by geohash AND condition separately', () => {
      for (let i = 0; i < 5; i++) {
        diagnosisEvents.push({
          event_id: `a-${i}`,
          timestamp: new Date().toISOString(),
          geohash5km: 'tdr1w',
          crop: 'tomato',
          identified_condition: 'late_blight',
          confidence_score: 0.85,
          escalate_to_extension_officer: false,
        });
      }
      for (let i = 0; i < 3; i++) {
        diagnosisEvents.push({
          event_id: `b-${i}`,
          timestamp: new Date().toISOString(),
          geohash5km: 'tdr1w',
          crop: 'rice',
          identified_condition: 'brown_spot',
          confidence_score: 0.9,
          escalate_to_extension_officer: false,
        });
      }
      const alerts = runAggregation();
      expect(alerts.length).toBe(1);
      expect(alerts[0]!.condition).toBe('late_blight');
    });

    it('should not count events outside the rolling window', () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      for (let i = 0; i < 5; i++) {
        diagnosisEvents.push({
          event_id: `old-${i}`,
          timestamp: oldDate,
          geohash5km: 'tdr1w',
          crop: 'tomato',
          identified_condition: 'late_blight',
          confidence_score: 0.85,
          escalate_to_extension_officer: false,
        });
      }
      const alerts = runAggregation();
      expect(alerts.length).toBe(0);
    });
  });
});
