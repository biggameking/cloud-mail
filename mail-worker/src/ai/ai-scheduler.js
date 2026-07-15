import { isAiMonitorEnabled } from './ai-config';

const aiScheduler = {
	async run({ env }) {
		if (!isAiMonitorEnabled(env)) return { status: 'disabled' };
		// Due-monitor orchestration is introduced in Phase 2 after manual preview is accepted.
		return { status: 'idle' };
	}
};

export default aiScheduler;
