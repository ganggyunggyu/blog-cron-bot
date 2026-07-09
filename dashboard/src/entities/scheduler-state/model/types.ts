export interface SchedulerStateInfo {
  key: string;
  label: string;
  runTimes: string[];
  lastRunByTime: Record<string, string>;
}
