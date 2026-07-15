import { and, asc, count, desc, eq, gt, lt, ne } from 'drizzle-orm';
import orm from '../entity/orm';
import account from '../entity/account';
import email from '../entity/email';
import user from '../entity/user';
import { emailConst, isDel } from '../const/entity-const';
import BizError from '../error/biz-error';
import { t } from '../i18n/i18n';
import accountService from './account-service';
import emailService from './email-service';
import settingService from './setting-service';

const AGGREGATE_ENABLED = 0;

export function assertAdminMailboxAccess(currentUser, adminEmail) {
	if (!currentUser || currentUser.email !== adminEmail) {
		throw new BizError(t('unauthorized'), 403);
	}
}

export function resolveAdminMailboxScope(params, aggregateSetting) {
	const aggregate = params.scope === 'aggregate';
	if (aggregate) {
		if (aggregateSetting !== AGGREGATE_ENABLED) {
			throw new BizError(t('aggregateInboxDisabled'), 403);
		}
		return { aggregate: true, userId: 0 };
	}

	const userId = Number(params.userId);
	if (!Number.isInteger(userId) || userId <= 0) {
		throw new BizError(t('invalidMailboxUser'), 400);
	}
	return { aggregate: false, userId };
}

async function requireActiveUser(c, userId) {
	const row = await orm(c).select({ userId: user.userId, email: user.email })
		.from(user)
		.where(and(
			eq(user.userId, userId),
			eq(user.status, 0),
			eq(user.isDel, isDel.NORMAL),
			ne(user.email, c.env.admin)
		)).get();
	if (!row) throw new BizError(t('invalidMailboxUser'), 404);
	return row;
}

async function getScope(c, params) {
	assertAdminMailboxAccess(c.get('user'), c.env.admin);
	const settings = await settingService.query(c);
	const scope = resolveAdminMailboxScope(params, settings.adminAggregateInbox);
	if (!scope.aggregate) await requireActiveUser(c, scope.userId);
	return scope;
}

function baseConditions(c, scope) {
	return [
		eq(email.type, emailConst.type.RECEIVE),
		eq(email.isDel, isDel.NORMAL),
		ne(email.status, emailConst.status.SAVING),
		eq(account.isDel, isDel.NORMAL),
		eq(user.isDel, isDel.NORMAL),
		eq(user.status, 0),
		scope.aggregate ? ne(user.email, c.env.admin) : eq(email.userId, scope.userId)
	];
}

const adminMailboxService = {
	async users(c) {
		assertAdminMailboxAccess(c.get('user'), c.env.admin);
		const list = await orm(c).select({
			userId: user.userId,
			email: user.email,
			accountId: account.accountId,
			accountEmail: account.email,
			accountName: account.name,
			allReceive: account.allReceive,
			forwardEnabled: account.forwardEnabled,
			forwardEmail: account.forwardEmail,
			sort: account.sort
		})
			.from(user)
			.leftJoin(account, and(
				eq(account.userId, user.userId),
				eq(account.email, user.email),
				eq(account.status, 0),
				eq(account.isDel, isDel.NORMAL)
			))
			.where(and(
				eq(user.status, 0),
				eq(user.isDel, isDel.NORMAL),
				ne(user.email, c.env.admin)
			))
			.orderBy(asc(user.email)).all();
		await accountService.addUnreadCounts(c, list);
		return list;
	},

	async accounts(c, params) {
		assertAdminMailboxAccess(c.get('user'), c.env.admin);
		const userId = Number(params.userId);
		if (!Number.isInteger(userId) || userId <= 0) {
			throw new BizError(t('invalidMailboxUser'), 400);
		}
		await requireActiveUser(c, userId);
		return accountService.list(c, params, userId);
	},

	async list(c, params) {
		const scope = await getScope(c, params);
		let emailId = Number(params.emailId);
		let size = Math.min(Math.max(Number(params.size) || 50, 1), 50);
		const timeSort = Number(params.timeSort) ? 1 : 0;
		const accountId = Number(params.accountId);
		if (!emailId) emailId = timeSort ? 0 : 9999999999;

		const conditions = baseConditions(c, scope);
		if (!scope.aggregate && Number(params.allReceive) !== 1 && accountId > 0) {
			conditions.push(eq(email.accountId, accountId));
		}
		const pageConditions = [...conditions, timeSort ? gt(email.emailId, emailId) : lt(email.emailId, emailId)];

		const query = orm(c).select({ ...email, userEmail: user.email })
			.from(email)
			.leftJoin(account, eq(account.accountId, email.accountId))
			.leftJoin(user, eq(user.userId, email.userId))
			.where(and(...pageConditions));
		query.orderBy(timeSort ? asc(email.emailId) : desc(email.emailId));

		const countQuery = orm(c).select({ total: count() })
			.from(email)
			.leftJoin(account, eq(account.accountId, email.accountId))
			.leftJoin(user, eq(user.userId, email.userId))
			.where(and(...conditions)).get();

		const latestQuery = orm(c).select({ ...email, userEmail: user.email })
			.from(email)
			.leftJoin(account, eq(account.accountId, email.accountId))
			.leftJoin(user, eq(user.userId, email.userId))
			.where(and(...conditions))
			.orderBy(desc(email.emailId)).limit(1).get();

		let [list, totalRow, latestEmail] = await Promise.all([query.limit(size).all(), countQuery, latestQuery]);
		list = list.map(row => ({ ...row, isStar: 0 }));
		await emailService.emailAddAtt(c, list);
		latestEmail ||= { emailId: 0, accountId: accountId || 0, userId: scope.userId };
		return { list, total: totalRow.total, latestEmail };
	},

	async latest(c, params) {
		const scope = await getScope(c, params);
		const conditions = baseConditions(c, scope);
		const accountId = Number(params.accountId);
		if (!scope.aggregate && Number(params.allReceive) !== 1 && accountId > 0) {
			conditions.push(eq(email.accountId, accountId));
		}
		conditions.push(gt(email.emailId, Number(params.emailId) || 0));

		const list = await orm(c).select({ ...email, userEmail: user.email })
			.from(email)
			.leftJoin(account, eq(account.accountId, email.accountId))
			.leftJoin(user, eq(user.userId, email.userId))
			.where(and(...conditions))
			.orderBy(desc(email.emailId)).limit(20).all();
		await emailService.emailAddAtt(c, list);
		return list.map(row => ({ ...row, isStar: 0 }));
	},

	async setAllReceive(c, params) {
		assertAdminMailboxAccess(c.get('user'), c.env.admin);
		const accountRow = await accountService.selectById(c, Number(params.accountId));
		if (!accountRow) throw new BizError(t('invalidMailboxAccount'), 404);
		await requireActiveUser(c, accountRow.userId);
		await accountService.setAllReceive(c, params, accountRow.userId);
	},

	async setName(c, params) {
		assertAdminMailboxAccess(c.get('user'), c.env.admin);
		const accountRow = await accountService.selectById(c, Number(params.accountId));
		if (!accountRow) throw new BizError(t('invalidMailboxAccount'), 404);
		await requireActiveUser(c, accountRow.userId);
		await accountService.setName(c, params, accountRow.userId);
	},

	async setForward(c, params) {
		assertAdminMailboxAccess(c.get('user'), c.env.admin);
		const accountRow = await accountService.selectById(c, Number(params.accountId));
		if (!accountRow) throw new BizError(t('invalidMailboxAccount'), 404);
		await requireActiveUser(c, accountRow.userId);
		await accountService.setForward(c, params, c.get('user').userId);
	}
};

export default adminMailboxService;
