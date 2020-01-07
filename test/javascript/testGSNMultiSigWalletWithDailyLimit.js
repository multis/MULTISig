const { TestHelper } = require('@openzeppelin/cli');
const { Contracts, ZWeb3 } = require('@openzeppelin/upgrades');

global.web3 = web3;
ZWeb3.initialize(web3.currentProvider);

const GSNMultiSigWalletWithDailyLimit = Contracts.getFromLocal('GSNMultiSigWalletWithDailyLimit');

const utils = require('./utils')
const ONE_DAY = 24 * 3600
const GAS = 9721975

describe('GSNMultiSigWalletWithDailyLimit', () => {
    let multisigInstance, accounts;
    const dailyLimit = web3.utils.toWei("3", "ether");
    const requiredConfirmations = 2;
    const initialDeposit = web3.utils.toWei("10", "ether");

    beforeEach(async () => {
        accounts = await ZWeb3.accounts();
        this.project = await TestHelper();
        multisigInstance = await this.project.createProxy(GSNMultiSigWalletWithDailyLimit, {
            initMethod: 'initialize',
            initArgs: [[accounts[0], accounts[1]], requiredConfirmations, dailyLimit],
            from: accounts[1]
        });

        assert.ok(multisigInstance)

        // Send money to wallet contract
        await web3.eth.sendTransaction({ to: multisigInstance.options.address, value: initialDeposit, from: accounts[0] })
    })

    it('create multisig', async () => {
        assert.equal(dailyLimit, await multisigInstance.methods.dailyLimit().call())
        assert.equal(dailyLimit, await multisigInstance.methods.calcMaxWithdraw().call())
    })

    it('receive deposits', async () => {
        const balance = await utils.balanceOf(web3, multisigInstance.options.address)
        assert.equal(balance.valueOf(), initialDeposit)
    })

    it('withdraw below daily limit', async () => {
        const balance = await utils.balanceOf(web3, multisigInstance.options.address)

        // Withdraw below daily limit
        const value1 = web3.utils.toWei("2", "ether");
        let account0Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.methods.submitTransaction(accounts[0], value1, '0x').send({ from: accounts[1], gas: GAS })
        const value1BN = web3.utils.toBN(value1.toString())

        assert.equal(
            account0Balance.add(value1BN).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            balance.sub(value1BN).toString(),
            (await utils.balanceOf(web3, multisigInstance.options.address)).toString()
        )

    })

    it('update daily limit', async () => {
        const dailyLimitUpdated = web3.utils.toWei("2", "ether");
        await multisigInstance.methods.submitTransaction(accounts[0], dailyLimitUpdated, '0x').send({ from: accounts[1], gas: GAS })
        const dailyLimitEncoded = multisigInstance.methods.changeDailyLimit(dailyLimitUpdated).encodeABI();
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, dailyLimitEncoded).send({ from: accounts[1], gas: GAS }),
            'transactionId', null, 'Submission')

        await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[0], value: 0, gas: GAS })
        assert.equal(dailyLimitUpdated, await multisigInstance.methods.dailyLimit().call())
        assert.equal(0, await multisigInstance.methods.calcMaxWithdraw().call())

        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(dailyLimitUpdated.toString(), (await multisigInstance.methods.calcMaxWithdraw().call()).toString())
    })

    it('execute various limit scenarios', async () => {
        // Withdraw below daily limit
        const value1 = web3.utils.toWei("2", "ether");
        await multisigInstance.methods.submitTransaction(accounts[0], value1, '0x').send({ from: accounts[1], gas: GAS })
        const value1BN = web3.utils.toBN(value1.toString())

        const dailyLimitUpdated = web3.utils.toWei("2", "ether");
        const dailyLimitUpdatedBN = web3.utils.toBN(dailyLimitUpdated)
        const dailyLimitEncoded = multisigInstance.methods.changeDailyLimit(dailyLimitUpdated).encodeABI();
        const transactionId = utils.getParamFromTxEvent(
            await multisigInstance.methods.submitTransaction(multisigInstance.options.address, 0, dailyLimitEncoded).send({ from: accounts[1], gas: GAS }),
            'transactionId', null, 'Submission')
        await multisigInstance.methods.confirmTransaction(transactionId).send({ from: accounts[0], gas: GAS })
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        const value2 = web3.utils.toWei("1", "ether");
        const value2BN = web3.utils.toBN(value2.toString())
        const initialDepositBN = web3.utils.toBN(initialDeposit.toString())

        let owner1Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.methods.submitTransaction(accounts[0], value2, '0x').send({ from: accounts[1], gas: GAS })
        assert.equal(
            owner1Balance.add(value2BN),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )

        assert.equal(
            initialDepositBN.sub(value2BN).sub(value1BN),
            (await utils.balanceOf(web3, multisigInstance.options.address)).toString()
        )
        assert.equal(
            dailyLimitUpdatedBN - value2,
            (await multisigInstance.methods.calcMaxWithdraw().call()).toString()
        )
        await multisigInstance.methods.submitTransaction(accounts[0], value2, '0x').send({ from: accounts[1], gas: GAS })
        assert.equal(
            owner1Balance.add(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 2 - value1,
            (await utils.balanceOf(web3, multisigInstance.options.address)).toString()
        )
        assert.equal(
            dailyLimitUpdatedBN.sub(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await multisigInstance.methods.calcMaxWithdraw().call()).toString()
        )

        // Third time fails, because daily limit was reached
        const transactionIdFailed = utils.getParamFromTxEvent(
            await multisigInstance.methods.submitTransaction(accounts[0], value2, '0x').send({ from: accounts[1], gas: GAS }),
            'transactionId', null, 'Submission')
        assert.equal(false, (await multisigInstance.methods.transactions(transactionIdFailed).call())[3])
        assert.equal(
            owner1Balance.add(value2BN.mul(web3.utils.toBN("2"))).toString(),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN.sub(value2BN.mul(web3.utils.toBN("2"))).sub(value1BN).toString(),
            (await utils.balanceOf(web3, multisigInstance.options.address)).toString()
        )
        assert.equal(
            0,
            await multisigInstance.methods.calcMaxWithdraw().call()
        )

        // Let one day pass
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(dailyLimitUpdatedBN.toString(), (await multisigInstance.methods.calcMaxWithdraw().call()).toString())

        // Execute transaction should work now but fails, because it is triggered from a non owner address
        utils.assertThrowsAsynchronously(
            () => multisigInstance.methods.executeTransaction(transactionIdFailed).send({ from: accounts[9], gas: GAS })
        )
        // Execute transaction also fails if the sender is a wallet owner but didn't confirm the transaction first
        utils.assertThrowsAsynchronously(
            () => multisigInstance.methods.executeTransaction(transactionIdFailed).send({ from: accounts[0], gas: GAS })
        )
        // But it works with the right sender
        await multisigInstance.methods.executeTransaction(transactionIdFailed).send({ from: accounts[1], gas: GAS })
        assert.ok((await multisigInstance.methods.transactions(transactionIdFailed).call())[3])

        // Let one day pass
        await utils.increaseTimestamp(web3, ONE_DAY + 1)
        assert.equal(
            dailyLimitUpdated,
            await multisigInstance.methods.calcMaxWithdraw().call()
        )

        // User wants to withdraw more than the daily limit. Withdraw is unsuccessful.
        const value3 = web3.utils.toWei("3", "ether");
        owner1Balance = await utils.balanceOf(web3, accounts[0])
        await multisigInstance.methods.submitTransaction(accounts[0], value3, '0x').send({ from: accounts[1], gas: GAS })

        // Wallet and user balance remain the same.
        assert.equal(
            owner1Balance,
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 3 - value1,
            await utils.balanceOf(web3, multisigInstance.options.address)
        )
        assert.equal(
            dailyLimitUpdated,
            await multisigInstance.methods.calcMaxWithdraw().call()
        )

        // Daily withdraw is possible again
        await multisigInstance.methods.submitTransaction(accounts[0], value2, '0x').send({ from: accounts[1], gas: GAS })

        // Wallet balance decreases and user balance increases.
        assert.equal(
            owner1Balance.add(value2BN),
            (await utils.balanceOf(web3, accounts[0])).toString()
        )
        assert.equal(
            initialDepositBN - value2 * 4 - value1,
            await utils.balanceOf(web3, multisigInstance.options.address)
        )
        assert.equal(
            dailyLimitUpdated - value2,
            await multisigInstance.methods.calcMaxWithdraw().call()
        )
        // Try to execute a transaction tha does not exist fails
        const unknownTransactionId = 999
        utils.assertThrowsAsynchronously(
            () => multisigInstance.methods.executeTransaction(unknownTransactionId).send({ from: accounts[0], gas: GAS })
        )
    })
})