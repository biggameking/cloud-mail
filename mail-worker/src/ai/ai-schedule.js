const offsetForTimezone = timezone => timezone === 'Asia/Shanghai' ? 480 : 0;

const localDateKey = (date, timezone) => {
	const shifted = new Date(date.getTime() + offsetForTimezone(timezone) * 60000);
	return shifted.toISOString().slice(0, 10);
};

const nextDailyRun = (scheduleTime, timezone, after = new Date()) => {
	const [hour, minute] = /^\d{2}:\d{2}$/.test(scheduleTime) ? scheduleTime.split(':').map(Number) : [8, 0];
	const offset = offsetForTimezone(timezone);
	const shifted = new Date(after.getTime() + offset * 60000);
	let target = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour, minute) - offset * 60000;
	if (target <= after.getTime()) target += 86400000;
	return new Date(target).toISOString();
};

export { localDateKey, nextDailyRun, offsetForTimezone };
