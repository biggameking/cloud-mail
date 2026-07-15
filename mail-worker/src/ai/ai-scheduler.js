import { isAiMonitorEnabled } from './ai-config';
import aiSchedulerService from '../service/ai-scheduler-service';
import aiRetentionService from '../service/ai-retention-service';

const aiScheduler = {
	async run({ env, cron }) {
		if (!isAiMonitorEnabled(env)) return { status: 'disabled' };
		try {
			const result = await aiSchedulerService.run({ env });
			if (cron !== '*/30 * * * *') await aiRetentionService.cleanup({ env });
			return result;
		} catch (error) {
			console.error('AI scheduler failed', { errorClass: error?.name || 'Error' });
			return { status: 'failed' };
		}
	}
};

export default aiScheduler;
