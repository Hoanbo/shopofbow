// src/services/agent/contracts/robotAdapter.ts
// BOW AGENT V3.3 — STEP 1: ROBOT ADAPTER CONTRACT (FUTURE-FACING)
//
// Defines high-level semantic capabilities for downstream physical or simulated robots
// (C:\BOW\bow-robot) without exposing hardware, drivers, pins, or low-level protocols.

export type RobotDirection = 'forward' | 'backward' | 'left' | 'right';

export interface RobotSpeechOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export interface RobotListenOptions {
  timeoutMs?: number;
  language?: string;
}

export interface RobotSensorSnapshot {
  batteryPercent: number;
  isCharging: boolean;
  temperatureCelsius?: number;
  obstaclesDetected?: boolean;
  activeSensors: string[];
  timestamp: string;
}

/**
 * RobotAdapter Interface
 * High-level semantic interface through which the Agent can communicate with a robot.
 * The Agent Core commands high-level intentions (speak, listen, move, stop);
 * the Robot implementation handles motors, sound cards, microphones, and sensors.
 */
export interface RobotAdapter {
  /**
   * Check if the robot connection is active and healthy
   */
  isOnline(): boolean;

  /**
   * Text-to-speech output through robot speaker
   */
  speak(text: string, options?: RobotSpeechOptions): Promise<void>;

  /**
   * Speech-to-text input through robot microphone
   */
  listen(options?: RobotListenOptions): Promise<string>;

  /**
   * High-level directional movement
   */
  move(direction: RobotDirection, durationMs?: number, speedPercent?: number): Promise<void>;

  /**
   * Immediate safety emergency stop
   */
  stop(): Promise<void>;

  /**
   * Read current telemetry and environment sensors
   */
  getSensorState(): Promise<RobotSensorSnapshot>;
}
