import { isAiMonitorEnabled } from './ai-config';
import aiSchedulerService from '../service/ai-scheduler-service';

const aiScheduler = {
	async run({ env }) {
		if (!isAiMonitorEnabled(env)) return { status: 'disabled' };
		try {
			return await aiSchedulerService.run({ env });
		} catch (error) {
			console.error('AI scheduler failed', { errorClass: error?.name || 'Error' });
			return { status: 'failed' };
		}
	}
};

export default aiScheduler;
