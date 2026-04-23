/**
 * DeviceFingerprintService - Generates and manages device fingerprints for security
 * Used to identify devices and prevent unauthorized access
 */

import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export class DeviceFingerprintService {
  private static cachedFingerprint: string | null = null;

  /**
   * Generate a unique device fingerprint
   * Combines device info and a unique identifier
   */
  static async generateFingerprint(): Promise<string> {
    // Return cached fingerprint if available
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    try {
      // Try to retrieve stored fingerprint
      const storedFingerprint = await this.getStoredFingerprint();
      if (storedFingerprint) {
        this.cachedFingerprint = storedFingerprint;
        return storedFingerprint;
      }

      // Generate new fingerprint
      const fingerprint = await this.createNewFingerprint();
      await this.storeFingerprint(fingerprint);
      this.cachedFingerprint = fingerprint;

      return fingerprint;
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      // Fallback to UUID if fingerprint generation fails
      return uuidv4();
    }
  }

  /**
   * Get stored device fingerprint
   */
  private static async getStoredFingerprint(): Promise<string | null> {
    try {
      // Try Keychain first (more secure)
      const keychainResult = await Keychain.getGenericPassword({
        service: 'fitquest.device_fingerprint',
      });

      if (keychainResult && keychainResult.password) {
        return keychainResult.password;
      }

      // Fallback to AsyncStorage
      const asyncStorageFingerprint = await AsyncStorage.getItem('device_fingerprint');
      return asyncStorageFingerprint;
    } catch (error) {
      console.warn('Failed to retrieve stored fingerprint:', error);
      return null;
    }
  }

  /**
   * Store device fingerprint securely
   */
  private static async storeFingerprint(fingerprint: string): Promise<void> {
    try {
      // Store in Keychain (secure)
      await Keychain.setGenericPassword('fitquest_device_fingerprint', fingerprint, {
        service: 'fitquest.device_fingerprint',
      } as any);

      // Also store in AsyncStorage as backup
      await AsyncStorage.setItem('device_fingerprint', fingerprint);
    } catch (error) {
      console.error('Failed to store device fingerprint:', error);
      throw error;
    }
  }

  /**
   * Create a new device fingerprint
   * Combines device information with a unique identifier
   */
  private static async createNewFingerprint(): Promise<string> {
    try {
      const components = [
        Platform.OS, // iOS or Android
        Platform.Version?.toString() || 'unknown',
        await this.getDeviceModel(),
        await this.getDeviceManufacturer(),
        uuidv4(), // Unique identifier
      ];

      // Create fingerprint by joining components
      const fingerprint = components.join('|');

      // Hash the fingerprint for consistency
      return this.hashFingerprint(fingerprint);
    } catch (error) {
      console.error('Failed to create device fingerprint:', error);
      throw error;
    }
  }

  /**
   * Get device model
   */
  private static async getDeviceModel(): Promise<string> {
    try {
      // This would require react-native-device-info or similar
      // For now, return a placeholder
      return 'device_model';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get device manufacturer
   */
  private static async getDeviceManufacturer(): Promise<string> {
    try {
      // This would require react-native-device-info or similar
      // For now, return a placeholder
      return 'device_manufacturer';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Simple hash function for fingerprint
   * In production, use a proper cryptographic hash
   */
  private static hashFingerprint(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Verify device fingerprint matches stored fingerprint
   */
  static async verifyFingerprint(fingerprint: string): Promise<boolean> {
    try {
      const storedFingerprint = await this.getStoredFingerprint();
      return storedFingerprint === fingerprint;
    } catch (error) {
      console.error('Failed to verify device fingerprint:', error);
      return false;
    }
  }

  /**
   * Clear stored device fingerprint
   */
  static async clearFingerprint(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: 'fitquest.device_fingerprint' });
      await AsyncStorage.removeItem('device_fingerprint');
      this.cachedFingerprint = null;
    } catch (error) {
      console.error('Failed to clear device fingerprint:', error);
    }
  }
}

export default DeviceFingerprintService;
