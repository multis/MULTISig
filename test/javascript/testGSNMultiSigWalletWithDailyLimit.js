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
        const value1 = web3.utils.toWei("2", "ether");
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
        await multisigInstance.submitTransaction(accounts[0], dailyLimitUpdated, '0x', { from: accounts[1] })
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

    it('execute various limit scenarios', async () => {
        // Withdraw below daily limit
        const value1 = web3.utils.toWei("2", "ether");
        await multisigInstance.submitTransaction(accounts[0], value1, '0x', { from: accounts[1] })
        const value1BN = web3.utils.toBN(value1.toString())

        const dailyLimitUpdated = web3.utils.toWei("2", "ether");
        const dailyLimitUpdatedBN = web3.utils.toBN(dailyLimitUpdated)
        const dailyLimitEncoded = multisigInstance.contract.methods.changeDailyLimit(dailyLimitUpdated).encodeABI();
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.submitTransaction(multisigInstance.address, 0, dailyLimitEncoded, { from: accounts[0] }),
            'transactionId', null, 'Submission')
        await multisigInstance.confirmTransaction(transactionId, { from: accounts[1] })
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        const value2 = web3.utils.toWei("1", "ether");
        const value2BN = web3.utils.toBN(value2.toString())
        const initialDepositBN = web3.utils.toBN(initialDeposit.toString())

        let owner1Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.submitTransaction(accounts[0], value2, '0x', { from: accounts[1] })
        assert.equal(
            owner1Balance.add(value2BN),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )

        assert.equal(
            initialDepositBN.sub(value2BN).sub(value1BN),
            (await utils.balanceOf(web3, multisigInstance.address)).toString()
        )
        assert.equal(
            dailyLimitUpdatedBN - value2,
            (await multisigInstance.calcMaxWithdraw()).toString()
        )
        await multisigInstance.submitTransaction(accounts[0], value2, '0x', { from: accounts[1] })
        assert.equal(
            owner1Balance.add(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 2 - value1,
            (await utils.balanceOf(web3, multisigInstance.address)).toString()
        )
        assert.equal(
            dailyLimitUpdatedBN.sub(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await multisigInstance.calcMaxWithdraw()).toString()
        )

        // Third time fails, because daily limit was reached
        const transactionIdFailed = utils.getParamFromTxEvent(
            await multisigInstance.submitTransaction(accounts[0], value2, '0x', { from: accounts[1] }),
            'transactionId', null, 'Submission')
        assert.equal(false, (await multisigInstance.transactions(transactionIdFailed))[3])
        assert.equal(
            owner1Balance.add(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN.sub(value2BN.mul(web3.utils.toBN("2"))).sub(value1BN).toString(),
            (await utils.balanceOf(web3, multisigInstance.address)).toString()
        )
        assert.equal(
            0,
            await multisigInstance.calcMaxWithdraw()
        )

        // Let one day pass
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(dailyLimitUpdatedBN.toString(), (await multisigInstance.calcMaxWithdraw()).toString())

        // Execute transaction should work now but fails, because it is triggered from a non owner address
        utils.assertThrowsAsynchronously(
            () => multisigInstance.executeTransaction(transactionIdFailed, { from: accounts[9] })
        )
        // Execute transaction also fails if the sender is a wallet owner but didn't confirm the transaction first
        utils.assertThrowsAsynchronously(
            () => multisigInstance.executeTransaction(transactionIdFailed, { from: accounts[0] })
        )
        // But it works with the right sender
        await multisigInstance.executeTransaction(transactionIdFailed, { from: accounts[1] })
        assert.ok((await multisigInstance.transactions(transactionIdFailed))[3])

        // Let one day pass
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(
            dailyLimitUpdated,
            await multisigInstance.calcMaxWithdraw()
        )

        // User wants to withdraw more than the daily limit. Withdraw is unsuccessful.
        const value3 = web3.utils.toWei("3", "ether");
        owner1Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.submitTransaction(accounts[0], value3, '0x', { from: accounts[1] })

        // Wallet and user balance remain the same.
        assert.equal(
            owner1Balance,
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 3 - value1,
            await utils.balanceOf(web3, multisigInstance.address)
        )
        assert.equal(
            dailyLimitUpdated,
            await multisigInstance.calcMaxWithdraw()
        )

        // Daily withdraw is possible again
        await multisigInstance.submitTransaction(accounts[0], value2, '0x', { from: accounts[1] })

        // Wallet balance decreases and user balance increases.
        assert.equal(
            owner1Balance.add(value2BN),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 4 - value1,
            await utils.balanceOf(web3, multisigInstance.address)
        )
        assert.equal(
            dailyLimitUpdated - value2,
            await multisigInstance.calcMaxWithdraw()
        )
        // Try to execute a transaction tha does not exist fails
        const unknownTransactionId = 999
        utils.assertThrowsAsynchronously(
            () => multisigInstance.executeTransaction(unknownTransactionId, { from: accounts[0] })
        )
    })
})