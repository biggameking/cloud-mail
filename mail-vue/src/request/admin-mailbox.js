import http from '@/axios/index.js';

export function adminMailboxUsers() {
    return http.get('/adminMailbox/users');
}

export function adminMailboxAccounts(userId, accountId, size, lastSort) {
    return http.get('/adminMailbox/accounts', {params: {userId, accountId, size, lastSort}});
}

export function adminMailboxList(params) {
    return http.get('/adminMailbox/list', {params});
}

export function adminMailboxLatest(params) {
    return http.get('/adminMailbox/latest', {params, noMsg: true, timeout: 35 * 1000});
}

export function adminMailboxSetAllReceive(accountId) {
    return http.put('/adminMailbox/setAllReceive', {accountId});
}

export function adminMailboxSetName(accountId, name) {
    return http.put('/adminMailbox/setName', {accountId, name});
}

export function adminMailboxSetForward(accountId, enabled, forwardEmail) {
    return http.put('/adminMailbox/setForward', {accountId, enabled, forwardEmail});
}
