import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runDaemonAction } from '../../api/pm2-process-api';
import type { DaemonAction } from '../../model/types';

interface RunDaemonActionInput {
  name: string;
  action: DaemonAction;
}

export const useDaemonAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, action }: RunDaemonActionInput) => runDaemonAction(name, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm2', 'daemons'] });
    },
  });
};
