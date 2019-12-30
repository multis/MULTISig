const GSNMultiSigWalletWithDailyLimit = artifacts.require('GSNMultiSigWalletWithDailyLimit')
const web3 = GSNMultiSigWalletWithDailyLimit.web3
const deployMultisig = (owners, confirmations, limit) => {
    return GSNMultiSigWalletWithDailyLimit.new(owners, confirmations, limit);
}

const utils = require('./utils')
const ONE_DAY = 24 * 3600

contract('GSNMultiSigWalletWithDailyLimit', (accounts) => {
    let multisigInstance;
    const dailyLimit = web3.utils.toWei("3", "ether");
    const requiredConfirmations = 2;
    const initialDeposit = web3.utils.toWei("10", "ether");

    beforeEach(async () => {
        multisigInstance = await deployMultisig([accounts[0], accounts[1]], requiredConfirmations, dailyLimit);
        assert.ok(multisigInstance)

        // Send money to wallet contract
        await web3.eth.sendTransaction({ to: multisigInstance.address, value: initialDeposit, from: accounts[0] })
    })

    it('create multisig', async () => {
        assert.equal(dailyLimit, await multisigInstance.dailyLimit())
        assert.equal(dailyLimit, await multisigInstance.calcMaxWithdraw())
    })

    it('receive deposits', async () => {
        const balance = await utils.balanceOf(web3, multisigInstance.address)
        assert.equal(balance.valueOf(), initialDeposit)
    })

    it('withdraw below daily limit', async () => {
        const balance = await utils.balanceOf(web3, multisigInstance.address)

        // Withdraw below daily limit
        const value1 = web3.utils.toWei("1", "ether");
        let account0Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.submitTransaction(accounts[0], value1, '0x', { from: accounts[1] })
        const value1BN = web3.utils.toBN(value1.toString())

        assert.equal(
            account0Balance.add(value1BN).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            balance.sub(value1BN).toString(),
            (await utils.balanceOf(web3, multisigInstance.address)).toString()
        )

    })

    it('update daily limit', async () => {
        const dailyLimitUpdated = web3.utils.toWei("2", "ether");
        const withdrawAmount = web3.utils.toWei("2", "ether");
        await multisigInstance.submitTransaction(accounts[0], withdrawAmount, '0x', { from: accounts[1] })

        const dailyLimitEncoded = multisigInstance.contract.methods.changeDailyLimit(dailyLimitUpdated).encodeABI();
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.submitTransaction(multisigInstance.address, 0, dailyLimitEncoded, { from: accounts[0] }),
            'transactionId', null, 'Submission')

        await multisigInstance.confirmTransaction(transactionId, { from: accounts[1] })
        assert.equal(dailyLimitUpdated, await multisigInstance.dailyLimit())
        assert.equal(0, await multisigInstance.calcMaxWithdraw())

        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(dailyLimitUpdated.toString(), (await multisigInstance.calcMaxWithdraw()).toString())
    })
})