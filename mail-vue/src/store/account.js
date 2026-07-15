    import { defineStore } from 'pinia'

export const useAccountStore = defineStore('account', {
    state: () => ({
        currentAccountId: 0,
        currentAccount: {},
        changeUserAccountName: '',
        mailboxScope: 'self',
        viewUserId: 0,
        viewUserEmail: ''
    })
})
