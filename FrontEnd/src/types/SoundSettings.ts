// src/types/SoundSettings.ts
export interface SoundSettings {
  enabled: boolean;
  newOrderSound: boolean;
  nearFinishedSound: boolean;
  volume: number;
  hasCustomNewOrderSound: boolean;
  hasCustomNearFinishedSound: boolean;
  customNewOrderFileName?: string;
  customNearFinishedFileName?: string;
}