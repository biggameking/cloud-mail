import KvConst from '../const/kv-const';
import setting from '../entity/setting';
import orm from '../entity/orm';
import {verifyRecordType} from '../const/entity-const';
import fileUtils from '../utils/file-utils';
import r2Service from './r2-service';
import constant from '../const/constant';
import BizError from '../error/biz-error';
import {t} from '../i18n/i18n'
import verifyRecordService from './verify-record-service';
import userContext from '../security/user-context';

const SENSITIVE_SETTING_KEYS = [
	'secretKey', 'siteKey', 'tgBotToken', 'resendTokens', 's3AccessKey', 's3SecretKey'
];

const ALLOWED_BACKGROUND_TYPES = new Set([
	'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]);
const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;

function parseSecretJson(value, fallback = {}) {
	if (!value) return fallback;
	try {
		return typeof value === 'string' ? JSON.parse(value) : value;
	} catch {
		throw new BizError('Invalid secret JSON configuration', 500);
	}
}

function applyRuntimeConfiguration(c, storedSetting) {
	const runtimeSetting = { ...storedSetting };
	let domainList = c.env.domain;

	if (typeof domainList === 'string') {
		try {
			domainList = JSON.parse(domainList);
		} catch {
			throw new BizError(t('notJsonDomain'));
		}
	}

	if (!Array.isArray(domainList) || domainList.length === 0) {
		throw new BizError(t('noDomainVariable'));
	}

	runtimeSetting.domainList = domainList.map(item => '@' + item);
	runtimeSetting.projectLink = c.env.project_link !== false && c.env.project_link !== 'false';
	runtimeSetting.linuxdoClientId = c.env.linuxdo_client_id;
	runtimeSetting.linuxdoCallbackUrl = c.env.linuxdo_callback_url;
	runtimeSetting.linuxdoSwitch = c.env.linuxdo_switch === true || c.env.linuxdo_switch === 'true';
	runtimeSetting.secretKey = c.env.TURNSTILE_SECRET_KEY || '';
	runtimeSetting.siteKey = c.env.TURNSTILE_SITE_KEY || '';
	runtimeSetting.tgBotToken = c.env.TELEGRAM_BOT_TOKEN || '';
	runtimeSetting.resendTokens = parseSecretJson(c.env.RESEND_TOKENS, {});
	runtimeSetting.s3AccessKey = c.env.S3_ACCESS_KEY || '';
	runtimeSetting.s3SecretKey = c.env.S3_SECRET_KEY || '';
	runtimeSetting.emailPrefixFilter = Array.isArray(runtimeSetting.emailPrefixFilter)
		? runtimeSetting.emailPrefixFilter
		: (runtimeSetting.emailPrefixFilter || '').split(',').filter(Boolean);

	return runtimeSetting;
}

const settingService = {

	async refresh(c) {
		const settingRow = await orm(c).select().from(setting).get();
		const cachedSetting = { ...settingRow };
		for (const key of SENSITIVE_SETTING_KEYS) delete cachedSetting[key];
		c.set('setting', cachedSetting);
		await c.env.kv.put(KvConst.SETTING, JSON.stringify(cachedSetting));
	},

	async query(c) {
		const storedSetting = c.get?.('setting')
			|| await c.env.kv.get(KvConst.SETTING, { type: 'json' });

		if (!storedSetting) {
			throw new BizError('数据库未初始化 Database not initialized.');
		}

		const runtimeSetting = applyRuntimeConfiguration(c, storedSetting);
		c.set?.('setting', runtimeSetting);
		return runtimeSetting;
	},

	async get(c, showSiteKey = false) {

		const [queriedSetting, recordList] = await Promise.all([
			await this.query(c),
			verifyRecordService.selectListByIP(c)
		]);


		const settingRow = structuredClone(queriedSetting);
		settingRow.siteKey = showSiteKey ? queriedSetting.siteKey : null;
		settingRow.secretKeyConfigured = Boolean(queriedSetting.secretKey);
		settingRow.siteKeyConfigured = Boolean(queriedSetting.siteKey);
		settingRow.telegramConfigured = Boolean(queriedSetting.tgBotToken);
		settingRow.resendConfiguredDomains = Object.keys(queriedSetting.resendTokens);
		settingRow.s3Configured = Boolean(queriedSetting.s3AccessKey && queriedSetting.s3SecretKey);
		settingRow.secretKey = null;
		settingRow.tgBotToken = null;
		settingRow.resendTokens = {};
		settingRow.s3AccessKey = null;
		settingRow.s3SecretKey = null;
		settingRow.hasR2 = !!c.env.r2
		settingRow.hasCfEmail = !!c.env.email

		let regVerifyOpen = false
		let addVerifyOpen = false

		recordList.forEach(row => {
			if (row.type === verifyRecordType.REG) {
				regVerifyOpen = row.count >= settingRow.regVerifyCount
			}
			if (row.type === verifyRecordType.ADD) {
				addVerifyOpen = row.count >= settingRow.addVerifyCount
			}
		})

		settingRow.regVerifyOpen = regVerifyOpen
		settingRow.addVerifyOpen = addVerifyOpen

		settingRow.storageType = await r2Service.storageType(c);

		return settingRow;
	},

	async set(c, params) {
		params = { ...params };
		for (const key of SENSITIVE_SETTING_KEYS) delete params[key];

		if (Array.isArray(params.emailPrefixFilter)) {
			params.emailPrefixFilter = params.emailPrefixFilter + '';
		}

		if (Array.isArray(params.aiCodeFilter)) {
			params.aiCodeFilter = params.aiCodeFilter + '';
		}

		await orm(c).update(setting).set({ ...params }).returning().get();
		await this.refresh(c);
	},

	async deleteBackground(c) {

		const { background } = await this.query(c);
		if (!background) return

		if (background.startsWith('http')) {
			await orm(c).update(setting).set({ background: '' }).run();
			await this.refresh(c)
			return;
		}

		if (background) {
			await r2Service.delete(c,background)
			await orm(c).update(setting).set({ background: '' }).run();
			await this.refresh(c)
		}
	},

	async setBackground(c, params) {

		let { background } = params
		if (background?.startsWith('http')) {
			throw new BizError('Remote background URLs are disabled for privacy', 400);
		}

		await this.deleteBackground(c);

		if (background) {
			if (typeof background !== 'string' || background.length > Math.ceil(MAX_BACKGROUND_BYTES * 4 / 3) + 128) {
				throw new BizError('Background image exceeds the 5 MiB limit', 413);
			}

			const file = fileUtils.base64ToFile(background)
			if (!ALLOWED_BACKGROUND_TYPES.has(file.type) || file.size > MAX_BACKGROUND_BYTES) {
				throw new BizError('Only JPEG, PNG, WebP, or GIF background images up to 5 MiB are allowed', 400);
			}

			const arrayBuffer = await file.arrayBuffer();
			background = constant.BACKGROUND_PREFIX + await fileUtils.getBuffHash(arrayBuffer) + fileUtils.getExtFileName(file.name);


			await r2Service.putObj(c, background, arrayBuffer, {
				contentType: file.type,
				cacheControl: `public, max-age=31536000, immutable`,
				contentDisposition: `inline; filename="${file.name}"`
			});

		}

		await orm(c).update(setting).set({ background }).run();
		await this.refresh(c);
		return background;
	},


	async setBlacklist(c, params) {
		const { blackSubject, blackContent, blackFrom  } = params
		await orm(c).update(setting).set({ blackSubject, blackContent, blackFrom }).run();
		await this.refresh(c);
		return this.get(c);
	},

	async websiteConfig(c) {

		const settingRow = await this.get(c, true);
		const token = await userContext.getToken(c);

		return {
			register: settingRow.register,
			title: settingRow.title,
			manyEmail: settingRow.manyEmail,
			addEmail: settingRow.addEmail,
			autoRefresh: settingRow.autoRefresh,
			addEmailVerify: settingRow.addEmailVerify,
			registerVerify: settingRow.registerVerify,
			send: settingRow.send,
			r2Domain: settingRow.r2Domain,
			siteKey: settingRow.siteKey,
			background: settingRow.background,
			loginOpacity: settingRow.loginOpacity,
			domainList: settingRow.loginDomain === 1 && !token ? [] : settingRow.domainList,
			regKey: settingRow.regKey,
			regVerifyOpen: settingRow.regVerifyOpen,
			addVerifyOpen: settingRow.addVerifyOpen,
			noticeTitle: settingRow.noticeTitle,
			noticeContent: settingRow.noticeContent,
			noticeType: settingRow.noticeType,
			noticeDuration: settingRow.noticeDuration,
			noticePosition: settingRow.noticePosition,
			noticeWidth: settingRow.noticeWidth,
			noticeOffset: settingRow.noticeOffset,
			notice: settingRow.notice,
			loginDomain: settingRow.loginDomain,
			linuxdoClientId: settingRow.linuxdoClientId,
			linuxdoCallbackUrl: settingRow.linuxdoCallbackUrl,
			linuxdoSwitch: settingRow.linuxdoSwitch,
			minEmailPrefix: settingRow.minEmailPrefix,
			adminAggregateInbox: settingRow.adminAggregateInbox,
			projectLink: settingRow.projectLink
		};
	},

};

export default settingService;
