import { BodyTrackerService } from '../services/BodyTrackerService';

describe('BodyTrackerService', () => {
  it('should be defined', () => {
    expect(BodyTrackerService).toBeDefined();
  });

  it('should have uploadProgressPhoto method', () => {
    expect(BodyTrackerService.prototype.uploadProgressPhoto).toBeDefined();
  });

  it('should have getProgressPhotoGallery method', () => {
    expect(BodyTrackerService.prototype.getProgressPhotoGallery).toBeDefined();
  });

  it('should have getProgressPhoto method', () => {
    expect(BodyTrackerService.prototype.getProgressPhoto).toBeDefined();
  });

  it('should have deleteProgressPhoto method', () => {
    expect(BodyTrackerService.prototype.deleteProgressPhoto).toBeDefined();
  });

  it('should have getPhotoComparison method', () => {
    expect(BodyTrackerService.prototype.getPhotoComparison).toBeDefined();
  });

  it('should have updateProgressPhotoNotes method', () => {
    expect(BodyTrackerService.prototype.updateProgressPhotoNotes).toBeDefined();
  });

  it('should have logWeight method', () => {
    expect(BodyTrackerService.prototype.logWeight).toBeDefined();
  });

  it('should have getWeightHistory method', () => {
    expect(BodyTrackerService.prototype.getWeightHistory).toBeDefined();
  });

  it('should have updateWeight method', () => {
    expect(BodyTrackerService.prototype.updateWeight).toBeDefined();
  });

  it('should have deleteWeight method', () => {
    expect(BodyTrackerService.prototype.deleteWeight).toBeDefined();
  });

  it('should have logMeasurement method', () => {
    expect(BodyTrackerService.prototype.logMeasurement).toBeDefined();
  });

  it('should have getMeasurementHistory method', () => {
    expect(BodyTrackerService.prototype.getMeasurementHistory).toBeDefined();
  });

  it('should have updateMeasurement method', () => {
    expect(BodyTrackerService.prototype.updateMeasurement).toBeDefined();
  });

  it('should have deleteMeasurement method', () => {
    expect(BodyTrackerService.prototype.deleteMeasurement).toBeDefined();
  });
});
