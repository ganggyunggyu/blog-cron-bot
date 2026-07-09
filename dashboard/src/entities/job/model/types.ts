export interface JobDefinition {
  id: string;
  label: string;
  description: string;
  riskNote?: string;
  isRunning: boolean;
}
