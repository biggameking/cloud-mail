import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/service/setting-service', () => ({ default: { query: vi.fn() } }));
vi.mock('../src/service/account-service', () => ({ default: { selectByEmailIncludeDel: vi.fn() } }));
vi.mock('../src/service/user-service', () => ({ default: { selectByIdIncludeDel: vi.fn() } }));
vi.mock('../src/service/email-service', () => ({
	default: {
		receive: vi.fn(),
		completeReceive: vi.fn()
	}
}));
vi.mock('../src/service/att-service', () => ({ default: { addAtt: vi.fn() } }));
vi.mock('../src/service/role-service', () => ({
	default: {
		selectByUserId: vi.fn(),
		hasAvailDomainPerm: vi.fn(() => true),
		isBanEmail: vi.fn(() => false)
	}
}));
vi.mock('../src/service/telegram-service', () => ({ default: { sendEmailToBot: vi.fn() } }));
vi.mock('../src/service/ai-service', () => ({ default: { extractCode: vi.fn(() => null) } }));

import { email } from '../src/email/email';
import settingService from '../src/service/setting-service';
import accountService from '../src/service/account-service';
import userService from '../src/service/user-service';
import emailService from '../src/service/email-service';
import { isDel, settingConst } from '../src/const/entity-const';

const rawMessage = [
	'From: External Sender <sender@example.net>',
	'To: inbox@echoec.com',
	'Subject: routing regression',
	'Message-ID: <routing-regression@example.net>',
	'MIME-Version: 1.0',
	'Content-Type: text/plain; charset=utf-8',
	'',
	'hello'
].join('\r\n');

function createMessage() {
	return {
		to: 'inbox@echoec.com',
		raw: new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(rawMessage));
				controller.close();
			}
		}),
		setReject: vi.fn(),
		forward: vi.fn()
	};
}

function configureSettings(overrides = {}) {
	settingService.query.mockResolvedValue({
		receive: settingConst.receive.OPEN,
		tgChatId: '',
		tgBotStatus: settingConst.tgBotStatus.CLOSE,
		forwardStatus: settingConst.forwardStatus.CLOSE,
		forwardEmail: '',
		ruleEmail: '',
		ruleType: -1,
		r2Domain: '',
		noRecipient: settingConst.noRecipient.OPEN,
		blackSubject: '',
		blackContent: '',
		blackFrom: '',
		aiCode: false,
		aiCodeFilter: '',
		...overrides
	});
}

describe('incoming mail routing boundaries', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		configureSettings();
		userService.selectByIdIncludeDel.mockResolvedValue({
			userId: 1,
			email: 'admin@echoec.com',
			isDel: isDel.NORMAL
		});
		emailService.receive.mockResolvedValue({ emailId: 1, userId: 1, accountId: 10 });
		emailService.completeReceive.mockResolvedValue({ emailId: 1, userId: 1, accountId: 10 });
	});

	it('rejects a soft-deleted mailbox without storing or forwarding', async () => {
		accountService.selectByEmailIncludeDel.mockResolvedValue({
			accountId: 10,
			userId: 1,
			email: 'inbox@echoec.com',
			isDel: isDel.DELETE
		});
		const message = createMessage();

		await email(message, { admin: 'admin@echoec.com' }, {});

		expect(message.setReject).toHaveBeenCalledWith('Recipient not found');
		expect(emailService.receive).not.toHaveBeenCalled();
		expect(message.forward).not.toHaveBeenCalled();
	});

	it('stores mail but does not forward when mailbox forwarding is disabled', async () => {
		accountService.selectByEmailIncludeDel.mockResolvedValue({
			accountId: 10,
			userId: 1,
			email: 'inbox@echoec.com',
			isDel: isDel.NORMAL,
			forwardEnabled: 0,
			forwardEmail: ''
		});
		const message = createMessage();

		await email(message, { admin: 'admin@echoec.com' }, {});

		expect(message.setReject).not.toHaveBeenCalled();
		expect(emailService.receive).toHaveBeenCalledOnce();
		expect(message.forward).not.toHaveBeenCalled();
	});

	it('forwards exactly once to the mailbox-specific target when enabled', async () => {
		accountService.selectByEmailIncludeDel.mockResolvedValue({
			accountId: 10,
			userId: 1,
			email: 'inbox@echoec.com',
			isDel: isDel.NORMAL,
			forwardEnabled: 1,
			forwardEmail: 'verified@example.net'
		});
		const message = createMessage();

		await email(message, { admin: 'admin@echoec.com' }, {});

		expect(emailService.receive).toHaveBeenCalledOnce();
		expect(message.forward).toHaveBeenCalledOnce();
		expect(message.forward).toHaveBeenCalledWith('verified@example.net');
	});
});
